// src/components/common/StockBatchCard.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import Icon from './Icon';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { SHADOWS } from '../../styles/shadows';
import { NEAR_EXPIRY_DAYS } from '../../constants/inventory';
import { daysUntil } from '../../utils/formatters';

const CARD_WIDTH = 152;

/**
 * StockBatchCard - one card per received batch (in-stock) or catalog
 * product with no batches yet (out-of-stock), used on the Manager Stocks
 * screen's horizontal-scroll rows.
 */
export default function StockBatchCard({
  productName,
  quantity = null,
  batchNumber = null,
  expDate = null,
  outOfStock = false,
  thumbTint = null,
  wireframe = false,
}) {
  const daysLeft = outOfStock ? null : daysUntil(expDate);
  const isNearExpiry = daysLeft !== null && daysLeft <= NEAR_EXPIRY_DAYS;

  let expiryBadge = null;
  if (!outOfStock) {
    if (daysLeft === null) {
      expiryBadge = { label: 'No Expiry Set', color: '#757575', bg: '#F1F5F9' };
    } else if (isNearExpiry) {
      expiryBadge = { label: 'Near Expiry Batch', color: '#B45309', bg: '#FFF3D6' };
    } else {
      expiryBadge = { label: 'Safe Batch on Shelf', color: COLORS.success, bg: COLORS.success + '18' };
    }
    if (wireframe) {
      expiryBadge = { ...expiryBadge, color: '#757575', bg: '#F1F5F9' };
    }
  }

  // Out-of-stock muting/labeling only applies in the wireframe "All Products"
  // grid, where stock status is the point. The colorful "Frequently Added"
  // row (wireframe=false) is a quick-pick shortcut, not a stock indicator,
  // so it stays fully visible either way — no faded icon, no "Out of Stock" text.
  const isWireframeOutOfStock = outOfStock && wireframe;

  return (
    <View style={[styles.card, isWireframeOutOfStock && styles.cardMuted, wireframe && styles.wireframeCard]}>
      <View style={[styles.thumbWrap, thumbTint && !wireframe && { backgroundColor: thumbTint }]}>
        {!wireframe && (
          <View style={styles.thumbIconBg}>
            <Icon name="boxPackage" size={36} />
          </View>
        )}

        {expiryBadge && (
          <View style={[styles.badge, styles.badgeTopLeft, { backgroundColor: expiryBadge.bg }]}>
            <Text style={[styles.badgeText, { color: expiryBadge.color }]} numberOfLines={1}>
              {expiryBadge.label}
            </Text>
          </View>
        )}

        {isWireframeOutOfStock && (
          <View style={[styles.badge, styles.badgeTopLeft, styles.wireframeBadge]}>
            <Text style={[styles.badgeText, styles.wireframeBadgeText]}>Out of Stock</Text>
          </View>
        )}
        {!outOfStock && (
          <View style={[styles.badge, styles.badgeTopRight, wireframe ? styles.wireframeBadge : styles.qtyBadge]}>
            <Text style={[styles.qtyBadgeText, wireframe && styles.wireframeBadgeText]}>{quantity} pcs</Text>
          </View>
        )}
      </View>

      <Text style={styles.productName} numberOfLines={1}>
        {productName}
      </Text>

      {!outOfStock && (
        <>
          <Text style={styles.metaText} numberOfLines={1}>
            ID: {batchNumber || '—'}
          </Text>
          <Text style={[styles.metaText, isNearExpiry && styles.metaTextUrgent]} numberOfLines={1}>
            {expDate ? `Exp: ${new Date(expDate).toLocaleDateString()}` : 'No expiry set'}
            {isNearExpiry ? ' (Urgent!)' : ''}
          </Text>
        </>
      )}
    </View>
  );
}

StockBatchCard.propTypes = {
  productName: PropTypes.string.isRequired,
  quantity: PropTypes.number,
  batchNumber: PropTypes.string,
  expDate: PropTypes.string,
  outOfStock: PropTypes.bool,
  thumbTint: PropTypes.string,
  wireframe: PropTypes.bool,
};

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
    padding: SPACING.sm,
    ...SHADOWS.cardSoft,
  },
  cardMuted: {
    opacity: 0.6,
  },
  wireframeCard: {
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
    borderColor: '#B0B0B0',
  },
  thumbWrap: {
    width: '100%',
    height: 72,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  thumbIconBg: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    borderRadius: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
    maxWidth: CARD_WIDTH - SPACING.sm * 2 - 4,
  },
  badgeTopLeft: {
    top: 4,
    left: 4,
  },
  badgeTopRight: {
    top: 4,
    right: 4,
  },
  badgeText: {
    fontSize: 9,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  qtyBadge: {
    backgroundColor: COLORS.success + '20',
  },
  qtyBadgeText: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.success,
  },
  outOfStockBadge: {
    backgroundColor: COLORS.error + '18',
  },
  outOfStockBadgeText: {
    fontSize: 9,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.error,
  },
  wireframeBadge: {
    backgroundColor: '#F1F5F9',
  },
  wireframeBadgeText: {
    color: '#757575',
  },
  productName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
    marginBottom: 2,
  },
  metaText: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  metaTextUrgent: {
    color: COLORS.error,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
});
