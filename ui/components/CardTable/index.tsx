import { Container } from "@/ui/elements";
import React, { useState } from "react";
import { LayoutChangeEvent } from "react-native";
import { CardTableProvider } from "./context";

interface CardTableProps {
  children: React.ReactNode;
}

export function CardTable({ children }: CardTableProps) {
  const [radius, setRadius] = useState(0);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    const newRadius = Math.min(width, height) / 2;
    newRadius && setRadius(newRadius);
  };

  return (
    <Container
      color="white"
      style={{
        aspectRatio: 1,
        borderRadius: 999,
        maxWidth: 600,
        maxHeight: 600,
        position: "relative",
        margin: 24, // absolutely positioned player circles exceed bounds of the card table
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
