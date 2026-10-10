// src/components/common/ColorBlobs.js
import React from 'react';
import { View, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { COLORS } from '../../constants/colors';

/**
 * ColorBlobs - decorative soft-colored circles layered behind a glass
 * surface. Purpose: give the translucency *something* to reveal, so the
 * glass reads as glass even on platforms where BlurView is flat
 * (e.g. Expo Go on Android). Absolutely positioned, no touch.
 */
export default function ColorBlobs({ style }) {
  return (
    <View style={[StyleSheet.absoluteFillObject, style]} pointerEvents="none">
      <View style={[styles.blob, styles.blob1]} />
      <View style={[styles.blob, styles.blob2]} />
      <View style={[styles.blob, styles.blob3]} />
    </View>
  );
}

ColorBlobs.propTypes = {
  style: PropTypes.object,
};

const styles = StyleSheet.create({
  blob: {
    position: 'absolute',
    borderRadius: 999,
  },
  // Pink blob — top-right, high enough to be covered by the sheet edge
  blob1: {
    width: 260,
    height: 260,
    backgroundColor: COLORS.accentPink,
    opacity: 0.08,
    top: '55%',
    right: -80,
  },
  // Cyan blob — mid-left
  blob2: {
    width: 220,
    height: 220,
    backgroundColor: COLORS.secondary,
    opacity: 0.10,
    top: '68%',
    left: -70,
  },
  // Gold blob — bottom, sits right under the sheet
  blob3: {
    width: 300,
    height: 300,
    backgroundColor: COLORS.accentGold,
    opacity: 0.06,
    bottom: -120,
    left: '20%',
  },
});
