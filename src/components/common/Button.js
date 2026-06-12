// src/components/common/Button.js
import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../styles/typography';

const { width: screenWidth } = Dimensions.get('window');

export default function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  width = screenWidth - 40,
  height = 56,
  variant = 'primary', // 'primary' (blue) or 'black'
  fontSize = 18,
  fontFamily = TYPOGRAPHY.fontFamily?.medium || 'System',
  borderRadius = 12,
  style,
  textStyle,
  hasShadow = true,
}) {
  // Get colors based on variant
  const getBackgroundColor = () => {
    if (disabled) return COLORS.primaryLight;
    if (variant === 'black') return '#000000';
    return COLORS.primary; // '#03045E'
  };

  const getTextColor = () => {
    if (variant === 'black') return '#FFFFFF';
    return COLORS.textWhite;
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          width: width,
          height: height,
          backgroundColor: getBackgroundColor(),
          borderRadius: borderRadius,
        },
        hasShadow && styles.shadow,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <Text
          style={[
            styles.text,
            {
              fontSize: fontSize,
              fontFamily: fontFamily,
              color: getTextColor(),
            },
            textStyle,
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontWeight: '600',
  },
  shadow: {
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
});