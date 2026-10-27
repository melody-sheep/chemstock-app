// src/components/common/DeliveryTimeline.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { formatCheckpointTime } from '../../utils/formatters';

/**
 * "Current Location" breadcrumb — a vertical dot/line list of a Collector
 * delivery's event-triggered checkpoints (Shopee-style, not live GPS), most
 * recent last. Shared by the Collector's own Deliver Stock map screen and
 * the Manager/Sales Rep Track Deliveries detail views, so all three render
 * a Collector's logged locations identically.
 */
export default function DeliveryTimeline({ entries, emptyText = 'No location updates yet.' }) {
  return (
    <View style={styles.card}>
      {entries.length === 0 ? (
        <Text style={styles.emptyText}>{emptyText}</Text>
      ) : (
        entries.map((entry, index) => (
          <View key={entry.key} style={styles.row}>
            <View style={styles.dotCol}>
              <View style={[styles.dot, index === entries.length - 1 && styles.dotActive]} />
              {index < entries.length - 1 && <View style={styles.line} />}
            </View>
            <View style={[styles.textWrap, index === entries.length - 1 && styles.textWrapLast]}>
              <Text style={styles.label}>{entry.label}</Text>
              <Text style={styles.time}>{formatCheckpointTime(entry.createdAt)}</Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

DeliveryTimeline.propTypes = {
  entries: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string,
      createdAt: PropTypes.string,
    })
  ).isRequired,
  emptyText: PropTypes.string,
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: '#EAEFF5',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  emptyText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontStyle: 'italic',
  },
  row: { flexDirection: 'row', gap: 10 },
  dotCol: { alignItems: 'center', width: 12 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#DBE4EE', marginTop: 4 },
  dotActive: { backgroundColor: COLORS.primary },
  line: { width: 2, flex: 1, minHeight: 12, backgroundColor: '#EAEFF5' },
  textWrap: { flex: 1, paddingBottom: 8 },
  textWrapLast: { paddingBottom: 0 },
  label: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: '#272632',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  time: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 1,
  },
});
