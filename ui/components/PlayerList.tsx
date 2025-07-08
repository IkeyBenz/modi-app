import { Game } from "@/functions/src/types";
import React, { useState } from "react";
import { LayoutChangeEvent, ViewStyle } from "react-native";
import { Container } from "../elements";
import { PlayerCircle } from "./PlayerCircle";

export interface PlayersListGame {
  players: string[];
  usernames: { [playerId: string]: string };
  playerLives?: { [playerId: string]: number };
  roundState?: "pre-deal" | "playing" | "tallying";
  round?: number;
}

export function PlayersList(props: { game: Game; currUserId: string }) {
  const { game, currUserId } = props;
  const { players } = game;
  const [containerSize, setContainerSize] = useState(300); // Default size

  // Find the index of the current user
  const currentUserIndex = players.indexOf(currUserId);

  // Calculate the rotation needed to move the current user to the bottom
  // Each player is positioned at (index * 360 / players.length) degrees
  // We want the current user at 90 degrees (bottom)
  const currentUserAngle = (currentUserIndex * 360) / players.length;
  const rotationDegrees = 90 - currentUserAngle;

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setContainerSize(Math.min(width, height));
  };

  // When gathering players, leave space for the player circles.
  // When playing, push them to the edge to make space for cards.
  const distanceFromEdge = game.status === "gathering-players" ? 60 : 0;

  // Calculate radius based on container size
  const radius = containerSize / 2 - distanceFromEdge; // Leave space for player circles

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
      {players.map((playerId, index) => {
        // Calculate angle with rotation already applied
        const baseAngle = (index * 2 * Math.PI) / players.length;
        const rotatedAngle = baseAngle + (rotationDegrees * Math.PI) / 180;
        const x = radius * Math.cos(rotatedAngle);
        const y = radius * Math.sin(rotatedAngle);

        const style: ViewStyle = {
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: [
            { translateX: x - 25 }, // 25 is half the player circle size
            { translateY: y - 25 },
          ],
        };

        // Calculate the absolute center position relative to the container
        // containerSize/2 + x, containerSize/2 + y
        const center = {
          x: containerSize / 2 + x,
          y: containerSize / 2 + y,
        };

        return (
          <PlayerCircle
            key={playerId}
            playerId={playerId}
            game={props.game}
            style={style}
            center={center}
          />
        );
      })}
    </Container>
  );
}
