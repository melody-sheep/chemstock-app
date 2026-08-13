// src/components/common/BottomNavBar.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import PropTypes from 'prop-types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from './Icon';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

// Split into two groups so a real gap opens up in the middle for the FAB:
// |dashboard|stock|----FAB----|reports|settings|
const LEFT_TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: 'home' },
  { key: 'stock', label: 'Stock', icon: 'bookmark' },
];
const RIGHT_TABS = [
  { key: 'reports', label: 'Reports', icon: 'document' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
];

const BAR_HEIGHT = 68;
const FAB_SIZE = 60;

/**
 * BottomNavBar - Fixed bottom tab bar with a floating center action button.
 * Shared across role dashboards (Manager, Sales Rep, Collector); tab press
 * handling is left to the parent screen via onTabPress/onFabPress.
 */
export default function BottomNavBar({
  activeTab = 'dashboard',
  onTabPress = null,
  onFabPress = null,
}) {
  const insets = useSafeAreaInsets();

  const renderTab = (tab) => {
    const isActive = tab.key === activeTab;
    return (
      <TouchableOpacity
        key={tab.key}
        style={styles.tab}
        onPress={() => onTabPress && onTabPress(tab.key)}
        activeOpacity={0.7}
        accessibilityLabel={tab.label}
        accessibilityRole="button"
      >
        <Icon
          name={tab.icon}
          size={26}
          color={isActive ? COLORS.primary : '#94a3b8'}
          weight={isActive ? 'fill' : 'regular'}
        />
        <Text style={[styles.label, { color: isActive ? COLORS.primary : '#94a3b8' }]}>
          {tab.label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={[
        styles.container,
        { height: BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom },
      ]}
    >
      <View style={styles.tabGroup}>{LEFT_TABS.map(renderTab)}</View>
      <View style={styles.tabGroup}>{RIGHT_TABS.map(renderTab)}</View>

      <TouchableOpacity
        style={[styles.fab, { bottom: BAR_HEIGHT - FAB_SIZE / 2 + insets.bottom }]}
        onPress={onFabPress}
        activeOpacity={0.85}
        accessibilityLabel="Quick actions"
        accessibilityRole="button"
      >
        <Icon name="grid" size={24} color="#FFFFFF" weight="fill" />
      </TouchableOpacity>
    </View>
  );
}

BottomNavBar.propTypes = {
  activeTab: PropTypes.oneOf(['dashboard', 'stock', 'reports', 'settings']),
  onTabPress: PropTypes.func,
  onFabPress: PropTypes.func,
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  tabGroup: {
    flexDirection: 'row',
    gap: SPACING.xl,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  label: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
  fab: {
    position: 'absolute',
    left: '50%',
    marginLeft: -FAB_SIZE / 2,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
      },
    }),
  },
});
