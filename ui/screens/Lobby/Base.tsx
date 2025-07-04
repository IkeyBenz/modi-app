import React from "react";
import { KeyboardAvoidingView } from "react-native";

import { InitialGameState } from "@/functions/src/types";
import UsernameInput from "@/ui/components/UsernameInput";
import { Button, Container, Icon, ScreenContainer, Text } from "@/ui/elements";

export interface LobbyScreenProps {
  currUserId: string;
  game: InitialGameState;
  showUsernameInput: boolean;
  onInviteFriendsBtnPressed: () => void;
  onStartGameBtnPressed: () => void;
  onJoinGameBtnPressed: () => void;
  onBackBtnPressed: () => void;
}
const LobbyScreen: React.FC<LobbyScreenProps> = ({
  game,
  currUserId,
  showUsernameInput,
  onInviteFriendsBtnPressed,
  onStartGameBtnPressed,
  onJoinGameBtnPressed,
  onBackBtnPressed,
}) => (
  <ScreenContainer>
    <KeyboardAvoidingView
      behavior="height"
      style={{ flex: 1, padding: 8, paddingHorizontal: 16 }}
    >
      <Container style={{ flex: 1, justifyContent: "center", minHeight: 52 }}>
        <Container style={{ alignItems: "center" }}>
          <Text size={24}>Game PIN:</Text>
          <Text size={42}>{game.gameId}</Text>
          <Button color="red" onPress={onInviteFriendsBtnPressed} thin>
            <Text size={14}>Invite Friends</Text>
          </Button>
        </Container>
      </Container>

      <Container style={{ flex: 7, paddingVertical: 8 }}>
        {/* <PlayerList players={attendees} /> */}
      </Container>

      <Container
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          minHeight: 24,
        }}
      >
        <Button
          color="red"
          fullWidth
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
              <Text size={28}>Waiting for host to start the game...</Text>
            )
          ) : (
            <Button
              color="blue"
              onPress={onJoinGameBtnPressed}
              style={{ height: 64, marginRight: 0 }}
            >
              Join Game
            </Button>
          )}
        </Container>
      </Container>
      {showUsernameInput && <UsernameInput />}
    </KeyboardAvoidingView>
  </ScreenContainer>
);
export default LobbyScreen;
