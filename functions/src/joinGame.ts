import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { addActionToBatch, createPlayerJoinedAction } from "./actionUtils";
import { InitialGame } from "./types";

const db = getFirestore();

export interface JoinGameRequest {
  gameId: string;
  username: string;
}

export interface JoinGameResponse {
  success: boolean;
  gameId: string;
}

export const joinGame = onCall<JoinGameRequest, Promise<JoinGameResponse>>(async (request) => {
  const userId = request.auth?.uid;
  if (!userId) {
    console.error("JoinGame: User is not authenticated");
    throw new HttpsError("unauthenticated", "User is not authenticated");
  }

  const { gameId, username } = request.data;
  if (!gameId) {
    console.error("JoinGame: Game ID is required");
    throw new HttpsError("invalid-argument", "Game ID is required");
  }

  if (!username || username.trim().length === 0) {
    console.error("JoinGame: Username is required");
    throw new HttpsError("invalid-argument", "Username is required");
  }

  console.debug("JoinGame: User", userId, "attempting to join game", gameId, "with username", username);

  try {
    // Check if game exists
    const gameRef = db.collection("games").doc(gameId);
    const gameDoc = await gameRef.get();

    if (!gameDoc.exists) {
      console.error("JoinGame: Game not found", { gameId });
      throw new HttpsError("not-found", "Game not found");
    }

    const gameData = gameDoc.data() as InitialGame;
    if (!gameData) {
      console.error("JoinGame: Game data is null", { gameId });
      throw new HttpsError("internal", "Game data is corrupted");
    }

    // Check if game is in gathering-players state
    if (gameData.status !== "gathering-players") {
      console.error("JoinGame: Game is not accepting players", { gameId, status: gameData.status });
      throw new HttpsError("failed-precondition", "Game is not accepting players");
    }

    // Check if user is already in the game
    if (gameData.players && gameData.players.includes(userId)) {
      console.warn("JoinGame: User already in game", { userId, gameId });
      return { success: true, gameId };
    }

    // Use a batch write to ensure atomic updates
    const batch = db.batch();

    // Update the game document
    const updateData: Partial<InitialGame> = {
      players: [...(gameData.players || []), userId],
      usernames: { ...gameData.usernames, [userId]: username.trim() },
    };
    batch.update(gameRef, updateData);

    // Add the player joined action to the batch
    const playerJoinedAction = createPlayerJoinedAction(userId, username.trim());
    const currentActionCount = (gameData as any).actionCount || 0;
    addActionToBatch(batch, gameId, playerJoinedAction, currentActionCount);

    // Commit the batch (all changes including action happen atomically)
    await batch.commit();

    console.info("JoinGame: User successfully joined game", { userId, username, gameId });
    return { success: true, gameId };

  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    console.error("JoinGame: Unexpected error", error);
    throw new HttpsError("internal", "Failed to join game");
  }
}); 