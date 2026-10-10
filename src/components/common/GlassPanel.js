// src/components/common/GlassPanel.js
import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import PropTypes from 'prop-types';
import NoiseOverlay from './NoiseOverlay';
import { COLORS } from '../../constants/colors';

/**
 * GlassPanel - frosted glass surface with noise grain and hairline border.
 * Wraps children in a BlurView tinted light, overlays a subtle noise layer,
 * and paints a translucent border. Reusable for any glassmorphism surface
 * (login sheet, floating cards, bottom sheets over maps).
 *
 * On web, expo-blur falls back to a flat translucent fill; the border and
 * noise still render so the surface still reads as "glass".
 *
 * @param {React.ReactNode} children
 * @param {number} intensity   - blur strength 0..100 (default 40)
 * @param {'light'|'dark'|'default'} tint - blur tint (default 'light')
 * @param {number} noiseOpacity - grain visibility 0..1 (default 0.05)
 * @param {Object} style       - extra styles applied to the outer View
 */
export default function GlassPanel({
  children,
  intensity = 40,
  tint = 'light',
  noiseOpacity = 0.04,
  style = {},
}) {
  return (
    <View style={[styles.wrap, style]}>
      <BlurView intensity={intensity} tint={tint} style={styles.blur}>
        <View style={styles.inner}>
          {children}
          <NoiseOverlay opacity={noiseOpacity} />
        </View>
      </BlurView>
    </View>
  );
}

GlassPanel.propTypes = {
  children: PropTypes.node,
  intensity: PropTypes.number,
  tint: PropTypes.oneOf(['light', 'dark', 'default']),
  noiseOpacity: PropTypes.number,
  style: PropTypes.object,
};

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    backgroundColor: 'rgba(255,255,255,0.85)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      },
    }),
  },
  blur: {
    flex: 1,
  },
  inner: {
    flex: 1,
    position: 'relative',
  },
});
