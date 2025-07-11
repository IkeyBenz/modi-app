import { Container } from "@/ui/elements";
import React, { useState } from "react";
import { LayoutChangeEvent } from "react-native";
import { CardTableProvider } from "./context";

interface CardTableProps {
  children: React.ReactNode;
  onLayout?: (event: LayoutChangeEvent) => void;
}

export function CardTable({ children, onLayout }: CardTableProps) {
  const [radius, setRadius] = useState(0);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    const newRadius = Math.min(width, height) / 2;
    setRadius(newRadius);
    onLayout?.(event);
  };

  return (
    <Container
      color="white"
      style={{
        aspectRatio: 1,
        borderRadius: 999,
        maxWidth: 600,
        position: "relative",
      }}
      onLayout={handleLayout}
    >
      <CardTableProvider radius={radius}>
        {React.Children.map(children, (child) => (
          <Container
            style={{
              position: "absolute",
              transform: [{ translateX: radius }, { translateY: radius }],
            }}
          >
            {child}
          </Container>
        ))}
      </CardTableProvider>
    </Container>
  );
}

// Export all components and types for easy importing
export { AnimatedCards } from "./AnimatedCards";
export { CardDeck } from "./CardDeck";
export { useCardTable } from "./context";
export { useCardAnimations } from "./hooks/useCardAnimations";
export { PlayerCircles } from "./PlayerCircles";
export { DEFAULT_CARD_TABLE_CONFIG } from "./types";
export type {
  CardAnimationValue,
  CardPosition,
  CardsRef,
  CardTableConfig,
  Player,
  PlayerPosition,
} from "./types";
export {
  calculatePlayerPositions,
  degreesToRadians,
  radiansToDegrees,
} from "./utils";
