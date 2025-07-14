# CardTable Components

A composable set of React Native components for creating an animated card table with circular player positioning.

## Components

### CardTable
The main container component that provides the circular table layout and context for positioning.

```tsx
import { CardTable } from "@/ui/components/CardTable";

<CardTable>
  {/* Child components will be positioned relative to the table center */}
</CardTable>
```

### PlayerCircles
Renders player avatars in a circle around the table, with the current user always positioned at the bottom.

```tsx
import { PlayerCircles } from "@/ui/components/CardTable";

<PlayerCircles 
  players={[
    { playerId: "1", username: "Alice" },
    { playerId: "2", username: "Bob" },
    // ...
  ]} 
  currentUserId="1" 
/>
```

### CardTableAnimatableDeck
Handles card animations including dealing and swapping, replacing both AnimatedCards and CardDeck. Uses a ref to expose animation methods.

```tsx
import { CardTableAnimatableDeck, CardsRef } from "@/ui/components/CardTable";

const cardsRef = useRef<CardsRef>(null);

<CardTableAnimatableDeck 
  dealerId="2" 
  ref={cardsRef}
/>

// Trigger animations
cardsRef.current?.dealCards(["1", "2", "3", "4"]);
cardsRef.current?.swapCards("1", "2");
```

## Configuration

All animation and positioning values are configurable through the `CardTableConfig` interface:

```tsx
import { DEFAULT_CARD_TABLE_CONFIG } from "@/ui/components/CardTable";

const customConfig = {
  ...DEFAULT_CARD_TABLE_CONFIG,
  cardDistanceFromPlayer: 120,    // Distance cards are dealt from players
  deckDistanceFromDealer: 150,    // Distance deck is from dealer
  dealAnimationDuration: 800,     // Duration of deal animation (ms)
  swapAnimationDuration: 500,     // Duration of swap animation (ms)
  dealStaggerDelay: 400,          // Delay between each card being dealt (ms)
};
```

## Hooks

### useCardTable
Access the CardTable context to get radius and player positions.

```tsx
import { useCardTable } from "@/ui/components/CardTable";

const { radius, playerPositions } = useCardTable();
```

### useCardAnimations
Get animation functions and state for custom card animations.

```tsx
import { useCardAnimations } from "@/ui/components/CardTable";

const { cardAnimationValues, dealCards, swapCards, resetState } = useCardAnimations(config);
```

## Complete Example

```tsx
import React, { useRef } from "react";
import { Button } from "@/ui/elements";
import { 
  CardTable, 
  PlayerCircles, 
  CardTableAnimatableDeck, 
  CardsRef,
  CARD_TABLE_CONFIG 
} from "@/ui/components/CardTable";

const players = [
  { playerId: "1", username: "Alice" },
  { playerId: "2", username: "Bob" },
  { playerId: "3", username: "Charlie" },
  { playerId: "4", username: "Diana" },
];

const customConfig = {
  ...DEFAULT_CARD_TABLE_CONFIG,
  cardDistanceFromPlayer: 100,
  dealAnimationDuration: 600,
};

export function GameTable() {
  const cardsRef = useRef<CardsRef>(null);

  return (
    <CardTable>
      <PlayerCircles players={players} currentUserId="1" />
      <CardTableAnimatableDeck dealerId="2" ref={cardsRef} />
    </CardTable>
  );
}
```

## Architecture

The components use a context-based architecture where:

1. `CardTable` provides the circular layout and context
2. `PlayerCircles` calculates and communicates player positions
3. `AnimatedCards` uses the player positions to animate cards
4. All positioning is relative to the table center for consistency

This design allows for easy composition and extension of additional table elements. 