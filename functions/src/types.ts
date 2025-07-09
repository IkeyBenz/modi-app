interface GameBase {
  gameId: string;
  players: string[];
  host: string;
  usernames: { [playerId: string]: string };
}

export interface InitialGame extends GameBase {
  status: 'gathering-players';
}

export interface ActiveGame extends GameBase {
  status: 'active';
  playerLives: { [playerId: string]: number };
  dealer: string;
  round: number;
  activePlayer: string;
  roundState: 'pre-deal' | 'playing' | 'tallying';
  // Action tracking fields
  lastActionId?: string;
  actionCount: number;
}

interface EndedGame extends Omit<ActiveGame, 'status'> {
  status: 'ended';
  winner: string;
}

// Separate document for internal game state (deck, trash)
export interface GameInternalState {
  deck: CardID[];
  trash: CardID[];
}

// Separate document for each player's hand
export interface PlayerHand {
  card: CardID | null;
  playerId: string;
}

export type CardRank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
export type CardSuit = 'H' | 'D' | 'C' | 'S';
export type CardID = `${CardRank}${CardSuit}`;

export type Game = InitialGame | ActiveGame | EndedGame;

export function isWaitingForPlayers(game: Game): game is InitialGame {
  return game.status === 'gathering-players';
}

export function isActive(game: Game): game is ActiveGame {
  return game.status === 'active';
}

export function isEnded(game: Game): game is EndedGame {
  return game.status === 'ended';
}

// Re-export action types for convenience
export * from './actions.types';
