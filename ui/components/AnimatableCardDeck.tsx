import { CardID } from "@/functions/src/types";
import { Card, CardBack } from "@/ui/components/Card";
import React, { useImperativeHandle, useRef, useState } from "react";
import { Animated, StyleSheet } from "react-native";

export interface AnimatableCardDeckRef {
  setCardValues(values: { [cardIndex: number]: CardID | null }): void;
  getCardAnimationValues(): CardAnimatableProps[];
}

interface AnimatableCardDeckProps {
  cardWidth: number;
  numCards?: number;
}

/**
 * A deck of cards that can be animated however you want.
 * ```tsx
 * const deckRef = useRef<AnimatableCardDeckRef>(null);
 * <AnimatableCardDeck ref={deckRef} cardWidth={60} />
 * ```
 *
 * You can then use the ref to set the values of the cards:
 * ```tsx
 * deckRef.current?.setCardValues({
 *   0: "10H",
 *   1: "10D",
 *   2: "10C",
 *   3: "10S",
 * });
 * ```
 *
 * You can also access the animated values of each card to animate them as you please:
 * ```tsx
 * const cards = deckRef.current?.getCardAnimationValues();
 * if (!cards) return;
 * Animated.stagger(10, cards.map((card) => Animated.timing(card.x, {
 *   toValue: 100,
 *   duration: 20,
 *   useNativeDriver: true,
 * })).start();
 * ```
 */
export const AnimatableCardDeck = React.forwardRef<
  AnimatableCardDeckRef,
  AnimatableCardDeckProps
>(function AnimatableCardDeck(props, ref) {
  const { cardWidth, numCards = 52 } = props;
  const cards = useRef<CardAnimatableProps[]>(
    createInitialCardDeck(numCards)
  ).current;
  const cardRefs = useRef<React.RefObject<AnimatableCardRef>[]>(
    createCardRefs(numCards)
  ).current;

  useImperativeHandle(ref, () => ({
    setCardValues: (values: { [cardIndex: number]: CardID | null }) => {
      Object.entries(values).forEach(([index, value]) => {
        cardRefs[Number(index)].current.setValue(value);
      });
    },
    getCardAnimationValues: () => {
      return cards;
    },
  }));

  return (
    <>
      {cards.map((card, index) => (
        <AnimatableCard
          key={index}
          ref={cardRefs[index]}
          cardWidth={cardWidth}
          {...card}
        />
      ))}
    </>
  );
});

interface CardAnimatableProps {
  x: Animated.Value;
  y: Animated.Value;
  rotation: Animated.Value;
  backOpacity: Animated.Value;
  faceOpacity: Animated.Value;
  skew: Animated.Value;
  scale: Animated.Value;
}

interface AnimatableCardProps extends CardAnimatableProps {
  cardWidth: number;
}

interface AnimatableCardRef {
  setValue(value: CardID | null): void;
}

const AnimatableCard = React.forwardRef<AnimatableCardRef, AnimatableCardProps>(
  function AnimatableCard(props, ref) {
    const { cardWidth, x, y, rotation, backOpacity, faceOpacity, skew, scale } =
      props;
    const [value, setValue] = useState<CardID | null>(null);
    const width = cardWidth;
    const height = cardWidth * 1.4;
    useImperativeHandle(ref, () => ({ setValue }), [setValue]);

    return (
      <Animated.View
        style={{
          width,
          height,
          position: "absolute",
          transform: [
            { translateX: "-50%" },
            { translateY: "-50%" },
            { translateX: x },
            { translateY: y },
            {
              rotate: rotation.interpolate({
                inputRange: [0, 360],
                outputRange: ["0deg", "360deg"],
              }),
            },
            {
              skewX: skew.interpolate({
                inputRange: [0, 360],
                outputRange: ["0deg", "360deg"],
              }),
            },
            { scale: scale },
          ],
        }}
      >
        <Animated.View
          style={[{ opacity: backOpacity }, StyleSheet.absoluteFill]}
        >
          <CardBack width={width} height={height} />
        </Animated.View>
        <Animated.View
          style={[{ opacity: faceOpacity }, StyleSheet.absoluteFill]}
        >
          {value && <Card cardId={value} width={width} height={height} />}
        </Animated.View>
      </Animated.View>
    );
  }
);

function createInitialCardDeck(numCards: number): CardAnimatableProps[] {
  return Array.from({ length: numCards }, () => ({
    x: new Animated.Value(0),
    y: new Animated.Value(0),
    rotation: new Animated.Value(Math.floor(Math.random() * 4)),
    backOpacity: new Animated.Value(1),
    faceOpacity: new Animated.Value(0),
    skew: new Animated.Value(0),
    scale: new Animated.Value(1),
  }));
}

function createCardRefs(
  numCards: number
): React.RefObject<AnimatableCardRef>[] {
  return Array.from({ length: numCards }, () => ({
    current: { setValue: () => {} },
  }));
}
