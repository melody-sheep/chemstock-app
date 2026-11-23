// src/components/common/StockBatchListSheet.js
// Bottom sheet listing every batch of one product, soonest expiry first. Opened
// from a grouped stock card; tapping a batch opens its detail screen.
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Dimensions, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import CustomModal from './Modal';
import Icon from './Icon';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { NEAR_EXPIRY_DAYS } from '../../constants/inventory';
import { daysUntil, formatDisplayDate } from '../../utils/formatters';
import { isExpired } from '../../utils/expiry';

const TONE_COLORS = {
  healthy: '#2E9E5B',
  low: '#E08A00',
  expired: '#8B1E2D',
};

function expiryStatus(expDate) {
  const daysLeft = daysUntil(expDate);
  if (daysLeft === null) return { label: 'No expiry set', color: '#757575', bg: '#F1F5F9' };
  if (isExpired(expDate)) return { label: 'Expired', color: COLORS.error, bg: '#FDECEC' };
  if (daysLeft <= NEAR_EXPIRY_DAYS) return { label: 'Near expiry', color: '#B45309', bg: '#FFF3D6' };
  return { label: 'Safe batch', color: '#1E7A3A', bg: '#E1F4E8' };
}

export default function StockBatchListSheet({ visible, onClose, group, tone, onSelectBatch }) {
  const qtyColor = TONE_COLORS[tone] || TONE_COLORS.healthy;

  return (
    <CustomModal
      visible={visible}
      onClose={onClose}
      height="auto"
      maxHeight={Math.round(Dimensions.get('window').height * 0.75)}
    >
      {group && (
        <>
          <Text style={styles.title} numberOfLines={1}>{group.product_name}</Text>
          <Text style={styles.subtitle}>
            {group.batches.length} batches · {group.totalQuantity} pcs total
          </Text>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {group.batches.map((batch) => {
              const status = expiryStatus(batch.exp_date);
              return (
                <TouchableOpacity
                  key={batch.id}
                  style={styles.row}
                  onPress={() => onSelectBatch(batch)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Batch ${batch.batch_number || ''}, ${batch.quantity} pieces`}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.batchNumber} numberOfLines={1}>
                      {batch.batch_number || '—'}
                    </Text>
                    <Text style={styles.expText}>
                      {batch.exp_date ? `Exp ${formatDisplayDate(batch.exp_date)}` : 'No expiry set'}
                    </Text>
                    <View style={[styles.pill, { backgroundColor: status.bg }]}>
                      <Text style={[styles.pillText, { color: status.color }]}>{status.label}</Text>
                    </View>
                  </View>
                  <View style={[styles.qtyChip, { backgroundColor: qtyColor }]}>
                    <Text style={styles.qtyChipText}>{batch.quantity} pcs</Text>
                  </View>
                  <Icon name="arrowRight" size={16} color={COLORS.textSecondary} />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </>
      )}
    </CustomModal>
  );
}

StockBatchListSheet.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  group: PropTypes.object,
  tone: PropTypes.oneOf(['healthy', 'low', 'expired']),
  onSelectBatch: PropTypes.func.isRequired,
};

const styles = StyleSheet.create({
  title: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  subtitle: {
    marginTop: 2,
    marginBottom: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
  },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  rowText: { flex: 1, gap: 3 },
  batchNumber: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  expText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
  },
  pill: { alignSelf: 'flex-start', borderRadius: 2, paddingHorizontal: 6, paddingVertical: 2 },
  pillText: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  qtyChip: { borderRadius: 2, paddingHorizontal: 8, height: 24, justifyContent: 'center' },
  qtyChipText: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
