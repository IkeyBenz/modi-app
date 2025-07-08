import cardImgs from "@/ui/assets/images/cards";
import React from "react";
import { Image, StyleSheet } from "react-native";
import { usePlayerPositionContext } from "./PlayerPositionContext";

// Action type for future animation triggers
export type Action = {
  type: "dealt-cards";
  dealerId: string;
  recipients: string[];
  cardCount: number;
};
// Add more action types as needed

interface CardAnimationLayerProps {
  dealerId: string;
  actions: Action[];
  onAnimationEnd?: (action: Action) => void;
}

export const CardAnimationLayer: React.FC<CardAnimationLayerProps> = ({
  dealerId,
}) => {
  const { getPlayerPositions } = usePlayerPositionContext();
  const playerPositions = getPlayerPositions();

  // Mini deck position: next to dealer's position, if available
  const dealerPos = playerPositions[dealerId];
  // Offset for mini deck (e.g., to the right of the dealer)
  const offset = { x: 40, y: 0 };
  const miniDeckPos = dealerPos
    ? { left: dealerPos.x + offset.x, top: dealerPos.y + offset.y }
    : null;

  return (
    <>
      {miniDeckPos && (
        <Image
          source={cardImgs.back}
          style={[
            styles.miniDeck,
            {
              position: "absolute",
              left: miniDeckPos.left - 25, // Center the image
              top: miniDeckPos.top - 35,
            },
          ]}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  miniDeck: {
    width: 50,
    height: 70,
    zIndex: 100,
  },
});
