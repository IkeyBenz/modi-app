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

  // Offset for mini deck (move it closer to the center of the board, ahead of the player circle)
  // We'll use a smaller offset and shrink the card size
  const inwardOffset = 30; // move toward center
  const angleToCenter =
    miniDeckPos &&
    (() => {
      // Calculate center of board as average of all player positions
      const playerIds = Object.keys(playerPositions);
      if (playerIds.length > 0) {
        const avg = playerIds.reduce(
          (acc, id) => {
            acc.x += playerPositions[id].x;
            acc.y += playerPositions[id].y;
            return acc;
          },
          { x: 0, y: 0 }
        );
        avg.x /= playerIds.length;
        avg.y /= playerIds.length;
        // Angle from dealer to center
        return Math.atan2(avg.y - dealerPos.y, avg.x - dealerPos.x);
      }
      return 0;
    })();

  // New mini deck position: move to the right of the player circle (from the perspective of the player facing the center)
  // This means offsetting by 90 degrees clockwise from the direction to the center
  const angle = typeof angleToCenter === "number" ? angleToCenter : 0;
  const rightOfPlayerAngle = angle + Math.PI / 2; // 90 degrees clockwise
  const adjustedMiniDeckPos = miniDeckPos
    ? {
        left: dealerPos.x + Math.cos(rightOfPlayerAngle) * inwardOffset,
        top: dealerPos.y + Math.sin(rightOfPlayerAngle) * inwardOffset,
      }
    : null;

  // Calculate rotation so the top of the card faces the center of the board
  let rotationDeg = 0;
  if (adjustedMiniDeckPos) {
    const playerIds = Object.keys(playerPositions);
    if (playerIds.length > 0) {
      const avg = playerIds.reduce(
        (acc, id) => {
          acc.x += playerPositions[id].x;
          acc.y += playerPositions[id].y;
          return acc;
        },
        { x: 0, y: 0 }
      );
      avg.x /= playerIds.length;
      avg.y /= playerIds.length;
      const dx = avg.x - adjustedMiniDeckPos.left;
      const dy = avg.y - adjustedMiniDeckPos.top;
      rotationDeg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    }
  }

  return (
    <>
      {adjustedMiniDeckPos && (
        <Image
          source={cardImgs.back}
          style={[
            styles.miniDeck,
            {
              position: "absolute",
              left: adjustedMiniDeckPos.left - 15, // Center the image (smaller card)
              top: adjustedMiniDeckPos.top - 21,
              transform: [{ rotate: `${rotationDeg}deg` }],
              width: 30,
              height: 42,
            },
          ]}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  miniDeck: {
    width: 30,
    height: 42,
    zIndex: 100,
  },
});
