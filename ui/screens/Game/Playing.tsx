import { ActiveGame } from "@/functions/src/types";
import { useCurrentCard } from "@/hooks/useCurrentCard";
import { useUserId } from "@/providers/Auth";
import { Card } from "@/ui/components/Card";
import { PlayersList } from "@/ui/components/PlayerList";
import { Container, Text } from "@/ui/elements";
import React from "react";
import { PlayerControls } from "./PlayerControls";

export function GamePlaying(props: { game: ActiveGame }) {
  const { game } = props;
  const currentUserId = useUserId();
  const currentCard = useCurrentCard(game.gameId);

  if (!currentUserId) {
    return (
      <Container>
        <Text>Loading user...</Text>
      </Container>
    );
  }

  return (
    <Container style={{ flex: 1, padding: 16 }}>
      {/* Game Header */}
      <Container style={{ marginBottom: 48 }}>
        <Text size={24}>Game #{game.gameId}</Text>
        <Text size={16}>
          Round: {game.round} | State: {game.roundState}
        </Text>
        <Text size={14}>
          Dealer: {game.usernames[game.dealer]} | Active:{" "}
          {game.usernames[game.activePlayer]}
        </Text>
      </Container>

      {/* Players List */}

      <PlayersList game={game} currUserId={currentUserId} />

      {/* Current Player's Card */}
      <Container
        style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
      >
        <Card cardId={currentCard} width={120} height={180} />
      </Container>

      {/* Game Status */}
      <Container>
        <PlayerControls game={game} currUserId={currentUserId} />
      </Container>
    </Container>
  );
}
