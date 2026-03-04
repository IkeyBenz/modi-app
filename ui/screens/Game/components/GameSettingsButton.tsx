import type { InitialGame } from "@/api/src/types";
import { useHaptics } from "@/hooks/useHaptics";
import { useUpdateGameSettings } from "@/hooks/useUpdateGameSettings";
import { SettingsModal } from "@/ui/components/SettingsModal";
import { Icon, Text } from "@/ui/elements";
import { colors } from "@/ui/styles";
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

interface GameSettingsButtonProps {
  game: InitialGame;
}

export function GameSettingsButton({ game }: GameSettingsButtonProps) {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const { updateSettings, isUpdating } = useUpdateGameSettings();
  const [localLives, setLocalLives] = useState(game.initialLives);
  const { trigger } = useHaptics();

  const handleLivesChange = (newValue: number) => {
    if (newValue < 1 || newValue > 5) return;
    trigger("selection");
    setLocalLives(newValue);
    updateSettings({ gameId: game.gameId, initialLives: newValue });
  };

  return (
    <>
      <Pressable
        onPress={() => {
          trigger("light");
          setIsModalVisible(true);
        }}
        style={styles.settingsButton}
      >
        <Icon name="settings" size={22} color={colors.white} />
      </Pressable>

      <SettingsModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        title="Game Settings"
      >
        <View style={styles.settingCard}>
          <View style={styles.settingHeader}>
            <Text style={styles.settingLabel}>Starting Lives</Text>
            <Text style={styles.settingDescription}>
              How many lives each player begins with
            </Text>
          </View>

          <View style={styles.stepper}>
            <Pressable
              onPress={() => handleLivesChange(localLives - 1)}
              style={({ pressed }) => [
                styles.stepperButton,
                localLives <= 1 && styles.stepperButtonDisabled,
                pressed && !isUpdating && localLives > 1 && styles.stepperButtonPressed,
              ]}
              disabled={localLives <= 1 || isUpdating}
            >
              <Text size={28} style={styles.stepperButtonText}>
                −
              </Text>
            </Pressable>

            <View style={styles.stepperValueContainer}>
              <Text size={36} style={styles.stepperValue}>
                {localLives}
              </Text>
            </View>

            <Pressable
              onPress={() => handleLivesChange(localLives + 1)}
              style={({ pressed }) => [
                styles.stepperButton,
                localLives >= 5 && styles.stepperButtonDisabled,
                pressed && !isUpdating && localLives < 5 && styles.stepperButtonPressed,
              ]}
              disabled={localLives >= 5 || isUpdating}
            >
              <Text size={28} style={styles.stepperButtonText}>
                +
              </Text>
            </Pressable>
          </View>
        </View>
      </SettingsModal>
    </>
  );
}

const styles = StyleSheet.create({
  settingsButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.gray,
    alignItems: "center",
    justifyContent: "center",
  },
  settingCard: {
    backgroundColor: "rgba(0, 0, 0, 0.15)",
    borderRadius: 16,
    padding: 20,
    gap: 20,
  },
  settingHeader: {
    gap: 4,
  },
  settingLabel: {
    color: colors.white,
    fontSize: 18,
    fontWeight: "600",
  },
  settingDescription: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 14,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  stepperButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperButtonPressed: {
    backgroundColor: colors.lightGreen,
    transform: [{ scale: 0.95 }],
  },
  stepperButtonDisabled: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  stepperButtonText: {
    color: colors.white,
    lineHeight: 32,
  },
  stepperValueContainer: {
    minWidth: 72,
    alignItems: "center",
  },
  stepperValue: {
    color: colors.white,
  },
});
