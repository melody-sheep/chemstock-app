// src/components/ui/SkeletonBlock.js
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';

/**
 * SkeletonBlock - a single pulsing placeholder rectangle, the base
 * primitive behind every skeleton-loading shape in the app (see
 * SkeletonCard for the common "thumbnail + lines" composite). Pass
 * width/height/borderRadius to match whatever real content it stands in
 * for — a text line, an image frame, a badge, anything.
 */
export default function SkeletonBlock({ width = '100%', height = 16, borderRadius = 6, style }) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[styles.block, { width, height, borderRadius, opacity }, style]} />;
}

SkeletonBlock.propTypes = {
  width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  borderRadius: PropTypes.number,
  style: PropTypes.object,
};

const styles = StyleSheet.create({
  block: {
    backgroundColor: '#E2E8F0',
  },
});
