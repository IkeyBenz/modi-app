import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { addActionToBatch, createRevealCardsAction, createStickAction, createTallyingAction } from "./actionUtils";
import { ActiveGame, CardID } from "./types";
import { calculatePlayersLost } from "./util";

const db = getFirestore();

export interface StickRequest {
  // No parameters needed - game ID is determined from user's active player status
}

export interface StickResponse {
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

export const stick = onCall<StickRequest, Promise<StickResponse>>(async (request) => {
  const userId = request.auth?.uid;
  if (!userId) {
    console.error("Stick: User is not authenticated");
    throw new HttpsError("unauthenticated", "User is not authenticated");
  }

  console.debug("Stick: Finding game where user", userId, "is active player");

  // Find the game where the user is the active player and round state is playing
  const gamesRef = db.collection("games");
  const activePlayerQuery = gamesRef
    .where("activePlayer", "==", userId)
    .where("status", "==", "active")
    .where("roundState", "==", "playing");
  const activePlayerQuerySnapshot = await activePlayerQuery.get();

  if (activePlayerQuerySnapshot.empty) {
    console.error("Stick: No active game found where user is active player", userId);
    throw new HttpsError("not-found", "No active game found where you are the active player");
  }

  if (activePlayerQuerySnapshot.size > 1) {
    console.error("Stick: Multiple active games found where user is active player", userId);
    throw new HttpsError("internal", "Multiple active games found where you are active player");
  }

  const gameDoc = activePlayerQuerySnapshot.docs[0];
  const gameId = gameDoc.id;
  console.debug("Stick: Found game", gameId, "where user", userId, "is active player");

  try {
    // We already have the game document from the query
    const gameData = gameDoc.data() as ActiveGame;
    const gameRef = gameDoc.ref;

    let updateData: Partial<ActiveGame> = {};
    const isDealer = gameData.dealer === userId;

    // Check if the current player is the dealer
    if (isDealer) {
      // Rule 2: If called by the dealer, simply updates the roundState to 'tallying'
      console.debug("Stick: Current player is dealer, updating roundState to tallying");
      updateData = { roundState: "tallying" };
    } else {
      // Rule 3: If called by anyone else, updates activePlayer to be the first alive player to the left
      console.debug("Stick: Current player is not dealer, finding next alive player to the left");
      
      const nextPlayerId = findNextAlivePlayerToLeft(gameData.players, gameData.playerLives, userId);
      
      if (!nextPlayerId) {
        console.error("Stick: No alive players found to the left of current player", userId);
        throw new HttpsError("failed-precondition", "No alive players found to pass turn to");
      }

      updateData = { activePlayer: nextPlayerId };
    }

    // Use a batch write to ensure atomic updates
    const batch = db.batch();

    // Update the game document
    batch.update(gameRef, updateData);

    // Add the stick action to the batch
    const stickAction = createStickAction(userId, isDealer);
    addActionToBatch(batch, gameId, stickAction);

    // If the dealer is sticking, also add a reveal cards action
    if (isDealer) {
      // Get all player hands to reveal everyone's cards
      const playerHandsRef = db.collection("games").doc(gameId).collection("playerHands");
      const playerHandsSnapshot = await playerHandsRef.get();

      if (!playerHandsSnapshot.empty) {
        const playerCards: { [playerId: string]: CardID } = {};

        playerHandsSnapshot.forEach(doc => {
          const playerId = doc.id;
          const handData = doc.data() as { card: CardID | null };
          
          // Only include players with lives and cards
          if (gameData.playerLives[playerId] > 0 && handData.card) {
            playerCards[playerId] = handData.card;
          }
        });

        // Add the reveal cards action
        const revealCardsAction = createRevealCardsAction(userId, playerCards);
        const revealTimestamp = new Date();
        addActionToBatch(batch, gameId, revealCardsAction, revealTimestamp);

        // Add the tallying action
        const playersLost = calculatePlayersLost(playerCards);
        const tallyingAction = createTallyingAction(userId, playersLost);
        const tallyingTimestamp = new Date(revealTimestamp.getTime() + 1); // Ensure different timestamp
        addActionToBatch(batch, gameId, tallyingAction, tallyingTimestamp);

        // Decrement lives for players with lowest card
        const updatedPlayerLives = { ...gameData.playerLives };
        playersLost.forEach(playerId => {
          updatedPlayerLives[playerId] = Math.max(0, updatedPlayerLives[playerId] - 1);
        });

        // Update player lives
        batch.update(gameRef, { playerLives: updatedPlayerLives });
      }
    }

    // Commit the batch (all changes including action happen atomically)
    await batch.commit();

    console.info("Stick: Successfully stuck", {
      gameId,
      player: userId,
      isDealer,
      updateData
    });

    return { success: true };

  } catch (error) {
    console.error("Stick: Error sticking", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "Error sticking");
  }
});
