// src/components/common/Button.js
import React from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import PropTypes from 'prop-types';
import Icon from './Icon';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../styles/typography';
import { SPACING } from '../../styles/spacing';

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
 * @param {number} props.width - Button width (defaults to screen width minus the standard SPACING.lg screen padding on both sides)
 * @param {number} props.height - Button height (default: 48)
 * @param {'primary'|'black'} props.variant - Color variant (default: 'primary')
 * @param {number} props.fontSize - Text size (default: 18)
 * @param {string} props.fontFamily - Font family (default: 'System')
 * @param {number} props.borderRadius - Border radius (default: 12)
 * @param {Object} props.style - Additional styles for button container
 * @param {Object} props.textStyle - Additional styles for button text
 * @param {boolean} props.hasShadow - Enable/disable shadow (default: false)
 */
export default function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  width = screenWidth - SPACING.lg * 2,
  height = 48,
  variant = 'primary',
  fontSize = 18,
  fontFamily = TYPOGRAPHY.fontFamily?.medium || 'System',
  borderRadius = 12,
  icon = null,
  iconPosition = 'left',
  iconWeight = 'regular',
  iconSize = 20,
  style,
  textStyle,
  hasShadow = false,
}) {
  // Get colors based on variant with error handling
  const getBackgroundColor = () => {
    try {
      if (disabled) return COLORS.primaryLight;
      if (variant === 'black') return '#000000';
      if (variant === 'outline') return '#FFFFFF';
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
      if (variant === 'outline') return COLORS.primary;
      return COLORS.textWhite;
    } catch (error) {
      console.error('Error getting button text color:', error);
      return '#FFFFFF';
    }
  };

  const getBorderStyle = () => {
    if (variant === 'outline') {
      return { borderWidth: 1.5, borderColor: disabled ? COLORS.primaryLight : COLORS.primary };
    }
    return null;
  };

  const textColor = getTextColor();

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          width: width,
          height: height,
          backgroundColor: getBackgroundColor(),
          borderRadius: borderRadius,
          ...Platform.select({
            web: {
              cursor: disabled || loading ? 'not-allowed' : 'pointer',
            },
          }),
        },
        getBorderStyle(),
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
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <View style={styles.content}>
          {icon && iconPosition === 'left' && (
            <Icon name={icon} size={iconSize} color={textColor} weight={iconWeight} style={styles.iconLeft} />
          )}
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
          {icon && iconPosition === 'right' && (
            <Icon name={icon} size={iconSize} color={textColor} weight={iconWeight} style={styles.iconRight} />
          )}
        </View>
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
  variant: PropTypes.oneOf(['primary', 'black', 'outline']),
  fontSize: PropTypes.number,
  fontFamily: PropTypes.string,
  borderRadius: PropTypes.number,
  icon: PropTypes.string,
  iconPosition: PropTypes.oneOf(['left', 'right']),
  iconWeight: PropTypes.oneOf(['thin', 'light', 'regular', 'bold', 'fill', 'duotone']),
  iconSize: PropTypes.number,
  style: PropTypes.object,
  textStyle: PropTypes.object,
  hasShadow: PropTypes.bool,
};

const styles = StyleSheet.create({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease',
      },
    }),
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '600',
  },
  iconLeft: {
    marginRight: SPACING.sm,
  },
  iconRight: {
    marginLeft: SPACING.sm,
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
    ...Platform.select({
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
      },
    }),
  },
});