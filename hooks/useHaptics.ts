import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";

type HapticStyle = "light" | "medium" | "heavy" | "success" | "warning" | "error" | "selection";

/**
 * Unified haptics hook that works across native (expo-haptics) and mobile web (web-haptics).
 *
 * Usage:
 *   const { trigger } = useHaptics();
 *   <Button onPress={() => { trigger("light"); doStuff(); }} />
 *
 * Or use the convenience wrapper:
 *   const { withHaptics } = useHaptics();
 *   <Button onPress={withHaptics(() => doStuff())} />
 */
export function useHaptics() {
  const webHapticsRef = useRef<any>(null);

  // Lazily initialize web-haptics on web platform
  useEffect(() => {
    if (Platform.OS === "web") {
      import("web-haptics").then(({ WebHaptics }) => {
        webHapticsRef.current = new WebHaptics();
      }).catch(() => {
        // web-haptics not available, silently degrade
      });

      return () => {
        webHapticsRef.current?.destroy();
        webHapticsRef.current = null;
      };
    }
  }, []);

  const trigger = useCallback(async (style: HapticStyle = "light") => {
    if (Platform.OS === "web") {
      // Map our styles to web-haptics presets
      const webMap: Record<HapticStyle, string | number> = {
        light: 10,
        medium: 30,
        heavy: 50,
        success: "success",
        warning: "nudge",
        error: "error",
        selection: 8,
      };
      webHapticsRef.current?.trigger(webMap[style]);
      return;
    }

    // Native: use expo-haptics
    try {
      const Haptics = await import("expo-haptics");

      switch (style) {
        case "light":
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case "medium":
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case "heavy":
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
        case "success":
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case "warning":
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          break;
        case "error":
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
        case "selection":
          await Haptics.selectionAsync();
          break;
      }
    } catch {
      // expo-haptics not available, silently degrade
    }
  }, []);

  const withHaptics = useCallback(
    (fn: () => void, style: HapticStyle = "light") => {
      return () => {
        trigger(style);
        fn();
      };
    },
    [trigger]
  );

  return { trigger, withHaptics };
}
