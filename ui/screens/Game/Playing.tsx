import { ActiveGame } from "@/functions/src/types";
import { useCurrentCard } from "@/hooks/useCurrentCard";
import { useUserId } from "@/providers/Auth";
import { Card } from "@/ui/components/Card";
import { CardAnimationLayer } from "@/ui/components/CardAnimationLayer";
import { PlayersList } from "@/ui/components/PlayerList";
import { Container, Text } from "@/ui/elements";
import React, { useRef, useState } from "react";
import { Animated, Dimensions } from "react-native";
import { PlayerPositionProvider } from "../../components/PlayerPositionContext";
import { PlayerControls } from "./PlayerControls";

const { width: screenWidth } = Dimensions.get("window");

export function GamePlaying(props: { game: ActiveGame }) {
  const { game } = props;
  const currentUserId = useUserId();
  const currentCard = useCurrentCard(game.gameId);
  const [isMainCardAnimating, setIsMainCardAnimating] = useState(false);
  const mainCardTranslateX = useRef(new Animated.Value(screenWidth)).current;
  const mainCardScale = useRef(new Animated.Value(0.8)).current;
  const mainCardOpacity = useRef(new Animated.Value(0)).current;

  // Reset animation values when card changes
  React.useEffect(() => {
    if (currentCard) {
      mainCardTranslateX.setValue(screenWidth);
      mainCardScale.setValue(0.8);
      mainCardOpacity.setValue(0);
    }
  }, [currentCard]);

  if (!currentUserId) {
    return (
      <Container>
        <Text>Loading user...</Text>
      </Container>
    );
  }

  const handleCurrentUserCardReached = () => {
    setIsMainCardAnimating(true);

    // Animate main card in from the right
    Animated.parallel([
      Animated.timing(mainCardTranslateX, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(mainCardScale, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(mainCardOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsMainCardAnimating(false);
    });
  };

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

      {/* Players List + Animation Overlay */}
      <PlayerPositionProvider>
        <Container
          style={{
            flex: 1,
            position: "relative",
            aspectRatio: 1,
            maxWidth: 600,
            maxHeight: 600,
            alignSelf: "center",
          }}
        >
          <PlayersList game={game} currUserId={currentUserId} />
          <CardAnimationLayer
            dealerId={game.dealer}
            currentUserId={currentUserId}
            actions={[]}
            onCurrentUserCardReached={handleCurrentUserCardReached}
          />
        </Container>
      </PlayerPositionProvider>

      {/* Current Player's Card */}
      <Container
        style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
      >
        <Animated.View
          style={{
            transform: [
              { translateX: mainCardTranslateX },
              { scale: mainCardScale },
            ],
            opacity: mainCardOpacity,
          }}
        >
          <Card cardId={currentCard} width={120} height={180} />
        </Animated.View>
      </Container>

      {/* Game Status */}
      <Container>
        <PlayerControls game={game} currUserId={currentUserId} />
      </Container>
    </Container>
  );
}
