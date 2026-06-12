// src/components/common/Card.js
import React from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
} from 'react-native';
import PropTypes from 'prop-types';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';

const { width: screenWidth } = Dimensions.get('window');

/**
 * Reusable Card Component
 * Secondary frame with full width, custom background, border, and height based on content
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Content inside the card
 * @param {string} props.backgroundColor - Card background color (default: '#F7FEFF')
 * @param {string} props.borderColor - Border color (default: '#4CF294')
 * @param {number} props.borderWidth - Border width (default: 0.5)
 * @param {number} props.borderRadius - Border radius (default: 12)
 * @param {number} props.paddingHorizontal - Horizontal padding (default: SPACING.lg)
 * @param {number} props.paddingVertical - Vertical padding (default: SPACING.lg)
 * @param {boolean} props.hasShadow - Show shadow (default: false)
 * @param {number} props.marginTop - Top margin (default: 0)
 * @param {number} props.marginBottom - Bottom margin (default: 0)
 * @param {number} props.marginHorizontal - Horizontal margin (default: SPACING.lg)
 * @param {Object} props.style - Additional styles
 */
export default function Card({
  children,
  backgroundColor = '#F7FEFF',
  borderColor = '#4CF294',
  borderWidth = 0.5,
  borderRadius = 12,
  paddingHorizontal = SPACING.lg,
  paddingVertical = SPACING.lg,
  hasShadow = false,
  marginTop = 0,
  marginBottom = 0,
  marginHorizontal = SPACING.lg,
  style,
}) {
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: backgroundColor,
          borderColor: borderColor,
          borderWidth: borderWidth,
          borderRadius: borderRadius,
          paddingHorizontal: paddingHorizontal,
          paddingVertical: paddingVertical,
          marginTop: marginTop,
          marginBottom: marginBottom,
          marginHorizontal: marginHorizontal,
          width: screenWidth - (marginHorizontal * 2),
        },
        hasShadow && styles.shadow,
        style,
      ]}
    >
      {children}
    </View>
  );
}

Card.propTypes = {
  children: PropTypes.node.isRequired,
  backgroundColor: PropTypes.string,
  borderColor: PropTypes.string,
  borderWidth: PropTypes.number,
  borderRadius: PropTypes.number,
  paddingHorizontal: PropTypes.number,
  paddingVertical: PropTypes.number,
  hasShadow: PropTypes.bool,
  marginTop: PropTypes.number,
  marginBottom: PropTypes.number,
  marginHorizontal: PropTypes.number,
  style: PropTypes.object,
};

Card.defaultProps = {
  backgroundColor: '#F7FEFF',
  borderColor: '#4CF294',
  borderWidth: 0.5,
  borderRadius: 12,
  paddingHorizontal: SPACING.lg,
  paddingVertical: SPACING.lg,
  hasShadow: false,
  marginTop: 0,
  marginBottom: 0,
  marginHorizontal: SPACING.lg,
  style: {},
};

const styles = StyleSheet.create({
  card: {
    alignSelf: 'center',
  },
  shadow: {
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});