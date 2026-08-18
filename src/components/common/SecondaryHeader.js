// src/components/common/SecondaryHeader.js
import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { COLORS } from '../../constants/colors';

// Standard height for sub-screen SecondaryHeaders (title + status badge row).
// The Manager Dashboard's own welcome-block header is taller and sets its
// own height directly — this constant is only for the simpler sub-screens.
export const SUBSCREEN_HEADER_HEIGHT = 64;

/**
 * SecondaryHeader - Full-width info bar displayed directly below the main Header.
 * Used across role dashboards (Manager, Sales Rep, Collector) to surface
 * branch/status/summary content under the navy top bar.
 *
 * `illustration` is an optional image source (e.g. require('../../../assets/...'))
 * rendered on the right side, so a screen can drop in artwork without
 * this component needing to know what that artwork is.
 */
export default function SecondaryHeader({
  children = null,
  illustration = null,
  illustrationWidth = 96,
  illustrationMarginRight = 0,
  height = 120,
  backgroundColor = '#F7FEFF',
  borderColor = COLORS.border,
  borderWidth = 0.5,
  style = {},
}) {
  return (
    <View
      style={[
        styles.container,
        {
          height,
          backgroundColor,
          borderBottomColor: borderColor,
          borderBottomWidth: borderWidth,
        },
        style,
      ]}
    >
      <View style={styles.contentSlot}>{children}</View>

      {illustration && (
        <Image
          source={illustration}
          style={[styles.illustration, { width: illustrationWidth, marginRight: illustrationMarginRight }]}
          resizeMode="contain"
        />
      )}
    </View>
  );
}

SecondaryHeader.propTypes = {
  children: PropTypes.node,
  illustration: PropTypes.oneOfType([PropTypes.number, PropTypes.object]),
  illustrationWidth: PropTypes.number,
  illustrationMarginRight: PropTypes.number,
  height: PropTypes.number,
  backgroundColor: PropTypes.string,
  borderColor: PropTypes.string,
  borderWidth: PropTypes.number,
  style: PropTypes.object,
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  contentSlot: {
    flex: 1,
  },
  illustration: {
    height: '100%',
  },
});
