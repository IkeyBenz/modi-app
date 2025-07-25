import { getFirestore } from "firebase-admin/firestore";
import {
  DealCardsAction,
  DealerDrawAction,
  DeckReshuffleAction,
  EndRoundAction,
  GameActions,
  GameActionType,
  GameStartedAction,
  KungAction,
  PlayerJoinedAction,
  PlayerLeftAction,
  ReceiveCardAction,
  RevealCardsAction,
  StickAction,
  SwapCardsAction,
  TallyingAction
} from "./types/actions.types";
import type { CardID } from "./types/card.types";

const db = getFirestore();



/**
 * Creates a new game action and stores it in the actions subcollection
 * Also updates the main game document with the new action ID and count
 */
export async function createAndStoreAction(
  gameId: string,
  action: Omit<GameActions, 'id' | 'timestamp'>
): Promise<string> {
  const actionId = generateActionId();
  const timestamp = new Date();
  
  const gameAction: GameActions = {
    ...action,
    id: actionId,
    timestamp: timestamp as any, // Firebase Timestamp
  } as GameActions;

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
  action: Omit<GameActions, 'id' | 'timestamp'>,
  timestamp?: Date
): string {
  const actionId = generateActionId();
  const actionTimestamp = timestamp || new Date();
  
  const gameAction: GameActions = {
    ...action,
    id: actionId,
    timestamp: actionTimestamp as any, // Firebase Timestamp
  } as GameActions;

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
    type: GameActionType.DEAL_CARDS,
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
      type: GameActionType.DEALER_DRAW,
      playerId,
      previousCard
    } as Omit<DealerDrawAction, 'id' | 'timestamp'>;
  } else {
    return {
      type: GameActionType.SWAP_CARDS,
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
    type: GameActionType.STICK,
    playerId,
    isDealer,
    action: isDealer ? 'dealer-stick' : 'player-stick'
  };
}

/**
 * Helper function to create an end round action
 */
export function createEndRoundAction(
  dealerId: string,
  newDealer: string
): Omit<EndRoundAction, 'id' | 'timestamp'> {
  return {
    type: GameActionType.END_ROUND,
    playerId: dealerId,
    newDealer,
  };
}

/**
 * Helper function to create a deck reshuffle action
 */
export function createDeckReshuffleAction(
  triggerPlayerId: string,
  currentDealer: string
): Omit<DeckReshuffleAction, 'id' | 'timestamp'> {
  return {
    type: GameActionType.DECK_RESHUFFLE,
    playerId: triggerPlayerId,
    currentDealer
  };
}


export function createKungAction(
  playerId: string,
  playerIdWithKing: string,
  cardId: CardID
): Omit<KungAction, 'id' | 'timestamp'> {
  return {
    type: GameActionType.KUNG,
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
    type: GameActionType.GAME_STARTED,
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
    type: GameActionType.PLAYER_JOINED,
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
    type: GameActionType.REVEAL_CARDS,
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
    type: GameActionType.PLAYER_LEFT,
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
    type: GameActionType.RECEIVE_CARD,
    playerId,
    card,
    timestamp: new Date() as any,
  };
} 

/**
 * Helper function to create a tallying action
 */
export function createTallyingAction(
  playerId: string,
  playersLost: string[]
): Omit<TallyingAction, 'id' | 'timestamp'> {
  return {
    type: GameActionType.TALLYING,
    playerId,
    playersLost
  };
} 