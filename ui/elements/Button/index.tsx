import React, { useMemo } from "react";
import {
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

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[defaultStyles, style]}
      {...props}
    >
      {loading ? (
        <LoadingSpinner size="large" color="white" />
      ) : title ? (
        <Text style={titleStyle}>{title}</Text>
      ) : (
        children
      )}
    </TouchableOpacity>
  );
};

export default Button;
