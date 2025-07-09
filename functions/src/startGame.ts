import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { addActionToBatch, createGameStartedAction } from "./actionUtils";
import { generateDeck, shuffleDeck } from "./deckUtils";
import { ActiveGame, CardID, GameInternalState, InitialGame } from "./types";

const db = getFirestore();

export interface StartGameRequest {
  gameId: string;
}

export interface StartGameResponse {
  success: boolean;
}

export const startGame = onCall<StartGameRequest, Promise<StartGameResponse>>(async (request) => {
  const userId = request.auth?.uid;
  if (!userId) {
    console.error("StartGame: User is not authenticated");
    throw new HttpsError("unauthenticated", "User is not authenticated");
  }

  const { gameId } = request.data;
  if (!gameId) {
    console.error("StartGame: Game ID is required");
    throw new HttpsError("invalid-argument", "Game ID is required");
  }

  console.debug("StartGame: Starting game", gameId, "for user", userId);

  try {
    // Get the game document
    const gameRef = db.collection("games").doc(gameId);
    const gameDoc = await gameRef.get();

    if (!gameDoc.exists) {
      console.error("StartGame: Game not found", gameId);
      throw new HttpsError("not-found", "Game not found");
    }

    const gameData = gameDoc.data() as InitialGame;

    // Check if the user is the host
    if (gameData.host !== userId) {
      console.error("StartGame: User is not the host", userId, "host is", gameData.host);
      throw new HttpsError("permission-denied", "Only the host can start the game");
    }

    // Check if the game is in the correct state
    if (gameData.status !== "gathering-players") {
      console.error("StartGame: Game is not in gathering-players state", gameData.status);
      throw new HttpsError("failed-precondition", "Game is not in the correct state to start");
    }

    // Check minimum player requirement (at least 2 players)
    if (gameData.players.length < 2) {
      console.error("StartGame: Not enough players to start game", gameData.players.length);
      throw new HttpsError("failed-precondition", "Need at least 2 players to start the game");
    }

    // Generate and shuffle the deck
    const deck = shuffleDeck(generateDeck());

    // Initialize player lives (everyone starts with 3 lives)
    const playerLives: { [playerId: string]: number } = {};
    gameData.players.forEach(playerId => {
      playerLives[playerId] = 3;
    });

    // Create the active game state (without playerHands and internalState)
    const activeGame: ActiveGame = {
      ...gameData,
      status: "active",
      playerLives,
      dealer: gameData.host, // Host starts as dealer
      round: 1,
      activePlayer: gameData.host, // Host starts as active player
      roundState: "pre-deal",
      actionCount: 0, // Initialize action count
    };

    // Create internal state document
    const internalState: GameInternalState = {
      deck,
      trash: [],
    };

    // Create player hand documents (everyone starts with null since no cards dealt yet)
    const playerHands: { [playerId: string]: CardID | null } = {};
    gameData.players.forEach(playerId => {
      playerHands[playerId] = null;
    });

    // Use a batch write to ensure all documents are created atomically
    const batch = db.batch();

    // Update the main game document
    batch.set(gameRef, activeGame);

    // Create internal state document
    const internalStateRef = db.collection("games").doc(gameId).collection("internalState").doc("state");
    batch.set(internalStateRef, internalState);

    // Create player hand documents
    const playerHandsRef = db.collection("games").doc(gameId).collection("playerHands");
    Object.entries(playerHands).forEach(([playerId, cardId]) => {
      const playerHandRef = playerHandsRef.doc(playerId);
      batch.set(playerHandRef, { card: cardId });
    });

    // Add the game started action to the batch
    const gameStartedAction = createGameStartedAction(userId, gameData.host);
    addActionToBatch(batch, gameId, gameStartedAction, 0);

    // Commit the batch (all changes including action happen atomically)
    await batch.commit();

    console.info("StartGame: Game started successfully", gameId);
    return { success: true };

  } catch (error) {
    console.error("StartGame: Error starting game", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "Error starting game");
  }
});
