// src/components/ui/LoadingSpinner.js
import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { COLORS } from '../../constants/colors';

/**
 * LoadingSpinner - centered activity indicator for a loading state that
 * doesn't need a content-shaped placeholder (see SkeletonBlock/SkeletonCard
 * for that). `fill` centers it in all available space (a whole screen or
 * section); pass `fill={false}` for an inline spinner sized to its content.
 */
export default function LoadingSpinner({ size = 'large', color = COLORS.primary, fill = true, style }) {
  return (
    <View style={[fill && styles.fill, style]}>
      <ActivityIndicator size={size} color={color} />
    </View>
  );
}

LoadingSpinner.propTypes = {
  size: PropTypes.oneOf(['small', 'large']),
  color: PropTypes.string,
  fill: PropTypes.bool,
  style: PropTypes.object,
};

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
