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
  width = screenWidth - 40, // Responsive: full width minus 40px padding
  height = 56,               // Adjusted for compact frame
  backgroundColor = COLORS.primary,
  textColor = COLORS.textWhite,
  fontSize = 18,
  fontFamily = TYPOGRAPHY.fontFamily.medium,
  borderRadius = 0,
  style,
  textStyle,
}) {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          width: width,
          height: height,
          backgroundColor: disabled ? COLORS.primaryLight : backgroundColor,
          borderRadius: borderRadius,
        },
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <Text
          style={[
            styles.text,
            {
              fontSize: fontSize,
              fontFamily: fontFamily,
              color: textColor,
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
    fontWeight: '500', // Medium weight
  },
});