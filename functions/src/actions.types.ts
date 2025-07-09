// Base action interface
interface BaseGameAction {
  id: string;
  timestamp: FirebaseFirestore.Timestamp;
  playerId: string;
}

// Specific action types
export interface GameStartedAction extends BaseGameAction {
  type: ActionType.GAME_STARTED;
  metadata: {
    initialDealer: string;
  };
}

export interface DealCardsAction extends BaseGameAction {
  type: ActionType.DEAL_CARDS;
  metadata: {
    dealingOrder: string[];
  };
}

export interface SwapCardsAction extends BaseGameAction {
  type: ActionType.SWAP_CARDS;
  targetPlayerId: string;
  metadata: {
    isDealerDraw: false;
    swapType: 'player-swap';
  };
}

export interface DealerDrawAction extends BaseGameAction {
  type: ActionType.DEALER_DRAW;
  metadata: {
    isDealerDraw: true;
    swapType: 'dealer-draw';
  };
}

export interface StickAction extends BaseGameAction {
  type: ActionType.STICK;
  metadata: {
    isDealer: boolean;
    action: 'dealer-stick' | 'player-stick';
  };
}

export interface EndRoundAction extends BaseGameAction {
  type: ActionType.END_ROUND;
  metadata: {
    playersLost: string[];
    lowestCard: string;
    newDealer: string;
    roundEnded: true;
  };
}

export interface DeckReshuffleAction extends BaseGameAction {
  type: ActionType.DECK_RESHUFFLE;
  metadata: {
    cardsShuffled: number;
    trigger: 'deck-empty';
  };
}

export interface SpecialEventAction extends BaseGameAction {
  type: ActionType.SPECIAL_EVENT;
  targetPlayerId?: string;
  metadata: {
    eventType: 'modi' | 'dirty-dan' | 'kung';
    specialEvent: true;
  };
}

export interface PlayerJoinedAction extends BaseGameAction {
  type: ActionType.PLAYER_JOINED;
  metadata: {
    username: string;
    joinEvent: true;
  };
}

export interface PlayerLeftAction extends BaseGameAction {
  type: ActionType.PLAYER_LEFT;
  metadata: {
    username: string;
    leaveEvent: true;
  };
}

// Union type for all actions
export type GameAction = 
  | GameStartedAction
  | DealCardsAction
  | SwapCardsAction
  | DealerDrawAction
  | StickAction
  | EndRoundAction
  | DeckReshuffleAction
  | SpecialEventAction
  | PlayerJoinedAction
  | PlayerLeftAction;

export enum ActionType {
  GAME_STARTED = 'game-started',
  DEAL_CARDS = 'deal-cards',
  SWAP_CARDS = 'swap-cards',
  DEALER_DRAW = 'dealer-draw',
  STICK = 'stick',
  END_ROUND = 'end-round',
  DECK_RESHUFFLE = 'deck-reshuffle',
  SPECIAL_EVENT = 'special-event',
  PLAYER_JOINED = 'player-joined',
  PLAYER_LEFT = 'player-left'
} 