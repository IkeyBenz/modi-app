import { firestore } from "@/config/firebase";
import { CardID } from "@/functions/src/types";
import { ActionType, DealerDrawAction, GameAction, KungAction } from "@/functions/src/types/actions.types";
import { useUserId } from "@/providers/Auth";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useRef } from "react";

interface GameActionHandlers {
  moveDeck?(toDealerId: string): Promise<void>;
  dealCards?(toPlayers: string[]): Promise<void>;
  swapCards?(fromPlayerId: string, toPlayerId: string): Promise<void>;
  hitDeck?(action: DealerDrawAction): Promise<void>;
  trashCards?(): Promise<void>;
  revealCards?(playerCards: { [playerId: string]: CardID }): Promise<void>;
  kung?(action: KungAction): Promise<void>;
  endGame?(): Promise<void>;
}


export function useGameActions(gameId: string, handlers: GameActionHandlers) {
  const actionQueue = useRef<GameAction[]>([]).current;
  const processing = useRef(false);
  const userId = useUserId();

  async function processActionQueue() {
    if (processing.current) return;
    processing.current = true;
    while (actionQueue.length) {
      const action = actionQueue.shift();
      if (!action) continue;
      await handleAction(action);
    }
    processing.current = false;
  }

  useEffect(() => {
    const actionsRef = collection(firestore, "games", gameId, "actions");
    const privateActionsRef = collection(firestore, "games", gameId, "privateActions", userId, "actions");

    const actionsQuery = query(actionsRef, orderBy("timestamp"));
    const privateActionsQuery = query(privateActionsRef, orderBy("timestamp"));

    function addActionToQueue(action: GameAction) {
      actionQueue.push(action);
      actionQueue.sort((a, b) => a.timestamp.toMillis() - b.timestamp.toMillis());
      processActionQueue();
    }

    const unsubscribePublicActions = onSnapshot(actionsQuery, (snapshot) => {
      snapshot.docChanges().filter((change) => change.type === 'added').forEach((change) => {
        const action = change.doc.data() as GameAction;
        addActionToQueue(action);
      });
    });

    const unsubscribePrivateActions = onSnapshot(privateActionsQuery, (snapshot) => {
      snapshot.docChanges().filter((change) => change.type === 'added').forEach((change) => {
        const action = change.doc.data() as GameAction;
        addActionToQueue(action);
      });
    });

    return () => {
      unsubscribePublicActions();
      unsubscribePrivateActions();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  const handleAction = async (action: GameAction) => {

    switch (action.type) {
      case ActionType.GAME_STARTED:
        return handlers.moveDeck?.(action.initialDealer);

      case ActionType.DEAL_CARDS:
        return handlers.dealCards?.(action.dealingOrder);

      case ActionType.SWAP_CARDS:
        return handlers.swapCards?.(action.playerId, action.targetPlayerId);

      case ActionType.REVEAL_CARDS:
        await handlers.revealCards?.(action.playerCards);
        
        return Promise.resolve();

      case ActionType.DEALER_DRAW:
        return handlers.hitDeck?.(action);

      case ActionType.END_ROUND:
        await handlers.trashCards?.();
        if (action.gameEnded) {
          await handlers?.endGame?.();
        } else { 
          await handlers?.moveDeck?.(action.newDealer);
        }
        return Promise.resolve();

      case ActionType.RECEIVE_CARD:
        return handlers.revealCards?.({ [action.playerId]: action.card });

      case ActionType.DECK_RESHUFFLE:
        console.warn("Deck reshuffled without action handler", action);
        return Promise.resolve();

      case ActionType.STICK:
        console.warn("Stick action without action handler", action);
        return Promise.resolve();

      case ActionType.KUNG:
        return handlers.kung?.(action);

      case ActionType.PLAYER_JOINED:
        console.warn("Player joined action without action handler", action);
        return Promise.resolve();

      case ActionType.PLAYER_LEFT:
        console.warn("Player left action without action handler", action);
        return Promise.resolve();
      
      default:
        const item: never = action;
        throw new Error(`Unknown action type: ${item}`);
    }
  };
} 