import { CardID } from "./card.types";

// Base action interface
interface BaseGameAction {
  id: string;
  timestamp: FirebaseFirestore.Timestamp;
  playerId: string;
}

// Specific action types
export interface GameStartedAction extends BaseGameAction {
  type: ActionType.GAME_STARTED;
  initialDealer: string;
}

export interface DealCardsAction extends BaseGameAction {
  type: ActionType.DEAL_CARDS;
  dealingOrder: string[];
}

export interface SwapCardsAction extends BaseGameAction {
  type: ActionType.SWAP_CARDS;
  targetPlayerId: string;
}

export interface DealerDrawAction extends BaseGameAction {
  type: ActionType.DEALER_DRAW;
  previousCard: CardID;
}

export interface StickAction extends BaseGameAction {
  type: ActionType.STICK;
  isDealer: boolean;
  action: 'dealer-stick' | 'player-stick';
}

export interface RevealCardsAction extends BaseGameAction {
  type: ActionType.REVEAL_CARDS;
  playerCards: { [playerId: string]: CardID }; // playerId -> cardId
  revealEvent: true;
}

export interface ReceiveCardAction extends BaseGameAction {
  type: ActionType.RECEIVE_CARD;
  card: CardID;
}


export type EndRoundAction = BaseGameAction & {
  type: ActionType.END_ROUND;
  playersLost: string[];
} & (
  { gameEnded: true; newDealer?: never } | { gameEnded: false, newDealer: string }
)

export interface DeckReshuffleAction extends BaseGameAction {
  type: ActionType.DECK_RESHUFFLE;
  cardsShuffled: number;
  trigger: 'deck-empty';
}

export interface KungAction extends BaseGameAction {
  type: ActionType.KUNG;
  playerIdWithKing: string;
  cardId: CardID;
}


export interface PlayerJoinedAction extends BaseGameAction {
  type: ActionType.PLAYER_JOINED;
  username: string;
  joinEvent: true;
}

export interface PlayerLeftAction extends BaseGameAction {
  type: ActionType.PLAYER_LEFT;
  username: string;
  leaveEvent: true;
}

// Union type for all actions
export type GameAction = 
  | GameStartedAction
  | DealCardsAction
  | SwapCardsAction
  | DealerDrawAction
  | StickAction
  | RevealCardsAction
  | EndRoundAction
  | DeckReshuffleAction
  | KungAction
  | PlayerJoinedAction
  | PlayerLeftAction
  | ReceiveCardAction;

export enum ActionType {
  GAME_STARTED = 'game-started',
  DEAL_CARDS = 'deal-cards',
  SWAP_CARDS = 'swap-cards',
  DEALER_DRAW = 'dealer-draw',
  STICK = 'stick',
  REVEAL_CARDS = 'reveal-cards',
  END_ROUND = 'end-round',
  DECK_RESHUFFLE = 'deck-reshuffle',
  KUNG = 'kung',
  PLAYER_JOINED = 'player-joined',
  PLAYER_LEFT = 'player-left',
  RECEIVE_CARD = 'receive-card',
} 