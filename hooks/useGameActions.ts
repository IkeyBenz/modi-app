import { firestore } from "@/config/firebase";
import { ActionType, GameAction } from "@/functions/src/actions.types";
import { collection, onSnapshot, orderBy, query, startAfter } from "firebase/firestore";
import { useEffect, useRef } from "react";

interface GameActionHandlers {
  dealCards(toPlayers: string[]): void;
  swapCards(fromPlayerId: string, toPlayerId: string): void;
  trashCards(): void;
  revealCards(playerCards: { [playerId: string]: string }): void;
}

export function useGameActions(gameId: string, handlers: GameActionHandlers) {
  const lastActionId = useRef<string | null>(null);

  useEffect(() => {
    if (!gameId) return;

    // Subscribe to actions after the last seen action
    const actionsRef = collection(firestore, "games", gameId, "actions");
    const actionsQuery = lastActionId.current
      ? query(actionsRef, orderBy("timestamp"), startAfter(lastActionId.current))
      : query(actionsRef, orderBy("timestamp"));

    const unsubscribe = onSnapshot(actionsQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const action = change.doc.data() as GameAction;
          handleAction(action);
          lastActionId.current = action.id;
        }
      });
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  const handleAction = (action: GameAction) => {
    console.log("action", action);

    switch (action.type) {
      case ActionType.DEAL_CARDS:
        // Trigger deal cards animation
        handlers.dealCards(action.dealingOrder);
        break;

      case ActionType.SWAP_CARDS:
        // Trigger swap cards animation
        handlers.swapCards(action.playerId, action.targetPlayerId);
        break;

      case ActionType.REVEAL_CARDS:
        // Trigger reveal cards animation
        handlers.revealCards(action.playerCards);
        break;

      // Add other action types as needed
      case ActionType.DEALER_DRAW:
        // Could trigger a dealer draw animation
        break;

      case ActionType.END_ROUND:
        return handlers.trashCards();

      default:
        // Handle other action types
        break;
    }
  };
} 