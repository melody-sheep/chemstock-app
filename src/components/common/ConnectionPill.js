// src/components/common/ConnectionPill.js
import React from 'react';
import { View, StyleSheet } from 'react-native';
import SyncStatusBadge from './SyncStatusBadge';
import { glassPanel } from '../../styles/glass';
import { SPACING } from '../../styles/spacing';

/**
 * ConnectionPill - the live Online / Offline status in a glass pill, for use
 * over a map. Same status as the header badge (SyncStatusBadge).
 */
export default function ConnectionPill() {
  return (
    <View style={[styles.pill, glassPanel]}>
      <SyncStatusBadge />
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingVertical: SPACING.xs + 2,
    paddingHorizontal: SPACING.md - 2,
    borderRadius: 999,
  },
});
