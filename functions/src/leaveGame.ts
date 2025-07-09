import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { addActionToBatch, createPlayerLeftAction } from "./actionUtils";
import { InitialGame } from "./types";

const db = getFirestore();

export interface LeaveGameRequest {
  // No longer need gameId - backend will find it
}

export interface LeaveGameResponse {
  success: boolean;
  gameId: string;
}

export const leaveGame = onCall<LeaveGameRequest, Promise<LeaveGameResponse>>(async (request) => {
  const userId = request.auth?.uid;
  if (!userId) {
    console.error("LeaveGame: User is not authenticated");
    throw new HttpsError("unauthenticated", "User is not authenticated");
  }

  try {
    // Find which game the user is currently in by searching games collection
    const gamesRef = db.collection("games");
    const snapshot = await gamesRef.where("players", "array-contains", userId).get();

    if (snapshot.empty) {
      console.warn("LeaveGame: User not in any game", { userId });
      return { success: true, gameId: "" };
    }

    // Get the first (and should be only) game the user is in
    const gameDoc = snapshot.docs[0];
    const gameId = gameDoc.id;
    const gameData = gameDoc.data() as InitialGame;

    // Check if user is the host
    if (gameData.host === userId) {
      console.error("LeaveGame: Host cannot leave game", { userId, gameId });
      throw new HttpsError("failed-precondition", "Host cannot leave the game. Transfer host or end the game instead.");
    }

    // Get the username before removing it
    const username = gameData.usernames?.[userId] || "Unknown Player";

    // Use a batch write to ensure atomic updates
    const batch = db.batch();

    // Remove user from the game
    const updatedPlayers = gameData.players.filter((playerId: string) => playerId !== userId);
    const updateData: Partial<InitialGame> = {
      players: updatedPlayers,
    };

    // Remove player info
    if (gameData.usernames && gameData.usernames[userId]) {
      const { [userId]: removedPlayer, ...remainingPlayerInfo } = gameData.usernames;
      updateData.usernames = remainingPlayerInfo;
    }

    batch.update(gameDoc.ref, updateData);

    // Add the player left action to the batch
    const playerLeftAction = createPlayerLeftAction(gameId, userId, username);
    const currentActionCount = (gameData as any).actionCount || 0;
    addActionToBatch(batch, gameId, playerLeftAction, currentActionCount);

    // Commit the batch (all changes including action happen atomically)
    await batch.commit();

    console.info("LeaveGame: User successfully left game", { userId, gameId, username });
    return { success: true, gameId };

  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    console.error("LeaveGame: Unexpected error", error);
    throw new HttpsError("internal", "Failed to leave game");
  }
}); 