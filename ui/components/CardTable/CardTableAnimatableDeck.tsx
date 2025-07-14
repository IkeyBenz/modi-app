import { useGameActions } from "@/hooks/useGameActions";
import {
  AnimatableCardDeck,
  AnimatableCardDeckRef,
} from "@/ui/components/AnimatableCardDeck";
import { useActiveGame } from "@/ui/screens/Game/PlayingContext";
import React, { useEffect, useRef } from "react";

export function AnimatedCards() {
  const { game } = useActiveGame();
  const deck = useRef<AnimatableCardDeckRef>(null);

  // Hook into live game actions
  useGameActions(game.gameId, {
    dealCards: (toPlayers) => {
      deck.current?.dealCards(toPlayers);
    },
  });

  // Map of playerId to card index
  const playerCards = useRef<{ [playerId: string]: number | null }>({}).current;

  // Initial render
  useEffect(() => {
    const cards = deck.current?.getCardAnimationValues();
    if (!cards) return;
    const animations = cards.map((card) => {
      return Animated.timing(card.x, {
        toValue: 0,
        duration: 1000,
      });
    });
  }, []);

  return <AnimatableCardDeck ref={deck} cardWidth={20} numCards={52} />;
}
