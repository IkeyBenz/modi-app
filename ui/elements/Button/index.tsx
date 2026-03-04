import _ from "lodash";
import * as Haptics from "expo-haptics";
import React, { useMemo, useRef } from "react";
import {
  Platform,
  StyleProp,
  TextStyle,
  TouchableOpacity,
  TouchableOpacityProps,
  ViewStyle,
} from "react-native";

import { LoadingSpinner } from "@/ui/elements/LoadingSpinner";
import Text from "@/ui/elements/Text";
import { ColorName, colors } from "@/ui/styles";

interface ButtonProps {
  color?: ColorName;
  title?: string;

  /** Defaults to true */
  fullWidth?: boolean;

  /** Custom styles for the title Text component */
  titleStyle?: StyleProp<TextStyle>;

  /** Lessens padding of button title. Default is false */
  thin?: boolean;

  /** Shows a loading spinner instead of children when true. Also disables the button. */
  loading?: boolean;

  /** Disable haptic feedback on press. Default is false (haptics enabled). */
  disableHaptics?: boolean;

  onPress(): void;
}

const Button: React.FC<ButtonProps & TouchableOpacityProps> = ({
  title,
  onPress,
  color,
  fullWidth,
  titleStyle,
  thin,
  children,
  style,
  loading,
  disableHaptics,
  ...props
}) => {
  const defaultStyles = useMemo<StyleProp<ViewStyle>>(
    () => ({
      backgroundColor: color ? colors[color] : undefined,
      padding: 16,
      paddingVertical: thin ? 6 : 16,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      flex: fullWidth ? 1 : undefined,
    }),
    [color, thin, fullWidth]
  );

  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;
  const handlePress = useMemo(() => {
    return _.throttle(() => {
      if (!disableHaptics && Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onPressRef.current?.();
    }, 600);
  }, [disableHaptics]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[defaultStyles, style]}
      disabled={loading}
      {...props}
    >
      {loading ? (
        <LoadingSpinner size="small" color="white" />
      ) : title ? (
        <Text style={titleStyle}>{title}</Text>
      ) : (
        children
      )}
    </TouchableOpacity>
  );
};

export default Button;
