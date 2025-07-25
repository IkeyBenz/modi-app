import { Game, isWaitingForPlayers } from "@/functions/src/types";
import React, { useEffect, useState } from "react";
import { TouchableOpacity, ViewStyle } from "react-native";
import { Container, Text } from "../elements";

export interface PlayerCircleProps {
  playerId: string;
  game: Game;
  style: ViewStyle;
  /**
   * Optional pan handlers to allow the circle to be dragged.
   */
  panHandlers?: any;
}

export function PlayerCircle({ playerId, game, style, panHandlers }: PlayerCircleProps) {
  return (
    <PlayerCircleWrapper game={game} style={style} playerId={playerId} panHandlers={panHandlers}>
      <Container
        color="gray"
        style={{
          padding: 8,
          borderRadius: 25,
          width: 50,
          height: 50,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text>{game.usernames[playerId].slice(0, 2)}</Text>
      </Container>
    </PlayerCircleWrapper>
  );
}

function PlayerCircleWrapper(
  props: React.PropsWithChildren<{
    game: Game;
    children: React.ReactNode;
    style: ViewStyle;
    playerId: string;
    panHandlers?: any;
  }>
) {
  const { game, children, style, playerId, panHandlers } = props;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isWaitingForPlayers(game)) return;
    const { roundState, round } = game;
    if (!roundState || !round) return;
    if (roundState !== "playing" && round > 1) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [game]);

  if (isWaitingForPlayers(game))
    return <Container style={style}>{children}</Container>;
  const { playerLives, usernames } = game;
  const lives = playerLives[playerId];
  const username = usernames[playerId];

  return (
    <TouchableOpacity
      key={playerId}
      onPress={() => setOpen((curr) => !curr)}
      activeOpacity={0.8}
      style={style}
      {...panHandlers}
    >
      {children}
      {open && lives !== undefined && (
        <Container
          color="gray"
          style={{
            position: "absolute",
            bottom: 60,
            left: "50%",
            transform: [{ translateX: -40 }],
            padding: 6,
            borderRadius: 6,
            alignItems: "center",
          }}
        >
          <Text size={12}>{username}</Text>
          <Text size={12}>❤️ {lives}</Text>
        </Container>
      )}
    </TouchableOpacity>
  );
}
