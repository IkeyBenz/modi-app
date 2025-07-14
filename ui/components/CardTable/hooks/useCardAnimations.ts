import { useCallback } from "react";
import { Animated } from "react-native";
import { useCardTable } from "../context";
import { CARD_TABLE_CONFIG, CardAnimationValue, PlayerPosition } from "../types";
import { degreesToRadians } from "../utils";

// Accepts cardAnimationValues from AnimatableCardDeck
export function useAnimatableCardDeckAnimations(cardAnimationValues: CardAnimationValue[]) {
  const { playerPositions } = useCardTable();

  const dealCards = useCallback(
    (toPlayers: string[], deckPosition: PlayerPosition | null) => {
      if (!deckPosition || !cardAnimationValues) return;
      // Animate each card from deckPosition to player position
      const animations: Animated.CompositeAnimation[] = toPlayers.map((playerId, i) => {
        const card = cardAnimationValues[i];
        const playerPos = playerPositions[playerId];
        if (!card || !playerPos) return null;
        const toX =
          playerPos.x +
          Math.cos(degreesToRadians(playerPos.rotation - 90)) *
            CARD_TABLE_CONFIG.cardDistanceFromPlayer;
        const toY =
          playerPos.y +
          Math.sin(degreesToRadians(playerPos.rotation - 90)) *
            CARD_TABLE_CONFIG.cardDistanceFromPlayer;
        const toRotation = playerPos.rotation;
        return Animated.parallel([
          Animated.timing(card.x, {
            toValue: toX,
            duration: CARD_TABLE_CONFIG.dealAnimationDuration,
            useNativeDriver: true,
          }),
          Animated.timing(card.y, {
            toValue: toY,
            duration: CARD_TABLE_CONFIG.dealAnimationDuration,
            useNativeDriver: true,
          }),
          Animated.timing(card.rotation, {
            toValue: toRotation,
            duration: CARD_TABLE_CONFIG.dealAnimationDuration,
            useNativeDriver: true,
          }),
        ]);
      }).filter((a): a is Animated.CompositeAnimation => a !== null);
      if (animations.length > 0) {
        Animated.stagger(CARD_TABLE_CONFIG.dealStaggerDelay, animations).start();
      }
    },
    [cardAnimationValues, playerPositions]
  );

  const swapCards = useCallback(
    (player1: string, player2: string) => {
      if (!cardAnimationValues) return;
      const player1Index = cardAnimationValues.findIndex(
        (c: CardAnimationValue) => c.playerId === player1
      );
      const player2Index = cardAnimationValues.findIndex(
        (c: CardAnimationValue) => c.playerId === player2
      );
      if (player1Index === -1 || player2Index === -1) return;
      const card1 = cardAnimationValues[player1Index];
      const card2 = cardAnimationValues[player2Index];
      if (!card1 || !card2) return;
      const pos1 = playerPositions[player1];
      const pos2 = playerPositions[player2];
      if (!pos1 || !pos2) return;
      const toX1 =
        pos2.x +
        Math.cos(degreesToRadians(pos2.rotation - 90)) * CARD_TABLE_CONFIG.cardDistanceFromPlayer;
      const toY1 =
        pos2.y +
        Math.sin(degreesToRadians(pos2.rotation - 90)) * CARD_TABLE_CONFIG.cardDistanceFromPlayer;
      const toRot1 = pos2.rotation;
      const toX2 =
        pos1.x +
        Math.cos(degreesToRadians(pos1.rotation - 90)) * CARD_TABLE_CONFIG.cardDistanceFromPlayer;
      const toY2 =
        pos1.y +
        Math.sin(degreesToRadians(pos1.rotation - 90)) * CARD_TABLE_CONFIG.cardDistanceFromPlayer;
      const toRot2 = pos1.rotation;
      Animated.parallel([
        Animated.parallel([
          Animated.timing(card1.x, {
            toValue: toX1,
            duration: CARD_TABLE_CONFIG.swapAnimationDuration,
            useNativeDriver: true,
          }),
          Animated.timing(card1.y, {
            toValue: toY1,
            duration: CARD_TABLE_CONFIG.swapAnimationDuration,
            useNativeDriver: true,
          }),
          Animated.timing(card1.rotation, {
            toValue: toRot1,
            duration: CARD_TABLE_CONFIG.swapAnimationDuration,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(card2.x, {
            toValue: toX2,
            duration: CARD_TABLE_CONFIG.swapAnimationDuration,
            useNativeDriver: true,
          }),
          Animated.timing(card2.y, {
            toValue: toY2,
            duration: CARD_TABLE_CONFIG.swapAnimationDuration,
            useNativeDriver: true,
          }),
          Animated.timing(card2.rotation, {
            toValue: toRot2,
            duration: CARD_TABLE_CONFIG.swapAnimationDuration,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    },
    [cardAnimationValues, playerPositions]
  );

  const trashCards = useCallback(() => {
    if (!cardAnimationValues) return;
    const animations: Animated.CompositeAnimation[] = cardAnimationValues.map(({ x, y, rotation }: CardAnimationValue) =>
      Animated.parallel([
        Animated.timing(x, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(y, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(rotation, {
          toValue: Math.floor(Math.random() * 20),
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );
    Animated.stagger(200, animations).start();
  }, [cardAnimationValues]);

  // Placeholder for revealCards
  const revealCards = useCallback((playerCards: { [playerId: string]: string }) => {
    // Implement as needed
  }, []);

  return {
    dealCards,
    swapCards,
    trashCards,
    revealCards,
  };
} 