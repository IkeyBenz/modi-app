import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { addActionToBatch, createDealCardsAction, createDeckReshuffleAction } from "./actionUtils";
import { shuffleDeck } from "./deckUtils";
import { ActiveGame, CardID, GameInternalState } from "./types";

const db = getFirestore();

export interface DealCardsRequest {
  // No parameters needed - game ID is determined from user's dealer status
}

export interface DealCardsResponse {
  success: boolean;
}

export const dealCards = onCall<DealCardsRequest, Promise<DealCardsResponse>>(async (request) => {
  const userId = request.auth?.uid;
  if (!userId) {
    console.error("DealCards: User is not authenticated");
    throw new HttpsError("unauthenticated", "User is not authenticated");
  }

  console.debug("DealCards: Finding game where user", userId, "is dealer");

  // Find the game where the user is the dealer
  const gamesRef = db.collection("games");
  const dealerQuery = gamesRef.where("dealer", "==", userId).where("status", "==", "active");
  const dealerQuerySnapshot = await dealerQuery.get();

  if (dealerQuerySnapshot.empty) {
    console.error("DealCards: No active game found where user is dealer", userId);
    throw new HttpsError("not-found", "No active game found where you are the dealer");
  }

  if (dealerQuerySnapshot.size > 1) {
    console.error("DealCards: Multiple active games found where user is dealer", userId);
    throw new HttpsError("internal", "Multiple active games found where you are dealer");
  }

  const gameDoc = dealerQuerySnapshot.docs[0];
  const gameId = gameDoc.id;
  console.debug("DealCards: Found game", gameId, "where user", userId, "is dealer");

  try {
    // We already have the game document from the query
    const gameData = gameDoc.data() as ActiveGame;
    const gameRef = gameDoc.ref;

    // Check if the game is active
    if (gameData.status !== "active") {
      console.error("DealCards: Game is not active", gameData.status);
      throw new HttpsError("failed-precondition", "Game is not active");
    }

    // Check if the user is the dealer
    if (gameData.dealer !== userId) {
      console.error("DealCards: User is not the dealer", userId, "dealer is", gameData.dealer);
      throw new HttpsError("permission-denied", "Only the dealer can deal cards");
    }

    // Check if the round state is pre-deal
    if (gameData.roundState !== "pre-deal") {
      console.error("DealCards: Round state is not pre-deal", gameData.roundState);
      throw new HttpsError("failed-precondition", "Cards can only be dealt in pre-deal state");
    }

    // Get the internal state (deck and trash)
    const internalStateRef = db.collection("games").doc(gameId).collection("internalState").doc("state");
    const internalStateDoc = await internalStateRef.get();

    if (!internalStateDoc.exists) {
      console.error("DealCards: Internal state not found for game", gameId);
      throw new HttpsError("not-found", "Game internal state not found");
    }

    const internalState = internalStateDoc.data() as GameInternalState;

    // Check if deck is empty and recycle trash if needed
    let currentDeck = [...internalState.deck];
    let currentTrash = [...internalState.trash];
    let deckReshuffled = false;
    
    if (currentDeck.length === 0) {
      if (currentTrash.length === 0) {
        console.error("DealCards: No cards left in deck or trash");
        throw new HttpsError("failed-precondition", "No cards left in deck or trash");
      }
      
      // Shuffle trash into new deck
      currentDeck = shuffleDeck(currentTrash);
      currentTrash = [];
      deckReshuffled = true;
      console.info("DealCards: Recycled trash into new deck", { 
        newDeckSize: currentDeck.length 
      });
    }

    // Get players with lives remaining
    const playersWithLives = gameData.players.filter(playerId => gameData.playerLives[playerId] > 0);

    if (playersWithLives.length === 0) {
      console.error("DealCards: No players with lives remaining");
      throw new HttpsError("failed-precondition", "No players with lives remaining");
    }

    // Find the dealer's position in the players array
    const dealerIndex = gameData.players.indexOf(gameData.dealer);
    if (dealerIndex === -1) {
      console.error("DealCards: Dealer not found in players array");
      throw new HttpsError("internal", "Dealer not found in players array");
    }

    // Create the dealing order: start from left of dealer, end with dealer
    const dealingOrder: string[] = [];
    for (let i = 1; i <= gameData.players.length; i++) {
      const playerIndex = (dealerIndex + i) % gameData.players.length;
      const playerId = gameData.players[playerIndex];
      if (gameData.playerLives[playerId] > 0) {
        dealingOrder.push(playerId);
      }
    }

    // Deal one card to each player in order
    const updatedPlayerHands: { [playerId: string]: CardID } = {};

    dealingOrder.forEach((playerId) => {
      // Check if deck is empty and recycle trash if needed
      if (currentDeck.length === 0) {
        if (currentTrash.length === 0) {
          console.error("DealCards: No cards left in deck or trash during dealing");
          throw new HttpsError("failed-precondition", "No cards left in deck or trash");
        }
        
        // Shuffle trash into new deck
        currentDeck = shuffleDeck(currentTrash);
        currentTrash = [];
        deckReshuffled = true;
        console.info("DealCards: Recycled trash into new deck during dealing", { 
          newDeckSize: currentDeck.length 
        });
      }
      
      // Deal the card
      const card = currentDeck.pop()!;
      updatedPlayerHands[playerId] = card;
    });

    // Find the first player to the left of dealer with lives (for active player)
    let newActivePlayer = gameData.dealer;
    for (let i = 1; i <= gameData.players.length; i++) {
      const playerIndex = (dealerIndex + i) % gameData.players.length;
      const playerId = gameData.players[playerIndex];
      if (gameData.playerLives[playerId] > 0) {
        newActivePlayer = playerId;
        break;
      }
    }

    // Update the internal state with the remaining deck and trash
    const newInternalState: GameInternalState = {
      deck: currentDeck,
      trash: currentTrash,
    };

    // Use a batch write to ensure all updates are atomic
    const batch = db.batch();

    // Update the main game document - update roundState and activePlayer
    batch.update(gameRef, { 
      roundState: "playing",
      activePlayer: newActivePlayer,
    });

    // Update the internal state
    batch.set(internalStateRef, newInternalState);

    // Update player hands
    const playerHandsRef = db.collection("games").doc(gameId).collection("playerHands");
    Object.entries(updatedPlayerHands).forEach(([playerId, card]) => {
      const playerHandRef = playerHandsRef.doc(playerId);
      batch.set(playerHandRef, { card });
    });

    // Add actions to the batch (ensuring atomicity)
    let currentActionCount = gameData.actionCount || 0;

    if (deckReshuffled) {
      // Add deck reshuffle action if deck was recycled
      const reshuffleAction = createDeckReshuffleAction(userId, currentTrash.length);
      addActionToBatch(batch, gameId, reshuffleAction, currentActionCount);
      currentActionCount++;
    }

    // Add deal cards action
    const dealCardsAction = createDealCardsAction(userId, dealingOrder);
    addActionToBatch(batch, gameId, dealCardsAction, currentActionCount);

    // Commit the batch (all changes including actions happen atomically)
    await batch.commit();

    console.info("DealCards: Cards dealt successfully", {
      gameId,
      dealer: gameData.dealer,
      playersDealt: dealingOrder.length,
      cardsRemaining: currentDeck.length,
      newActivePlayer,
      deckReshuffled,
    });

    return { success: true };

  } catch (error) {
    console.error("DealCards: Error dealing cards", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "Error dealing cards");
  }
});
