import { Game } from "@/functions/src/types";
import React, { useEffect, useRef, useState } from "react";
import { Animated, LayoutChangeEvent, PanResponder, ViewStyle } from "react-native";
import { Container } from "../elements";
import { PlayerCircle } from "./PlayerCircle";
import { useSetPlayerOrder } from "@/hooks/useSetPlayerOrder";

export interface PlayersListGame {
  players: string[];
  usernames: { [playerId: string]: string };
  playerLives?: { [playerId: string]: number };
  roundState?: "pre-deal" | "playing" | "tallying";
  round?: number;
}

export function PlayersList(props: { game: Game; currUserId: string }) {
  const { currUserId } = props;
  const [containerSize, setContainerSize] = useState(300); // Default size
  const [center, setCenter] = useState({ x: 0, y: 0 });
  const [playerOrder, setPlayerOrderState] = useState(props.game.players);
  const { setPlayerOrder } = useSetPlayerOrder();

  const panValues = useRef<{ [id: string]: Animated.ValueXY }>({}).current;
  const panResponders = useRef<{ [id: string]: any }>({}).current;
  const dummyPan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  useEffect(() => {
    setPlayerOrderState(props.game.players);
  }, [props.game.players]);

  // Find the index of the current user
  const currentUserIndex = playerOrder.indexOf(currUserId);

  // Calculate the rotation needed to move the current user to the bottom
  // Each player is positioned at (index * 360 / players.length) degrees
  // We want the current user at 90 degrees (bottom)
  const currentUserAngle = (currentUserIndex * 360) / playerOrder.length;
  const rotationDegrees = 90 - currentUserAngle;

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height, x, y } = event.nativeEvent.layout;
    setContainerSize(Math.min(width, height));
    setCenter({ x: x + width / 2, y: y + height / 2 });
  };

  // Calculate radius based on container size
  const radius = containerSize / 2 - 60; // Leave space for player circles

  const isHost = props.game.host === currUserId;
  const segmentAngle = (2 * Math.PI) / playerOrder.length;
  const rotationRadians = (rotationDegrees * Math.PI) / 180;

  const reorder = (playerId: string, newIndex: number) => {
    setPlayerOrderState((prev) => {
      const oldIndex = prev.indexOf(playerId);
      if (oldIndex === newIndex || oldIndex === -1) return prev;
      const updated = [...prev];
      updated.splice(oldIndex, 1);
      updated.splice(newIndex, 0, playerId);
      setPlayerOrder(props.game.gameId, updated);
      return updated;
    });
  };

  const ensureResponder = (playerId: string) => {
    if (!isHost) return;
    if (!panValues[playerId]) {
      panValues[playerId] = new Animated.ValueXY();
      panResponders[playerId] = PanResponder.create({
        onStartShouldSetPanResponder: () => isHost,
        onPanResponderMove: Animated.event(
          [null, { dx: panValues[playerId].x, dy: panValues[playerId].y }],
          { useNativeDriver: false }
        ),
        onPanResponderRelease: (_, gesture) => {
          const absX = gesture.moveX - center.x;
          const absY = gesture.moveY - center.y;
          panValues[playerId].setValue({ x: 0, y: 0 });
          const angle = Math.atan2(absY, absX) - rotationRadians;
          let newIndex = Math.round(angle / segmentAngle);
          newIndex = ((newIndex % playerOrder.length) + playerOrder.length) % playerOrder.length;
          reorder(playerId, newIndex);
        },
      });
    }
  };

  return (
    <Container
      color="lightGreen"
      style={{
        flex: 1,
        maxWidth: 600,
        maxHeight: 600,
        aspectRatio: 1,
        alignSelf: "center",
        padding: 16,
        borderRadius: 999, // Make it circular
        position: "relative",
        alignItems: "center",
        justifyContent: "center",
        overflow: "visible",
      }}
      onLayout={handleLayout}
    >
      {playerOrder.map((playerId, index) => {
        // Calculate angle with rotation already applied
        const baseAngle = (index * 2 * Math.PI) / playerOrder.length;
        const rotatedAngle = baseAngle + (rotationDegrees * Math.PI) / 180;
        const x = radius * Math.cos(rotatedAngle);
        const y = radius * Math.sin(rotatedAngle);

        ensureResponder(playerId);
        const pan = panValues[playerId] ?? dummyPan;
        const style: ViewStyle = {
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: [
            { translateX: x - 25 }, // 25 is half the player circle size
            { translateY: y - 25 },
            { translateX: pan.x },
            { translateY: pan.y },
          ],
        };

        return (
          <PlayerCircle
            key={playerId}
            playerId={playerId}
            game={props.game}
            style={style}
            panHandlers={
              isHost && panResponders[playerId]
                ? panResponders[playerId].panHandlers
                : undefined
            }
          />
        );
      })}
    </Container>
  );
}
