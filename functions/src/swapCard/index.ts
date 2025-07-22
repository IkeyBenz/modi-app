import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { addActionToBatch, createDeckReshuffleAction, createKungAction, createReceiveCardAction, createRevealCardsAction, createSwapCardsAction } from "../actionUtils";
import { shuffleDeck } from "../deckUtils";
import type { CardID, GameInternalState } from "../types";
import { findNextAlivePlayerToLeft } from "../util";
import { authorizeSwapCard } from "./authorize";
import type { SwapCardRequest, SwapCardResponse } from "./types";

const db = getFirestore();


export const swapCard = onCall<SwapCardRequest, Promise<SwapCardResponse>>(async (request) => {
  try {
    const {
      userId,
      gameId,
      gameData,
      internalState,
      currentPlayerCard,
      gameRef,
      internalStateRef,
    } = await authorizeSwapCard(request);

    if (gameData.dealer === userId) {

    } else {
      const nextPlayerId = findNextAlivePlayerToLeft(gameData.players, gameData.playerLives, userId);
      if (!nextPlayerId) {
        console.error("SwapCard: No alive players found to the left of current player", userId);
        throw new HttpsError("failed-precondition", "No alive players found to swap with");
      }

      const nextPlayerHandRef = gameRef.collection("playerHands").doc(nextPlayerId);
      const nextPlayerHandDoc = await nextPlayerHandRef.get();
    }
    

    let newActivePlayer: string | undefined;
    let updatedInternalState: GameInternalState;
    let updatedPlayerHands: { [playerId: string]: CardID | null } = {};
    let deckReshuffled = false;



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
    if (deckReshuffled) {
      // Add deck reshuffle action if deck was recycled
      const reshuffleAction = createDeckReshuffleAction(userId, internalState.trash.length);
      addActionToBatch(batch, gameId, reshuffleAction);
    }

    if (isDealerDraw) {
      // Add dealer draw action
      const dealerDrawAction = createSwapCardsAction(userId, "", true, currentPlayerCard);
      addActionToBatch(batch, gameId, dealerDrawAction);
      
      // If the dealer drew, also add a reveal cards action
      // Get all player hands to reveal everyone's cards
      const playerHandsRef = db.collection("games").doc(gameId).collection("playerHands");
      const playerHandsSnapshot = await playerHandsRef.get();

      if (!playerHandsSnapshot.empty) {
        const playerCards: { [playerId: string]: CardID } = {};

        playerHandsSnapshot.forEach(doc => {
          const playerId = doc.id;
          const handData = doc.data() as { card: CardID | null };

          // Only include players with lives and cards
          if (gameData.playerLives[playerId] > 0) {
            // Use the updated card if present in updatedPlayerHands, otherwise use the card from Firestore
            const card =
              playerId in updatedPlayerHands
                ? updatedPlayerHands[playerId]
                : handData.card;
            if (card) {
              playerCards[playerId] = card;
            }
          }
        });

        // Add the reveal cards action
        const revealCardsAction = createRevealCardsAction(userId, playerCards);
        addActionToBatch(batch, gameId, revealCardsAction);
      }
    } else if (isKungEvent) {
      // Add Kung special event action
      const kungAction = createKungAction(userId, newActivePlayer!, currentPlayerCard);
      addActionToBatch(batch, gameId, kungAction);
    } else {
      // Add regular swap action
      const swapAction = createSwapCardsAction(userId, newActivePlayer!);
      addActionToBatch(batch, gameId, swapAction);
    }

    // Commit the batch (all changes including actions happen atomically)
    await batch.commit();

    // NEW: After committing the batch, write private 'receive-card' actions for affected player(s)
    const privateActionsRef = db.collection("games").doc(gameId).collection("privateActions");
    await Promise.all(
      Object.entries(updatedPlayerHands).map(async ([playerId, card]) => {
        if (card) {
          const playerPrivateActions = privateActionsRef.doc(playerId).collection("actions");
          const privateAction = createReceiveCardAction(playerId, card);
          await playerPrivateActions.add(privateAction);
        }
      })
    );

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
