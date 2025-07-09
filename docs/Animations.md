## Animations
In order to make the game feel polished, we need to animate certain actions:
1. When players get dealt cards; it feels jarring if cards just appear out of nowhere
2. When players swap cards; its important when deciding if you yourself should swap cards
3. When dealer hits the deck
4. When everyone's cards get sent to the trash
5. When the deck moves to the next dealer

This document will serve to outline the architecture needed to support these animations.

## Data
Currently, we don't have any public notion of "moves" or "actions."
In other words, when the dealer presses "deal cards," the next state change simply includes every player having their dealt card. There's no piece of data that explains how that happened.

In fact, the frontend actually has no concept of other players cards at all, as of now.

What if we had an array of "actions" that user's take which prompt an animation to occur.

## Actions
- Dealing the cards
It's important to remember that each device can't know what card other players receive - but we do want them to know which players receive a card.

What if we had public object of

playerCards: {
  [playerId: string]: number | null;
}

the number would serve two purposes here:
1. If the value is a number, eg its non-null, we know to render a card by that player's hand
2. The number acts as the index of card that was dealt -> so we can know when they trade cards

The hard part is figuring out how to ensure our animations remain in sync with the backend. We're using socket connections that are fairly durable. but what happens if for example a client disconnects, and while they were disconnected, many things happened, then they reconnected -> how will we know how to animate or what to animate

I think that's why we need a long running array of actions.
This way we can have the game subscribe to the array of actions, and ensure it animates for every action that its supposed to. if it disconnects for a bit and then reconnects and receives many new actions in one shot, it'll still be able to animate each one appropriately.

One thing that would concern me is each client subscribing to the entire array of actions for the entirety of the game. Since technically the clients only need the last action and any new action after that. We don't need to fetch all prior actions, it might get expensive to do so. I should find out if there's a way to "paginate" a subscription to an array field in Firestore.

## Implementation Architecture

### Action Structure
```typescript
interface GameAction {
  id: string;                    // Unique action ID
  timestamp: Timestamp;          // When action occurred
  type: ActionType;              // Type of action
  playerId?: string;             // Player who initiated action
  targetPlayerId?: string;       // Target player (for swaps)
  cardIndex?: number;            // Card index for privacy
  recipients?: string[];         // For deal-cards action
  metadata?: Record<string, any>; // Special events, etc.
}

enum ActionType {
  DEAL_CARDS = 'deal-cards',
  SWAP_CARDS = 'swap-cards', 
  DEALER_DRAW = 'dealer-draw',
  END_ROUND = 'end-round',
  DECK_RESHUFFLE = 'deck-reshuffle',
  SPECIAL_EVENT = 'special-event'
}
```

### Firestore Structure
```
/games/{gameId}
  - Game document (existing)
  - lastActionId: string (reference to most recent action)
  - actionCount: number (total actions for pagination)

/games/{gameId}/actions/{actionId}
  - GameAction documents (subcollection)
```

### Efficient Pagination Solution

**Answer to the pagination question**: Yes, there are several efficient ways to handle this:

#### 1. Using `startAfter()` with Document References
```typescript
// Store last action ID locally
const lastActionId = localStorage.getItem(`lastActionId_${gameId}`);

// Subscribe to actions after the last seen action
const actionsRef = collection(db, 'games', gameId, 'actions');
const q = lastActionId 
  ? query(actionsRef, orderBy('timestamp'), startAfter(lastActionId))
  : query(actionsRef, orderBy('timestamp'), limit(50)); // Initial load

onSnapshot(q, (snapshot) => {
  snapshot.docChanges().forEach((change) => {
    if (change.type === 'added') {
      // Animate this action
      animateAction(change.doc.data() as GameAction);
      // Update last seen
      localStorage.setItem(`lastActionId_${gameId}`, change.doc.id);
    }
  });
});
```

#### 2. Hybrid Approach (Recommended)
```typescript
// Subscribe to game document for action count
onSnapshot(doc(db, 'games', gameId), (gameDoc) => {
  const game = gameDoc.data() as Game;
  
  // If we have a gap in our local action count, fetch missing actions
  const localActionCount = getLocalActionCount(gameId);
  if (game.actionCount > localActionCount) {
    fetchMissingActions(gameId, localActionCount, game.actionCount);
  }
});

// Subscribe to new actions only
const actionsRef = collection(db, 'games', gameId, 'actions');
const newActionsQuery = query(
  actionsRef, 
  orderBy('timestamp', 'desc'), 
  limit(1)
);

onSnapshot(newActionsQuery, (snapshot) => {
  snapshot.docChanges().forEach((change) => {
    if (change.type === 'added') {
      const action = change.doc.data() as GameAction;
      // Only animate if this is a new action we haven't seen
      if (!hasAnimatedAction(action.id)) {
        animateAction(action);
        markActionAsAnimated(action.id);
      }
    }
  });
});
```

### Animation State Management
```typescript
interface AnimationState {
  lastAnimatedActionId: string;
  pendingActions: GameAction[];
  isAnimating: boolean;
  animationQueue: AnimationTask[];
}

interface AnimationTask {
  action: GameAction;
  priority: number;
  delay: number;
}
```

### Privacy-Preserving Card Tracking
```typescript
interface PlayerCardState {
  [playerId: string]: {
    cardIndex: number | null;    // Index in deck, not actual card
    isVisible: boolean;          // Whether card is face-up
    lastUpdated: Timestamp;      // For animation timing
  };
}
```

### Implementation Benefits

1. **Efficient**: Only fetches new actions, not entire history
2. **Resilient**: Handles disconnections and reconnections gracefully
3. **Private**: Card indices don't reveal actual card values
4. **Scalable**: Subcollections prevent document size limits
5. **Real-time**: Immediate updates via Firestore listeners
6. **Synchronized**: All clients animate the same sequence

### Migration Strategy

1. **Phase 1**: Add action tracking to existing game functions
2. **Phase 2**: Implement animation layer with action subscription
3. **Phase 3**: Add local storage for action continuity
4. **Phase 4**: Optimize with pagination and caching

This architecture solves your pagination concern while providing a robust foundation for smooth, synchronized animations across all clients.