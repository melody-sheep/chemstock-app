// src/components/common/MapStatusCard.js
// One tidy card for the top-left corner of a map: what the markers mean and whether the phone is online,
// with an optional second row for actions or hints (Cancel, "Near <stop>", ...). It replaces the old
// stack of separate pills. Position it with `style`.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import SyncStatusBadge from './SyncStatusBadge';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

export default function MapStatusCard({ legend, children, style }) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.row}>
        {(legend || []).map((item) => (
          <View key={item.label} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: item.color }]} />
            <Text style={styles.legendText}>{item.label}</Text>
          </View>
        ))}
        <View style={styles.divider} />
        <SyncStatusBadge />
      </View>
      {!!children && <View style={styles.actions}>{children}</View>}
    </View>
  );
}

MapStatusCard.propTypes = {
  legend: PropTypes.arrayOf(PropTypes.shape({ label: PropTypes.string.isRequired, color: PropTypes.string.isRequired })),
  children: PropTypes.node,
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
};

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    maxWidth: '75%',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: SPACING.sm, rowGap: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { fontSize: 12, fontFamily: TYPOGRAPHY.fontFamily.medium, fontWeight: '500', color: '#4B5563' },
  divider: { width: 1, height: 14, backgroundColor: '#E1E5EA' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACING.sm },
});
