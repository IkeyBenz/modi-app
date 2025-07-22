import { getFirestore } from "firebase-admin/firestore";
import { CallableRequest, HttpsError } from "firebase-functions/https";
import type { ActiveGame, CardID, GameInternalState } from "../types";
import { SwapCardRequest } from "./types";

const db = getFirestore();

export async function authorizeSwapCard(request: CallableRequest<SwapCardRequest>) {
  const userId = request.auth?.uid;
  if (!userId) {
    console.error("SwapCard: User is not authenticated");
    throw new HttpsError("unauthenticated", "User is not authenticated");
  }

  console.debug("SwapCard: Finding game where user", userId, "is active player");

  // Find the game where the user is the active player
  const gamesRef = db.collection("games");
  const activePlayerQuery = gamesRef.where("activePlayer", "==", userId).where("status", "==", "active");
  const activePlayerQuerySnapshot = await activePlayerQuery.get();

  if (activePlayerQuerySnapshot.empty) {
    console.error("SwapCard: No active game found where user is active player", userId);
    throw new HttpsError("not-found", "No active game found where you are the active player");
  }

  if (activePlayerQuerySnapshot.size > 1) {
    console.error("SwapCard: Multiple active games found where user is active player", userId);
    throw new HttpsError("internal", "Multiple active games found where you are active player");
  }

  const gameDoc = activePlayerQuerySnapshot.docs[0];
  const gameId = gameDoc.id;
  console.debug("SwapCard: Found game", gameId, "where user", userId, "is active player");

  // We already have the game document from the query
  const gameData = gameDoc.data() as ActiveGame;
  const gameRef = gameDoc.ref;

  // Check if the game is active
  if (gameData.status !== "active") {
    console.error("SwapCard: Game is not active", gameData.status);
    throw new HttpsError("failed-precondition", "Game is not active");
  }

  // Check if the user is the active player
  if (gameData.activePlayer !== userId) {
    console.error("SwapCard: User is not the active player", userId, "active player is", gameData.activePlayer);
    throw new HttpsError("permission-denied", "Only the active player can swap cards");
  }

  // Check if the round state is playing
  if (gameData.roundState !== "playing") {
    console.error("SwapCard: Round state is not playing", gameData.roundState);
    throw new HttpsError("failed-precondition", "Cards can only be swapped during playing state");
  }

  // Get the internal state (deck and trash)
  const internalStateRef = db.collection("games").doc(gameId).collection("internalState").doc("state");
  const internalStateDoc = await internalStateRef.get();

  if (!internalStateDoc.exists) {
    console.error("SwapCard: Internal state not found for game", gameId);
    throw new HttpsError("not-found", "Game internal state not found");
  }

  const internalState = internalStateDoc.data() as GameInternalState;

  // Get the current player's hand
  const currentPlayerHandRef = db.collection("games").doc(gameId).collection("playerHands").doc(userId);
  const currentPlayerHandDoc = await currentPlayerHandRef.get();

  if (!currentPlayerHandDoc.exists) {
    console.error("SwapCard: Current player hand not found", userId);
    throw new HttpsError("not-found", "Current player hand not found");
  }

  const currentPlayerHand = currentPlayerHandDoc.data() as { card: CardID | null };
  const currentPlayerCard = currentPlayerHand.card;

  if (!currentPlayerCard) {
    console.error("SwapCard: Current player has no card", userId);
    throw new HttpsError("failed-precondition", "Current player has no card to swap");
  }

  // Check if the current player has a King - players with Kings cannot swap
  if (currentPlayerCard.startsWith('K')) {
    console.info("SwapCard: Current player has king, disallowing swap", {
      gameId,
      currentPlayer: userId,
      currentPlayerCard
    });
    throw new HttpsError("failed-precondition", "Players with Kings cannot swap cards");
  }

  return {
    gameRef,
    internalStateRef,
    userId,
    gameId,
    gameData,
    internalState,
    currentPlayerCard
  };
}