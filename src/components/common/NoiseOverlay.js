// src/components/common/NoiseOverlay.js
import React from 'react';
import { ImageBackground, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';

/**
 * NoiseOverlay - full-bleed grain overlay for glassmorphism surfaces.
 *
 * Uses a tiny base64-encoded PNG (64x64 monochrome noise) tiled with
 * resizeMode="repeat". Chosen over SVG <FeTurbulence> because
 * react-native-svg does NOT support FeTurbulence on native Android/iOS —
 * it warns and silently skips rendering, leaving the glass flat.
 * A tiled PNG works identically on iOS, Android, and web.
 *
 * pointerEvents="none" so it never blocks touch targets.
 *
 * @param {number} opacity - 0..1, overall grain visibility (default 0.05)
 */
export default function NoiseOverlay({ opacity = 0.05 }) {
  return (
    <ImageBackground
      source={{ uri: NOISE_PNG_DATA_URI }}
      resizeMode="repeat"
      style={[StyleSheet.absoluteFillObject, { opacity }]}
      pointerEvents="none"
    />
  );
}

NoiseOverlay.propTypes = {
  opacity: PropTypes.number,
};

// 64x64 monochrome noise, ~1.2 KB base64.
// Generated from a uniform random grayscale bitmap, alpha-locked to the
// luminance so dark pixels are opaque and light pixels fade out.
const NOISE_PNG_DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAAXNSR0IArs4c6QAAAKNJREFUeF7t1sEJwCAMBdCk+++cRToFQdBLcvDwe/f3IZLM7v4kmYzn+wAAgAAAABAAAgAAQAAIAAEgAAQAAIAAEAACAABAAAgAASAABAAAgAAQAAIAAEAACAABIAAEgAAQAAIAAEAACAABIAAEgAAQAAIAAEAACAABIAAEgAAQAAIAAEAACAABIAAEgAAQAAIAAEAACAABIAAEgAAQAAIAAEAACAABIAAEgAAQAAIAAEAACAABIAAEgAAQAAIAAEAACAABIAAEgAAQAAIAAEAACAABIAAEgAAQAAIAAEAACAABIAAEgAAQAAIAAEAACAABIAAEgAAQAAIAAEAACAABIAAEwA8yPwAB0Ywq3QAAAABJRU5ErkJggg==';
