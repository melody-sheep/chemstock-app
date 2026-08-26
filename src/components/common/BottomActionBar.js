// src/components/common/BottomActionBar.js
import React from 'react';
import { View, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SPACING } from '../../styles/spacing';

// Plain white frame, no border/shadow — absolutely positioned over the
// screen's own bottom edge, same construction as BottomNavBar (fixed in
// place, safe-area aware, never scrolls with the content behind it).
const BAR_PADDING_VERTICAL = SPACING.md;
const BUTTON_HEIGHT = 52; // matches Button's own default height

export const BOTTOM_ACTION_BAR_HEIGHT = BAR_PADDING_VERTICAL * 2 + BUTTON_HEIGHT;

/**
 * BottomActionBar - Fixed, non-scrolling frame pinned to the bottom of the
 * screen for the screen's one major action (e.g. the "Next" / "Confirm &
 * Register" button). Renders `children` as-is, so it works for a single
 * Button or a row of two (e.g. Share + Done) — only the frame/positioning
 * is opinionated here, not what's inside it.
 *
 * The screen's ScrollView must reserve BOTTOM_ACTION_BAR_HEIGHT (plus the
 * safe-area inset — use useBottomActionBarHeight() for that total) as its
 * own contentContainerStyle paddingBottom, so this bar never covers the
 * last scrollable item.
 */
export default function BottomActionBar({ children, style }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingBottom: BAR_PADDING_VERTICAL + insets.bottom }, style]}>
      {children}
    </View>
  );
}

export function useBottomActionBarHeight() {
  const insets = useSafeAreaInsets();
  return BOTTOM_ACTION_BAR_HEIGHT + insets.bottom;
}

BottomActionBar.propTypes = {
  children: PropTypes.node.isRequired,
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingTop: BAR_PADDING_VERTICAL,
  },
});
