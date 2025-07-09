import cardImgs from "@/ui/assets/images/cards";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Image, StyleSheet, View } from "react-native";
import { usePlayerPositionContext } from "./PlayerPositionContext";

// Action type for future animation triggers
export type Action = {
  type: "dealt-cards";
  dealerId: string;
  recipients: string[];
  cardCount: number;
};

interface CardAnimationLayerProps {
  dealerId: string;
  currentUserId: string;
  actions: Action[];
  onAnimationEnd?: (action: Action) => void;
  onCurrentUserCardReached?: () => void; // Callback for main card animation
}

interface AnimatedCardProps {
  cardId: string;
  startPos: { x: number; y: number };
  endPos: { x: number; y: number };
  rotation: number;
  onComplete: () => void;
  isCurrentUser: boolean;
}

const AnimatedCard: React.FC<AnimatedCardProps> = ({
  cardId,
  startPos,
  endPos,
  rotation,
  onComplete,
  isCurrentUser,
}) => {
  const translateX = useRef(new Animated.Value(startPos.x)).current;
  const translateY = useRef(new Animated.Value(startPos.y)).current;
  const scale = useRef(new Animated.Value(0.3)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(translateX, {
        toValue: endPos.x,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: endPos.y,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]);

    animation.start(() => {
      onComplete();
      if (isCurrentUser) {
        // Trigger main card animation when current user's card reaches destination
        // This will be handled by the parent component
      }
    });
  }, []);

  return (
    <Animated.View
      style={[
        styles.animatedCard,
        {
          position: "absolute",
          transform: [
            { translateX },
            { translateY },
            { scale },
            { rotate: `${rotation}deg` },
          ],
          opacity,
        },
      ]}
    >
      <Image source={cardImgs.back} style={styles.miniCard} />
    </Animated.View>
  );
};

export const CardAnimationLayer: React.FC<CardAnimationLayerProps> = ({
  dealerId,
  currentUserId,
  actions,
  onAnimationEnd,
  onCurrentUserCardReached,
}) => {
  const { getPlayerPositions } = usePlayerPositionContext();
  const playerPositions = getPlayerPositions();
  const [animatingCards, setAnimatingCards] = useState<
    {
      id: string;
      cardId: string;
      playerId: string;
      isCurrentUser: boolean;
    }[]
  >([]);
  const [completedCards, setCompletedCards] = useState<
    {
      id: string;
      cardId: string;
      playerId: string;
      position: { x: number; y: number };
      rotation: number;
    }[]
  >([]);

  // Mini deck position calculation
  const dealerPos = playerPositions[dealerId];
  const offset = { x: 40, y: 0 };
  const miniDeckPos = dealerPos
    ? { left: dealerPos.x + offset.x, top: dealerPos.y + offset.y }
    : null;

  const inwardOffset = 30;
  const angleToCenter =
    miniDeckPos &&
    (() => {
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
        return Math.atan2(avg.y - dealerPos.y, avg.x - dealerPos.x);
      }
      return 0;
    })();

  const angle = typeof angleToCenter === "number" ? angleToCenter : 0;
  const rightOfPlayerAngle = angle + Math.PI / 2;
  const adjustedMiniDeckPos = miniDeckPos
    ? {
        left: dealerPos.x + Math.cos(rightOfPlayerAngle) * inwardOffset,
        top: dealerPos.y + Math.sin(rightOfPlayerAngle) * inwardOffset,
      }
    : null;

  // Calculate rotation for mini deck
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

  // Handle new actions
  useEffect(() => {
    const newActions = actions.filter(
      (action) =>
        action.type === "dealt-cards" &&
        !animatingCards.some(
          (card) => card.id === `${action.type}-${action.dealerId}`
        )
    );

    newActions.forEach((action) => {
      if (action.type === "dealt-cards" && adjustedMiniDeckPos) {
        // Start dealing animation sequence
        const cardsToAnimate = action.recipients.map((playerId, index) => ({
          id: `${action.type}-${action.dealerId}-${index}`,
          cardId: `card-${index}`, // You might want to use actual card IDs
          playerId,
          isCurrentUser: playerId === currentUserId,
        }));

        setAnimatingCards((prev) => [...prev, ...cardsToAnimate]);

        // Animate cards in sequence
        cardsToAnimate.forEach((card, index) => {
          setTimeout(() => {
            setAnimatingCards((prev) => prev.filter((c) => c.id !== card.id));
          }, 800 + index * 200); // Stagger animations
        });
      }
    });
  }, [actions, adjustedMiniDeckPos, currentUserId]);

  // Calculate end position for a card (in front of player circle)
  const getCardEndPosition = (playerId: string) => {
    const playerPos = playerPositions[playerId];
    if (!playerPos) return null;

    // Calculate center of board
    const playerIds = Object.keys(playerPositions);
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

    // Direction from player to center
    const dx = avg.x - playerPos.x;
    const dy = avg.y - playerPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Position card in front of player (closer to center)
    const offsetDistance = 35; // Distance in front of player circle
    const ratio = offsetDistance / distance;

    return {
      x: playerPos.x + dx * ratio,
      y: playerPos.y + dy * ratio,
      rotation: (Math.atan2(dy, dx) * 180) / Math.PI + 90,
    };
  };

  return (
    <>
      {/* Mini Deck */}
      {adjustedMiniDeckPos && (
        <Image
          source={cardImgs.back}
          style={[
            styles.miniDeck,
            {
              position: "absolute",
              left: adjustedMiniDeckPos.left - 15,
              top: adjustedMiniDeckPos.top - 21,
              transform: [{ rotate: `${rotationDeg}deg` }],
              width: 30,
              height: 42,
            },
          ]}
        />
      )}

      {/* Animated Cards */}
      {animatingCards.map((card) => {
        const endPos = getCardEndPosition(card.playerId);
        if (!endPos || !adjustedMiniDeckPos) return null;

        return (
          <AnimatedCard
            key={card.id}
            cardId={card.cardId}
            startPos={{
              x: adjustedMiniDeckPos.left - 15,
              y: adjustedMiniDeckPos.top - 21,
            }}
            endPos={{ x: endPos.x - 15, y: endPos.y - 21 }}
            rotation={endPos.rotation}
            onComplete={() => {
              setCompletedCards((prev) => [
                ...prev,
                {
                  id: card.id,
                  cardId: card.cardId,
                  playerId: card.playerId,
                  position: { x: endPos.x - 15, y: endPos.y - 21 },
                  rotation: endPos.rotation,
                },
              ]);
              if (card.isCurrentUser && onCurrentUserCardReached) {
                onCurrentUserCardReached();
              }
            }}
            isCurrentUser={card.isCurrentUser}
          />
        );
      })}

      {/* Completed Cards (static) */}
      {completedCards.map((card) => (
        <View
          key={card.id}
          style={[
            styles.completedCard,
            {
              position: "absolute",
              left: card.position.x,
              top: card.position.y,
              transform: [{ rotate: `${card.rotation}deg` }],
            },
          ]}
        >
          <Image source={cardImgs.back} style={styles.miniCard} />
        </View>
      ))}
    </>
  );
};

const styles = StyleSheet.create({
  miniDeck: {
    width: 30,
    height: 42,
    zIndex: 100,
  },
  animatedCard: {
    zIndex: 200,
  },
  miniCard: {
    width: 25,
    height: 35,
  },
  completedCard: {
    zIndex: 150,
  },
});
