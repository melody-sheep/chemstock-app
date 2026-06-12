// src/components/common/Button.js
import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import PropTypes from 'prop-types';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../styles/typography';

const { width: screenWidth } = Dimensions.get('window');

/**
 * Reusable Button Component
 * Supports primary (blue) and black variants with shadow option
 * 
 * @param {Object} props - Component props
 * @param {string} props.title - Button text content
 * @param {Function} props.onPress - Callback when button is pressed
 * @param {boolean} props.loading - Shows activity indicator when true
 * @param {boolean} props.disabled - Disables button interaction
 * @param {number} props.width - Button width (defaults to screen width - 40)
 * @param {number} props.height - Button height (default: 56)
 * @param {'primary'|'black'} props.variant - Color variant (default: 'primary')
 * @param {number} props.fontSize - Text size (default: 18)
 * @param {string} props.fontFamily - Font family (default: 'System')
 * @param {number} props.borderRadius - Border radius (default: 12)
 * @param {Object} props.style - Additional styles for button container
 * @param {Object} props.textStyle - Additional styles for button text
 * @param {boolean} props.hasShadow - Enable/disable shadow (default: true)
 */
export default function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  width = screenWidth - 40,
  height = 56,
  variant = 'primary',
  fontSize = 18,
  fontFamily = TYPOGRAPHY.fontFamily?.medium || 'System',
  borderRadius = 12,
  style,
  textStyle,
  hasShadow = true,
}) {
  // Get colors based on variant with error handling
  const getBackgroundColor = () => {
    try {
      if (disabled) return COLORS.primaryLight;
      if (variant === 'black') return '#000000';
      if (variant === 'primary') return COLORS.primary;
      // Fallback for invalid variant
      console.warn(`Invalid variant "${variant}" provided to Button. Using "primary".`);
      return COLORS.primary;
    } catch (error) {
      console.error('Error getting button background color:', error);
      return COLORS.primary;
    }
  };

  const getTextColor = () => {
    try {
      if (variant === 'black') return '#FFFFFF';
      return COLORS.textWhite;
    } catch (error) {
      console.error('Error getting button text color:', error);
      return '#FFFFFF';
    }
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
      accessibilityLabel={title}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
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

// PropTypes for type checking
Button.propTypes = {
  title: PropTypes.string.isRequired,
  onPress: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  disabled: PropTypes.bool,
  width: PropTypes.number,
  height: PropTypes.number,
  variant: PropTypes.oneOf(['primary', 'black']),
  fontSize: PropTypes.number,
  fontFamily: PropTypes.string,
  borderRadius: PropTypes.number,
  style: PropTypes.object,
  textStyle: PropTypes.object,
  hasShadow: PropTypes.bool,
};

// Default props
Button.defaultProps = {
  loading: false,
  disabled: false,
  width: screenWidth - 40,
  height: 56,
  variant: 'primary',
  fontSize: 18,
  fontFamily: TYPOGRAPHY.fontFamily?.medium || 'System',
  borderRadius: 12,
  hasShadow: true,
};

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