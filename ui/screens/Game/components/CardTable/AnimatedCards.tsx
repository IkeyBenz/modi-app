import {
  AnimatableCardDeck,
  AnimatableCardDeckRef,
  AnimatedCard,
} from "@/ui/components/AnimatableCardDeck";
import { useGameActions } from "@/ui/screens/Game/GameActionsProvider";
import React, { useRef } from "react";

import { withTiming } from "react-native-reanimated";
import { useCardTable } from "./context";
import { PlayerPosition } from "./types";

export function AnimatedCards() {
  const { playerPositions, radius } = useCardTable();
  if (!radius || !Object.keys(playerPositions).length) return null;

  return <AnimatedCardsInner />;
}

function AnimatedCardsInner() {
  const deck = useRef<AnimatableCardDeckRef>(null);
  const { playerPositions } = useCardTable();

  const virtualTrash = useRef<AnimatedCard[]>([]);
  const playerHands = useRef<{
    [playerId: string]: AnimatedCard | null;
  }>({});
  const cardsOnTable = useRef<AnimatedCard[]>([]);
  // Keep track of the next available z-index for any card that appears on the
  // table (i.e. cards in players' hands, hit cards, etc.).
  // This is monotonically increasing so that newer cards always appear above
  // older ones, satisfying the "hit card above original card" requirement.
  const nextTableZIndex = useRef<number>(1);

  function getDeck(): AnimatedCard[] {
    const cards = deck.current?.getCards();
    if (!cards) throw new Error("No cards in deck");
    return cards.slice(
      0,
      cards.length - cardsOnTable.current.length - virtualTrash.current.length
    );
  }

  function getNextCardFromDeck(): AnimatedCard {
    const cards = getDeck();
    const nextCard = cards.pop();
    if (!nextCard) throw new Error("No cards in deck");
    cardsOnTable.current.push(nextCard);
    return nextCard;
  }

  // Hook into live game actions
  useGameActions({
    gameStarted: async ({ initialDealer }) => {
      await moveDeckNextToPlayer(getDeck(), playerPositions[initialDealer]);
    },
    dealCards: async ({ dealingOrder }) => {
      const zIndexes: { [zIndex: number]: AnimatedCard } = {};
      const animations = dealingOrder.map((playerId) => {
        const nextCard = getNextCardFromDeck();
        playerHands.current[playerId] = nextCard;
        const zIndex = nextTableZIndex.current++;
        zIndexes[zIndex] = nextCard;
        return () => moveCardToPlayer(playerPositions[playerId], nextCard);
      });
      await staggerPromises(400, animations);
      Object.entries(zIndexes).forEach(([zIndex, card]) => {
        card.setZIndex(Number(zIndex));
      });
    },
    swapCards: async ({ playerId, targetPlayerId }) => {
      const fromCard = playerHands.current[playerId];
      const toCard = playerHands.current[targetPlayerId];
      if (!fromCard || !toCard) throw new Error("No cards to swap");
      playerHands.current[playerId] = toCard;
      playerHands.current[targetPlayerId] = fromCard;
      await staggerPromises(400, [
        () =>
          staggerPromises(100, [
            () => fromCard.ensureFaceDown(),
            () => moveCardToPlayer(playerPositions[targetPlayerId], fromCard),
          ]),
        () =>
          staggerPromises(100, [
            () => toCard.ensureFaceDown(),
            () => moveCardToPlayer(playerPositions[playerId], toCard),
          ]),
      ]);
    },
    dealerDraw: async ({ playerId, previousCard }) => {
      const nextCard = getNextCardFromDeck();
      const zIndex = nextTableZIndex.current++;
      nextCard.setZIndex(zIndex);
      const card = playerHands.current[playerId]!;
      card.setValue(previousCard);
      await card.ensureFaceUp();
      await makeRoomForHitCard(card, playerPositions[playerId]);
      await moveCardToPlayer(playerPositions[playerId], nextCard);
      playerHands.current[playerId] = nextCard;
    },
    endRound: async ({ newDealer }) => {
      const cards = Array.from(cardsOnTable.current);
      cards.forEach((card) => virtualTrash.current.push(card));
      cardsOnTable.current = [];
      playerHands.current = {};
      await staggerPromises(
        200,
        cards.map((card, idx) => () => moveCardToTrash(card, idx))
      );
      await moveDeckNextToPlayer(getDeck(), playerPositions[newDealer]);
    },
    receiveCard: async ({ playerId, card: cardId }) => {
      const card = playerHands.current[playerId]!;
      card.setValue(cardId);
      await card.ensureFaceUp();
      await moveCardToPlayer(playerPositions[playerId], card);
    },
    revealCards: async ({ playerCards }) => {
      const cards = deck.current?.getCards();
      if (!cards) throw new Error("No cards in deck");

      Object.entries(playerCards).forEach(([playerId, cardId]) => {
        playerHands.current[playerId]?.setValue(cardId);
      });

      await staggerPromises(
        200,
        Object.keys(playerCards).map((playerId) => {
          return () => playerHands.current[playerId]!.ensureFaceUp();
        })
      );
    },
    kung: async ({ playerId, playerIdWithKing, cardId }) => {
      const player = playerPositions[playerId];
      const king = playerPositions[playerIdWithKing];
      const card = playerHands.current[playerId]!;
      const kingCard = playerHands.current[playerIdWithKing]!;
      kingCard.setValue(cardId);
      await moveCardToPlayer(king, card);
      await staggerPromises(200, [
        () => kingCard.ensureFaceUp(),
        () => moveCardToPlayer(player, card),
      ]);
    },
    deckReshuffle: async ({ currentDealer }) => {
      const trash = [...virtualTrash.current];
      virtualTrash.current = [];
      await moveDeckNextToPlayer(trash, playerPositions[currentDealer], true);
      // After reshuffling, place the former trash back into the deck and reset
      // their z-indices so the top of the deck is always the highest within
      // the deck group (but still below any table cards).
      const deckCards = deck.current?.getCards() ?? [];
      deckCards.forEach((card, index) => {
        // This will give the deck a contiguous range like -N … -1, ensuring
        // it always sits above the trash (which we push further negative in
        // moveCardToTrash) but below any positive table z-indices.
        card.setZIndex(index - deckCards.length);
      });

      trash.forEach((card) => {
        card.setValue(null);
      });
    },
  });

  return <AnimatableCardDeck ref={deck} cardWidth={80} numCards={52} />;
}

async function moveCardToPlayer(
  playerPosition: PlayerPosition,
  card: AnimatedCard
): Promise<void> {
  const { rotation } = playerPosition;
  // the card should be 40px closer to the center of the table than the player's circle
  const centerX = playerPosition.x;
  const centerY = playerPosition.y;
  const diagonalDistance = 80;
  const angle = Math.atan2(centerY, centerX);
  const x = centerX - diagonalDistance * Math.cos(angle);
  const y = centerY - diagonalDistance * Math.sin(angle);
  const pairs = [
    [card.x, x],
    [card.y, y],
    [card.rotation, rotation],
    [card.scale, 1],
  ] as const;

  await Promise.all(
    pairs.map(
      ([value, toValue]) =>
        new Promise<void>((resolve) => {
          value.value = withTiming(toValue, { duration: 500 }, () => {
            resolve();
          });
        })
    )
  );
}

/**
 * Move the card to the left of its current position, relative to the player's perspective.
 * This makes room for the hit card to be placed in the original position.
 */
async function makeRoomForHitCard(
  card: AnimatedCard,
  playerPosition: PlayerPosition
) {
  // Calculate angle from center to player
  const angle = Math.atan2(playerPosition.y, playerPosition.x);

  // Calculate offset perpendicular to player angle (90 degrees = PI/2)
  // This gives us the "left" direction from the player's perspective
  const offsetAngle = angle + Math.PI / 2;

  // Move card 40px in that direction
  const offsetDistance = 20;
  const offsetX = offsetDistance * Math.cos(offsetAngle);
  const offsetY = offsetDistance * Math.sin(offsetAngle);

  const newX = card.x.value + offsetX;
  const newY = card.y.value + offsetY;

  const pairs = [
    [card.x, newX],
    [card.y, newY],
  ] as const;

  await Promise.all(
    pairs.map(
      ([value, toValue]) =>
        new Promise<void>((resolve) => {
          value.value = withTiming(toValue, { duration: 300 }, () => {
            resolve();
          });
        })
    )
  );
}

async function moveCardToTrash(card: AnimatedCard, index: number) {
  await card.ensureFaceDown();
  await Promise.all([
    new Promise<void>((resolve) => {
      card.x.value = withTiming(0, { duration: 300 }, () => {
        resolve();
      });
    }),
    new Promise<void>((resolve) => {
      card.y.value = withTiming(0, { duration: 300 }, () => {
        resolve();
      });
    }),
    new Promise<void>((resolve) => {
      card.rotation.value = withTiming(
        Math.floor(Math.random() * 18) - 9,
        { duration: 300 },
        () => {
          resolve();
        }
      );
    }),
    new Promise<void>((resolve) => {
      card.scale.value = withTiming(0.3, { duration: 300 }, () => {
        resolve();
      });
    }),
  ]);
  // After the animation completes (i.e., once the card has visually joined the
  // discard pile), push its z-index far below the deck so it never covers any
  // in-play card.
  card.setZIndex(-1000 - index);
}

function staggerPromises<T>(
  delay: number,
  promises: (() => Promise<T>)[]
): Promise<T[]> {
  return Promise.all(
    promises.map((promise, index) => {
      return new Promise<T>((resolve) => {
        setTimeout(() => promise().then(resolve), index * delay);
      });
    })
  );
}

function moveDeckNextToPlayer(
  deck: AnimatedCard[],
  playerPosition: PlayerPosition,
  stagger: boolean = false
): Promise<void[]> {
  // position the deck 60px diagonal from the center of the player's circle
  const centerX = playerPosition.x;
  const centerY = playerPosition.y;
  const diagonalDistance = 30;
  const angle = Math.atan2(centerY, centerX) - Math.PI / 2;
  const x = centerX + diagonalDistance * Math.cos(angle);
  const y = centerY + diagonalDistance * Math.sin(angle);

  function moveCard(card: AnimatedCard): Promise<void> {
    const pairs = [
      [card.x, x],
      [card.y, y],
      [
        card.rotation,
        playerPosition.rotation + Math.floor(Math.random() * 4) - 2,
      ],
      [card.scale, 0.3],
    ] as const;

    return Promise.all(
      pairs.map(
        ([value, toValue]) =>
          new Promise<void>((resolve) => {
            value.value = withTiming(toValue, { duration: 300 }, () => {
              resolve();
            });
          })
      )
    ).then(() => undefined);
  }

  return stagger
    ? staggerPromises<void>(
        20,
        deck.map((card) => () => moveCard(card))
      )
    : Promise.all(deck.map(moveCard));
}
