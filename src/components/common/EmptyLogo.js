// src/components/common/EmptyLogo.js
// The ChemStock bird, faded, for empty lists (no logs, no notifications yet).
import React from 'react';
import { Image, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';

const LOGO = require('../../../assets/ChemStockLogo.png');

export default function EmptyLogo({ size = 96, style }) {
  // The logo file has wide empty margins, so the bird itself is about half of `size`.
  return <Image source={LOGO} style={[styles.logo, { width: size, height: size }, style]} resizeMode="contain" accessibilityIgnoresInvertColors />;
}

EmptyLogo.propTypes = {
  size: PropTypes.number,
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
};

const styles = StyleSheet.create({
  logo: { opacity: 0.35, marginBottom: -12 },
});
