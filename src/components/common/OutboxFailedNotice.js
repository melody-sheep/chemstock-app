// src/components/common/OutboxFailedNotice.js
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Alert from '../../utils/appAlert';
import PropTypes from 'prop-types';
import Icon from './Icon';
import { TYPOGRAPHY } from '../../styles/typography';

const TYPE_LABELS = {
  daily_report: 'Daily report',
  stock_request: 'Stock request',
  receive_stock: 'Stock receipt',
  confirm_delivery_handoff: 'Delivery confirmation',
  discrepancy_resolution: 'Return request',
  delivery_checkpoint: 'Checkpoint',
  finish_delivery_leg: 'Delivery update',
};

/**
 * Shown under the pending banner for queued items the server kept rejecting.
 * Lists each with the server's reason; Discard removes it after a
 * confirmation, Retry tries again. Only the given agent's items are shown, so
 * nobody on a shared phone can discard someone else's.
 */
export default function OutboxFailedNotice({ failed, agentId, onRetry, onDiscard }) {
  // Nothing until the user is known, so a shared phone never shows someone else's.
  const own = agentId ? failed.filter((entry) => entry.payload?.agentId === agentId) : [];
  if (own.length === 0) return null;

  const confirmDiscard = (entry) => {
    const label = TYPE_LABELS[entry.type] || 'This item';
    Alert.alert(
      `Discard ${label.toLowerCase()}?`,
      `It will be removed from this phone and not sent.\n\nReason it was refused: ${entry.lastError || 'unknown'}`,
      [
        { text: 'Keep', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => onDiscard(entry.id) },
      ]
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Icon name="warningTriangle" size={16} color="#B91C1C" />
        <Text style={styles.title}>
          {own.length === 1 ? "1 couldn't be sent" : `${own.length} couldn't be sent`}
        </Text>
        <Pressable onPress={onRetry} style={styles.retryButton} accessibilityRole="button">
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
      {own.map((entry) => (
        <View key={entry.id} style={styles.itemRow}>
          <View style={styles.itemTextCol}>
            <Text style={styles.itemLabel}>{TYPE_LABELS[entry.type] || entry.type}</Text>
            <Text style={styles.itemReason} numberOfLines={3}>
              {entry.lastError || 'It was not accepted.'}
            </Text>
          </View>
          <Pressable onPress={() => confirmDiscard(entry)} style={styles.discardButton} accessibilityRole="button">
            <Text style={styles.discardText}>Discard</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

OutboxFailedNotice.propTypes = {
  failed: PropTypes.array.isRequired,
  agentId: PropTypes.string,
  onRetry: PropTypes.func.isRequired,
  onDiscard: PropTypes.func.isRequired,
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFEEEE',
    borderWidth: 1,
    borderColor: '#FFD5D5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: {
    flex: 1,
    fontSize: 13,
    color: '#B91C1C',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  retryButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#B91C1C' },
  retryText: { fontSize: 12, color: '#FFFFFF', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemTextCol: { flex: 1 },
  itemLabel: { fontSize: 12, color: '#7F1D1D', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  itemReason: { fontSize: 12, color: '#7F1D1D', fontFamily: TYPOGRAPHY.fontFamily.regular, marginTop: 2 },
  discardButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#B91C1C',
    backgroundColor: '#FFFFFF',
  },
  discardText: { fontSize: 12, color: '#B91C1C', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
});
