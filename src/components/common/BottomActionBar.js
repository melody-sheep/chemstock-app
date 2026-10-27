// src/components/common/BottomActionBar.js
import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import PropTypes from 'prop-types';
import { BlurView } from 'expo-blur';
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
export default function BottomActionBar({ children, style, variant = 'solid', blurTarget }) {
  const insets = useSafeAreaInsets();
  const isGlass = variant === 'glass';
  const containerStyle = [
    styles.container,
    isGlass && styles.containerGlass,
    { paddingBottom: BAR_PADDING_VERTICAL + insets.bottom },
    style,
  ];

  // Android release builds draw the live blur as a dark grey slab (Expo Go does not), so Android gets a plain
  // near-white bar instead; iOS keeps the frosted blur.
  if (isGlass && Platform.OS === 'android') {
    return <View style={[...containerStyle, styles.containerAndroidGlass]}>{children}</View>;
  }

  if (isGlass) {
    return (
      <View style={containerStyle}>
        <BlurView
          blurTarget={blurTarget}
          blurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
          intensity={Platform.OS === 'ios' ? 40 : 30}
          tint="light"
          style={StyleSheet.absoluteFill}
        />
        {children}
      </View>
    );
  }

  return <View style={containerStyle}>{children}</View>;
}

export function useBottomActionBarHeight() {
  const insets = useSafeAreaInsets();
  return BOTTOM_ACTION_BAR_HEIGHT + insets.bottom;
}

BottomActionBar.propTypes = {
  children: PropTypes.node.isRequired,
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  variant: PropTypes.oneOf(['solid', 'glass']),
  blurTarget: PropTypes.object,
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
  containerAndroidGlass: {
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderTopColor: '#E5E7EB',
  },
  containerGlass: {
    backgroundColor: 'transparent',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.6)',
  },
});
