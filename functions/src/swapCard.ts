import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { addActionToBatch, createDeckReshuffleAction, createSpecialEventAction, createSwapCardsAction } from "./actionUtils";
import { shuffleDeck } from "./deckUtils";
import { ActiveGame, CardID, GameInternalState } from "./types";

const db = getFirestore();

export interface SwapCardRequest {
  // No parameters needed - game ID is determined from user's active player status
}

export interface SwapCardResponse {
  success: boolean;
}

/**
 * Helper function to find the next alive player to the left of a given player
 */
function findNextAlivePlayerToLeft(
  players: string[],
  playerLives: { [playerId: string]: number },
  currentPlayerId: string
): string | null {
  const currentIndex = players.indexOf(currentPlayerId);
  if (currentIndex === -1) {
    return null;
  }

  // Start from the next player to the left and go around the circle
  for (let i = 1; i <= players.length; i++) {
    const playerIndex = (currentIndex + i) % players.length;
    const playerId = players[playerIndex];
    if (playerLives[playerId] > 0) {
      return playerId;
    }
  }

  return null; // No alive players found
}

export const swapCard = onCall<SwapCardRequest, Promise<SwapCardResponse>>(async (request) => {
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

  try {
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

    let newActivePlayer: string | undefined;
    let updatedInternalState: GameInternalState;
    let updatedPlayerHands: { [playerId: string]: CardID | null } = {};
    let deckReshuffled = false;
    let isDealerDraw = false;
    let isKungEvent = false;

    // Check if the current player is the dealer
    if (gameData.dealer === userId) {
      // Rule 3: Dealer draws a new card from the deck
      console.debug("SwapCard: Current player is dealer, drawing new card from deck");
      isDealerDraw = true;

      // Check if deck is empty and recycle trash if needed
      let currentDeck = [...internalState.deck];
      let currentTrash = [...internalState.trash];
      
      if (currentDeck.length === 0) {
        if (currentTrash.length === 0) {
          console.error("SwapCard: No cards left in deck or trash");
          throw new HttpsError("failed-precondition", "No cards left in deck or trash");
        }
        
        // Shuffle trash into new deck
        currentDeck = shuffleDeck(currentTrash);
        currentTrash = [];
        deckReshuffled = true;
        console.info("SwapCard: Recycled trash into new deck", { 
          newDeckSize: currentDeck.length 
        });
      }

      // Draw a new card from the deck
      const newCard = currentDeck.pop()!;
      
      // Add the current player's card to trash
      currentTrash.push(currentPlayerCard);

      updatedInternalState = {
        deck: currentDeck,
        trash: currentTrash,
      };

      updatedPlayerHands[userId] = newCard;

      // Rule 6: After dealer draws, set round state to "tallying"
      await gameRef.update({ roundState: "tallying" });

      console.info("SwapCard: Dealer drew new card", {
        gameId,
        dealer: userId,
        oldCard: currentPlayerCard,
        newCard,
        cardsRemaining: currentDeck.length,
        roundState: "tallying"
      });

    } else {
      // Rule 2: Find the next alive player to the left
      const nextPlayerId = findNextAlivePlayerToLeft(gameData.players, gameData.playerLives, userId);
      
      if (!nextPlayerId) {
        console.error("SwapCard: No alive players found to the left of current player", userId);
        throw new HttpsError("failed-precondition", "No alive players found to swap with");
      }

      // Get the next player's hand
      const nextPlayerHandRef = db.collection("games").doc(gameId).collection("playerHands").doc(nextPlayerId);
      const nextPlayerHandDoc = await nextPlayerHandRef.get();

      if (!nextPlayerHandDoc.exists) {
        console.error("SwapCard: Next player hand not found", nextPlayerId);
        throw new HttpsError("not-found", "Next player hand not found");
      }

      const nextPlayerHand = nextPlayerHandDoc.data() as { card: CardID | null };
      const nextPlayerCard = nextPlayerHand.card;

      if (!nextPlayerCard) {
        console.error("SwapCard: Next player has no card", nextPlayerId);
        throw new HttpsError("failed-precondition", "Next player has no card to swap");
      }

      // Rule 5: Check if the next player has a king
      if (nextPlayerCard.startsWith('K')) {
        console.info("SwapCard: Next player has king, disallowing swap", {
          gameId,
          currentPlayer: userId,
          nextPlayer: nextPlayerId,
          nextPlayerCard
        });

        // Don't swap cards, just set active player to the next player
        newActivePlayer = nextPlayerId;
        updatedInternalState = internalState; // No changes to deck/trash
        updatedPlayerHands = {}; // No changes to hands
        isKungEvent = true;

      } else {
        // Rule 2: Swap cards between current player and next player
        console.info("SwapCard: Swapping cards between players", {
          gameId,
          currentPlayer: userId,
          nextPlayer: nextPlayerId,
          currentPlayerCard,
          nextPlayerCard
        });

        updatedInternalState = internalState; // No changes to deck/trash
        updatedPlayerHands = {
          [userId]: nextPlayerCard,
          [nextPlayerId]: currentPlayerCard
        };

        // Rule 4: Set active player to the next player (the one we just swapped with)
        newActivePlayer = nextPlayerId;
      }
    }

    // Use a batch write to ensure all updates are atomic
    const batch = db.batch();

    // Update the main game document - update activePlayer (and roundState if dealer)
    if (gameData.dealer === userId) {
      // roundState was already updated above for dealer case
    } else {
      if (newActivePlayer) {
        batch.update(gameRef, { activePlayer: newActivePlayer });
      }
    }

    // Update the internal state (only if it changed)
    if (updatedInternalState !== internalState) {
      batch.set(internalStateRef, updatedInternalState);
    }

    // Update player hands (only if there are changes)
    if (Object.keys(updatedPlayerHands).length > 0) {
      const playerHandsRef = db.collection("games").doc(gameId).collection("playerHands");
      Object.entries(updatedPlayerHands).forEach(([playerId, card]) => {
        const playerHandRef = playerHandsRef.doc(playerId);
        batch.set(playerHandRef, { card });
      });
    }

    // Add actions to the batch (ensuring atomicity)
    let currentActionCount = gameData.actionCount || 0;

    if (deckReshuffled) {
      // Add deck reshuffle action if deck was recycled
      const reshuffleAction = createDeckReshuffleAction(gameId, userId, internalState.trash.length);
      addActionToBatch(batch, gameId, reshuffleAction, currentActionCount);
      currentActionCount++;
    }

    if (isDealerDraw) {
      // Add dealer draw action
      const dealerDrawAction = createSwapCardsAction(gameId, userId, "", undefined, true);
      addActionToBatch(batch, gameId, dealerDrawAction, currentActionCount);
    } else if (isKungEvent) {
      // Add Kung special event action
      const kungAction = createSpecialEventAction(gameId, userId, 'kung', newActivePlayer);
      addActionToBatch(batch, gameId, kungAction, currentActionCount);
    } else {
      // Add regular swap action
      const swapAction = createSwapCardsAction(gameId, userId, newActivePlayer!);
      addActionToBatch(batch, gameId, swapAction, currentActionCount);
    }

    // Commit the batch (all changes including actions happen atomically)
    await batch.commit();

    console.info("SwapCard: Card swap completed successfully", {
      gameId,
      currentPlayer: userId,
      isDealer: gameData.dealer === userId,
      newActivePlayer: gameData.dealer === userId ? undefined : newActivePlayer,
      roundState: gameData.dealer === userId ? "tallying" : gameData.roundState,
      deckReshuffled,
      isDealerDraw,
      isKungEvent,
    });

    return { success: true };

  } catch (error) {
    console.error("SwapCard: Error swapping cards", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "Error swapping cards");
  }
});
