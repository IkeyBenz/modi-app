import { getFirestore } from "firebase-admin/firestore";
import { CardID } from "./types";
import {
  ActionType,
  DealCardsAction,
  DealerDrawAction,
  DeckReshuffleAction,
  EndRoundAction,
  GameAction,
  GameStartedAction,
  KungAction,
  PlayerJoinedAction,
  PlayerLeftAction,
  ReceiveCardAction,
  RevealCardsAction,
  StickAction,
  SwapCardsAction
} from "./types/actions.types";

const db = getFirestore();



/**
 * Creates a new game action and stores it in the actions subcollection
 * Also updates the main game document with the new action ID and count
 */
export async function createAndStoreAction(
  gameId: string,
  action: Omit<GameAction, 'id' | 'timestamp'>
): Promise<string> {
  const actionId = generateActionId();
  const timestamp = new Date();
  
  const gameAction: GameAction = {
    ...action,
    id: actionId,
    timestamp: timestamp as any, // Firebase Timestamp
  } as GameAction;

  // Use a batch write to ensure atomic updates
  const batch = db.batch();

  // Add the action to the actions subcollection
  const actionRef = db.collection("games").doc(gameId).collection("actions").doc(actionId);
  batch.set(actionRef, gameAction);

  // No longer update the main game document with lastActionId or actionCount

  await batch.commit();

  console.info("Action created and stored:", {
    gameId,
    actionId,
    type: action.type,
    playerId: action.playerId
  });

  return actionId;
}

/**
 * Creates a new game action and adds it to an existing batch
 * This ensures atomicity between game state changes and action creation
 */
export function addActionToBatch(
  batch: FirebaseFirestore.WriteBatch,
  gameId: string,
  action: Omit<GameAction, 'id' | 'timestamp'>
): string {
  const actionId = generateActionId();
  const timestamp = new Date();
  
  const gameAction: GameAction = {
    ...action,
    id: actionId,
    timestamp: timestamp as any, // Firebase Timestamp
  } as GameAction;

  // Add the action to the actions subcollection
  const actionRef = db.collection("games").doc(gameId).collection("actions").doc(actionId);
  batch.set(actionRef, gameAction);

  // No longer update the main game document with lastActionId or actionCount

  console.info("Action added to batch:", {
    gameId,
    actionId,
    type: action.type,
    playerId: action.playerId
  });

  return actionId;
}

/**
 * Gets the current action count for a game
 */
async function getCurrentActionCount(gameId: string): Promise<number> {
  const gameRef = db.collection("games").doc(gameId);
  const gameDoc = await gameRef.get();
  
  if (!gameDoc.exists) {
    throw new Error(`Game ${gameId} not found`);
  }
  
  const gameData = gameDoc.data();
  return gameData?.actionCount || 0;
}

/**
 * Generates a unique action ID
 */
function generateActionId() {
  return `action_${Date.now()}_${Math.random().toString(36).slice(2, 9)}` as const;
}

/**
 * Helper function to create a deal cards action
 */
export function createDealCardsAction(
  dealerId: string,
  dealingOrder: string[]
): Omit<DealCardsAction, 'id' | 'timestamp'> {
  return {
    type: ActionType.DEAL_CARDS,
    playerId: dealerId,
    dealingOrder
  };
}

/**
 * Helper function to create a swap cards action
 */
export function createSwapCardsAction(
  playerId: string,
  targetPlayerId: string,
  isDealerDraw: boolean = false,
  previousCard?: CardID
): Omit<SwapCardsAction | DealerDrawAction, 'id' | 'timestamp'> {
  if (isDealerDraw) {
    if (!previousCard) {
      throw new Error('previousCard is required for dealer draw actions');
    }
    return {
      type: ActionType.DEALER_DRAW,
      playerId,
      previousCard
    } as Omit<DealerDrawAction, 'id' | 'timestamp'>;
  } else {
    return {
      type: ActionType.SWAP_CARDS,
      playerId,
      targetPlayerId
    } as Omit<SwapCardsAction, 'id' | 'timestamp'>;
  }
}

/**
 * Helper function to create a stick action
 */
export function createStickAction(
  playerId: string,
  isDealer: boolean
): Omit<StickAction, 'id' | 'timestamp'> {
  return {
    type: ActionType.STICK,
    playerId,
    isDealer,
    action: isDealer ? 'dealer-stick' : 'player-stick'
  };
}

/**
 * Helper function to create an end round action
 */
export function createEndRoundAction(action: Omit<EndRoundAction, 'id' | 'timestamp' | 'type'>): Omit<EndRoundAction, 'id' | 'timestamp'> {
  return {
    type: ActionType.END_ROUND,
    ...action,
  };
}

/**
 * Helper function to create a deck reshuffle action
 */
export function createDeckReshuffleAction(
  triggerPlayerId: string,
  cardsShuffled: number
): Omit<DeckReshuffleAction, 'id' | 'timestamp'> {
  return {
    type: ActionType.DECK_RESHUFFLE,
    playerId: triggerPlayerId,
    cardsShuffled,
    trigger: 'deck-empty'
  };
}

export function createKungAction(
  playerId: string,
  playerIdWithKing: string,
  cardId: CardID
): Omit<KungAction, 'id' | 'timestamp'> {
  return {
    type: ActionType.KUNG,
    playerId,
    playerIdWithKing,
    cardId
  };
}

/**
 * Helper function to create a game started action
 */
export function createGameStartedAction(
  hostId: string,
  initialDealer: string
): Omit<GameStartedAction, 'id' | 'timestamp'> {
  return {
    type: ActionType.GAME_STARTED,
    playerId: hostId,
    initialDealer
  };
}

/**
 * Helper function to create a player joined action
 */
export function createPlayerJoinedAction(
  playerId: string,
  username: string
): Omit<PlayerJoinedAction, 'id' | 'timestamp'> {
  return {
    type: ActionType.PLAYER_JOINED,
    playerId,
    username,
    joinEvent: true
  };
}

/**
 * Helper function to create a reveal cards action
 */
export function createRevealCardsAction(
  dealerId: string,
  playerCards: { [playerId: string]: CardID }
): Omit<RevealCardsAction, 'id' | 'timestamp'> {
  return {
    type: ActionType.REVEAL_CARDS,
    playerId: dealerId,
    playerCards,
    revealEvent: true
  };
}

/**
 * Helper function to create a player left action
 */
export function createPlayerLeftAction(
  playerId: string,
  username: string
): Omit<PlayerLeftAction, 'id' | 'timestamp'> {
  return {
    type: ActionType.PLAYER_LEFT,
    playerId,
    username,
    leaveEvent: true
  };
} 

/**
 * Helper function to create a receive card action (private action)
 */
export function createReceiveCardAction(
  playerId: string,
  card: CardID
): ReceiveCardAction {
  return {
    id: `private-${generateActionId()}`,
    type: ActionType.RECEIVE_CARD,
    playerId,
    card,
    timestamp: new Date() as any,
  };
} 