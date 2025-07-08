import React from "react";
import { KeyboardAvoidingView } from "react-native";

import { InitialGame } from "@/functions/src/types";
import { PlayersList } from "@/ui/components/PlayerList";
import { Button, Container, Icon, Text } from "@/ui/elements";

export interface LobbyScreenProps {
  currUserId: string;
  game: InitialGame;
  /**
   * Typical native share interface for sharing the link to this game page.
   */
  onInviteFriendsBtnPressed: () => void;
  /**
   * For the host to begin the game.
   */
  onStartGameBtnPressed: () => void;
  /**
   * If you get to the game screen while its still gathering players, and you came here directly without going
   * through the join lobby screen, you'll be offered a button that let's you join the game directly from this screen.
   * In which case, this callback will be called.
   */
  onJoinGameBtnPressed: () => void;
  /**
   * Removes you from the game, if you're a part of it, and returns you to the home screen.
   */
  onBackBtnPressed: () => void;
}
const LobbyScreen: React.FC<LobbyScreenProps> = ({
  game,
  currUserId,
  onInviteFriendsBtnPressed,
  onStartGameBtnPressed,
  onJoinGameBtnPressed,
  onBackBtnPressed,
}) => (
  <KeyboardAvoidingView
    behavior="height"
    style={{ flex: 1, paddingTop: 32, gap: 16 }}
  >
    <Container style={{ justifyContent: "center" }}>
      <Container style={{ alignItems: "center" }}>
        <Text size={24}>Game PIN:</Text>
        <Text size={42}>{game.gameId}</Text>
        <Button color="red" onPress={onInviteFriendsBtnPressed} thin>
          <Text size={14}>Invite Friends</Text>
        </Button>
      </Container>
    </Container>

    <Container style={{ flex: 1, justifyContent: "center" }}>
      <Container style={{ aspectRatio: 1 }}>
        <PlayersList game={game} currUserId={currUserId} />
      </Container>
    </Container>

    <Container
      style={{
        flexDirection: "row",
        alignItems: "center",
        minHeight: 24,
      }}
    >
      <Button
        color="red"
        onPress={onBackBtnPressed}
        style={{ height: 64, width: 64, borderRadius: 32, marginRight: 16 }}
      >
        <Icon name="back" size={32} color="white" />
      </Button>

      <Container style={{ flex: 1 }}>
        {game.players.includes(currUserId) ? (
          game.host === currUserId ? (
            <Button
              color="blue"
              onPress={onStartGameBtnPressed}
              style={{ height: 64, marginRight: 0 }}
            >
              <Text size={28}>Start Game</Text>
            </Button>
          ) : (
            <Text>Waiting for host to start the game...</Text>
          )
        ) : (
          <Button
            color="blue"
            onPress={onJoinGameBtnPressed}
            style={{ height: 64, marginRight: 0 }}
          >
            <Text size={28}>Join Game</Text>
          </Button>
        )}
      </Container>
    </Container>
  </KeyboardAvoidingView>
);
export default LobbyScreen;
