// src/components/common/BottomNavBar.js
import React, { useCallback } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from './Icon';
import useRippleAnimation from '../../hooks/useRippleAnimation';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../styles/typography';

// One flat row, 5 equal-width slots — the FAB is the 3rd slot, not a
// floating circle above the bar anymore.
const LEFT_TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: 'home' },
  { key: 'stock', label: 'Stock', icon: 'bookmark' },
];
const RIGHT_TABS = [
  { key: 'reports', label: 'Reports', icon: 'document' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
];

const BAR_HEIGHT = 76;
const FAB_SIZE = 60;
const RIPPLE_SIZE = 120;
const RIPPLE_CONFIG = { growDuration: 200, fadeDuration: 160, peakOpacity: 0.35 };

// React.memo so switching the active tab only re-renders the two tabs whose
// isActive actually flipped, not all four every time the bar re-renders.
const TabButton = React.memo(function TabButton({ tab, isActive, onPress }) {
  const { onPressIn, onPressOut, rippleStyle } = useRippleAnimation(RIPPLE_CONFIG);

  const handlePress = useCallback(() => {
    onPress && onPress(tab.key);
  }, [onPress, tab.key]);

  return (
    <Pressable
      style={styles.tab}
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityLabel={tab.label}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
    >
      <Animated.View pointerEvents="none" style={[styles.ripple, rippleStyle]} />
      <Icon
        name={tab.icon}
        size={26}
        color={isActive ? COLORS.primary : '#94a3b8'}
        weight={isActive ? 'fill' : 'regular'}
      />
      <Text style={[styles.label, { color: isActive ? COLORS.primary : '#94a3b8' }]}>
        {tab.label}
      </Text>
    </Pressable>
  );
});

TabButton.propTypes = {
  tab: PropTypes.shape({
    key: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    icon: PropTypes.string.isRequired,
  }).isRequired,
  isActive: PropTypes.bool.isRequired,
  onPress: PropTypes.func,
};

function Fab({ icon, onPress }) {
  const { onPressIn, onPressOut, rippleStyle } = useRippleAnimation(RIPPLE_CONFIG);

  return (
    <Pressable
      style={styles.fab}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityLabel="Quick actions"
      accessibilityRole="button"
    >
      <Animated.View pointerEvents="none" style={[styles.fabRipple, rippleStyle]} />
      <Icon name={icon} size={23} color="#FFFFFF" weight="fill" />
    </Pressable>
  );
}

Fab.propTypes = {
  icon: PropTypes.string.isRequired,
  onPress: PropTypes.func,
};

/**
 * BottomNavBar - Fixed bottom tab bar, 4 equal-width tab slots plus a
 * floating FAB that straddles the bar's top border (centered in the middle
 * slot, half above/half below the border line) — no persistent highlight
 * background. Tap feedback on every pressable here is the shared
 * useRippleAnimation hook (grows while held, fades on release), so tabs and
 * the FAB behave identically instead of mixing a custom animation with
 * Pressable's Android-only android_ripple.
 * The tabs row is clipped (overflow: hidden) so the ripple can bleed
 * sideways toward a neighboring tab but never pokes above/below the bar;
 * the FAB is a sibling of that clipped row (not inside it), so its own
 * float above the border is unaffected by the clip.
 */
export default function BottomNavBar({
  activeTab = 'dashboard',
  onTabPress = null,
  onFabPress = null,
  fabIcon = 'grid',
  fabLabel = 'Menu',
  hiddenKeys = [],
}) {
  const insets = useSafeAreaInsets();
  // Collector has no Stock/Reports screens (see ComingSoonScreen's
  // ROLE_ROUTES) — passing hiddenKeys={['stock','reports']} drops those two
  // slots for that role only; Manager/Sales Rep callers leave this unset and
  // keep all 4 tabs. Each remaining tab keeps flex:1, so the row
  // redistributes evenly and the FAB (a fixed middle slot, unaffected by
  // either array's length) stays centered regardless.
  const leftTabs = LEFT_TABS.filter((tab) => !hiddenKeys.includes(tab.key));
  const rightTabs = RIGHT_TABS.filter((tab) => !hiddenKeys.includes(tab.key));

  return (
    <View
      style={[
        styles.container,
        { height: BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom },
      ]}
    >
      <View style={styles.tabsRow}>
        {leftTabs.map((tab) => (
          <TabButton key={tab.key} tab={tab} isActive={tab.key === activeTab} onPress={onTabPress} />
        ))}

        {/* Reserves the middle slot's width so the 4 tabs stay evenly divided;
            the FAB itself floats above as an absolute sibling of this row.
            The icon-sized spacer keeps this label sitting at the same
            baseline as the other tabs' labels. */}
        <View style={styles.tab} pointerEvents="none">
          <View style={styles.fabIconSpacer} />
          <Text style={[styles.label, { color: '#94a3b8' }]}>{fabLabel}</Text>
        </View>

        {rightTabs.map((tab) => (
          <TabButton key={tab.key} tab={tab} isActive={tab.key === activeTab} onPress={onTabPress} />
        ))}
      </View>

      <Fab icon={fabIcon} onPress={onFabPress} />
    </View>
  );
}

BottomNavBar.propTypes = {
  activeTab: PropTypes.oneOf(['dashboard', 'stock', 'reports', 'settings']),
  onTabPress: PropTypes.func,
  onFabPress: PropTypes.func,
  fabIcon: PropTypes.string,
  fabLabel: PropTypes.string,
  hiddenKeys: PropTypes.arrayOf(PropTypes.oneOf(['dashboard', 'stock', 'reports', 'settings'])),
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  tabsRow: {
    flex: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  ripple: {
    position: 'absolute',
    width: RIPPLE_SIZE,
    height: RIPPLE_SIZE,
    borderRadius: RIPPLE_SIZE / 2,
    backgroundColor: '#94a3b8',
  },
  label: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  fabIconSpacer: {
    width: 26,
    height: 26,
  },
  fab: {
    position: 'absolute',
    top: -FAB_SIZE / 2,
    left: '50%',
    marginLeft: -FAB_SIZE / 2,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fabRipple: {
    position: 'absolute',
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
});
