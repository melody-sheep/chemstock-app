// src/components/common/MapZoomControls.js
import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import Icon from './Icon';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { glassPanel } from '../../styles/glass';

/**
 * MapZoomControls - glass zoom column (in, out, recenter) drawn over a map.
 * Same look as the delivery picker's controls. Position it with `style`.
 */
export default function MapZoomControls({ onZoomIn, onZoomOut, onRecenter, style }) {
  return (
    <View style={[styles.column, glassPanel, style]} pointerEvents="box-none">
      <TouchableOpacity style={styles.button} onPress={onZoomIn} accessibilityRole="button" accessibilityLabel="Zoom in">
        <Icon name="plus" size={16} color={COLORS.textPrimary} />
      </TouchableOpacity>
      <View style={styles.divider} />
      <TouchableOpacity style={styles.button} onPress={onZoomOut} accessibilityRole="button" accessibilityLabel="Zoom out">
        <Icon name="minus" size={16} color={COLORS.textPrimary} />
      </TouchableOpacity>
      {onRecenter && (
        <>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.button}
            onPress={onRecenter}
            accessibilityRole="button"
            accessibilityLabel="Fit route on map"
          >
            <Icon name="navigation" size={16} color={COLORS.primary} />
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

MapZoomControls.propTypes = {
  onZoomIn: PropTypes.func.isRequired,
  onZoomOut: PropTypes.func.isRequired,
  onRecenter: PropTypes.func,
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
};

const styles = StyleSheet.create({
  column: {
    position: 'absolute',
    width: 38,
    alignItems: 'center',
    paddingVertical: 2,
    borderRadius: 19,
  },
  button: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  divider: { width: 22, height: 1, backgroundColor: COLORS.glassBorder },
});
