// src/components/common/StockBatchCard.js
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import Icon from './Icon';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { SHADOWS } from '../../styles/shadows';
import { NEAR_EXPIRY_DAYS } from '../../constants/inventory';
import { daysUntil } from '../../utils/formatters';
import { isExpired } from '../../utils/expiry';

const CARD_WIDTH = 120;
// Fixed, not minHeight — every card (in-stock or out-of-stock) is exactly
// this size regardless of how many text lines it actually has, so a row
// never looks uneven. Out-of-stock cards (no batch/expiry lines) just carry
// a little empty space at the bottom instead of shrinking the box.
const CARD_HEIGHT = 176;

/**
 * StockBatchCard - one card per received batch (in-stock) or catalog
 * product with no batches yet (out-of-stock), used on the Manager Stocks
 * screen's horizontal-scroll rows. Every card shows the same plain
 * outlined thumbnail + icon treatment regardless of section — no tinted
 * backgrounds, no "Out of Stock" text label, so it reads the same whether
 * it's a "Frequently Added" shortcut or a plain "All Products" entry.
 */
export default function StockBatchCard({
  productName,
  image = null,
  quantity = null,
  batchNumber = null,
  expDate = null,
  outOfStock = false,
  wireframe = false,
  onPress = null,
  statusLabel = null,
  // 'healthy' | 'low' | 'out': draws the coloured tile (picture across the top and both sides,
  // details underneath). Without it the card looks exactly as before.
  tone = null,
}) {
  const daysLeft = outOfStock ? null : daysUntil(expDate);
  const isNearExpiry = daysLeft !== null && daysLeft <= NEAR_EXPIRY_DAYS;

  if (tone) {
    const t = TILE_TONES[tone] || TILE_TONES.healthy;
    let tileStatus = null;
    if (!outOfStock) {
      if (daysLeft === null) tileStatus = { label: 'No expiry set', color: '#757575', bg: '#F1F5F9' };
      else if (isExpired(expDate)) tileStatus = { label: 'Expired', color: COLORS.error, bg: '#FDECEC' };
      else if (isNearExpiry) tileStatus = { label: 'Near expiry', color: '#B45309', bg: '#FFF3D6' };
      else tileStatus = { label: 'Safe batch', color: '#1E7A3A', bg: '#E1F4E8' };
      if (statusLabel) tileStatus = { label: statusLabel, color: '#0085F9', bg: '#E3F2FF' };
    }
    const TileContainer = onPress ? TouchableOpacity : View;
    return (
      <TileContainer
        style={[styles.tile, { borderColor: t.border, backgroundColor: '#FFFFFF' }, outOfStock && styles.tileOut]}
        {...(onPress ? { onPress, activeOpacity: 0.7 } : {})}
      >
        <View style={[styles.tilePicture, { backgroundColor: t.tint }, outOfStock && styles.tilePictureOut]}>
          {image ? (
            <Image source={image} style={styles.tileImage} resizeMode="contain" />
          ) : (
            <Icon name="boxPackage" size={40} />
          )}
          {!outOfStock && (
            <View style={[styles.tileQty, { backgroundColor: t.solid }]}>
              <Text style={styles.tileQtyText}>{quantity} pcs</Text>
            </View>
          )}
        </View>
        <View style={styles.tileBody}>
          <Text style={styles.tileName} numberOfLines={1}>{productName}</Text>
          {tileStatus && (
            <View style={[styles.tilePill, { backgroundColor: tileStatus.bg }]}>
              <Text style={[styles.tilePillText, { color: tileStatus.color }]}>{tileStatus.label}</Text>
            </View>
          )}
          {!outOfStock && (
            <>
              <Text style={[styles.tileMeta, isNearExpiry && styles.metaTextUrgent]}>
                {expDate ? `Exp ${new Date(expDate).toLocaleDateString()}` : 'No expiry set'}
              </Text>
            </>
          )}
        </View>
      </TileContainer>
    );
  }

  let expiryBadge = null;
  if (!outOfStock) {
    if (daysLeft === null) {
      expiryBadge = { label: 'No Expiry Set', color: '#757575', bg: '#F1F5F9' };
    } else if (isExpired(expDate)) {
      expiryBadge = { label: 'Expired Batch', color: COLORS.error, bg: '#FDECEC' };
    } else if (isNearExpiry) {
      expiryBadge = { label: 'Near Expiry Batch', color: '#B45309', bg: '#FFF3D6' };
    } else {
      expiryBadge = { label: 'Safe Batch on Shelf', color: COLORS.success, bg: COLORS.success + '18' };
    }
    if (wireframe) {
      expiryBadge = { ...expiryBadge, color: '#757575', bg: '#F1F5F9' };
    }
  }
  // e.g. stock received offline, not yet synced — same blue as "Preparing".
  if (statusLabel) {
    expiryBadge = { label: statusLabel, color: '#0085F9', bg: '#E3F2FF' };
  }

  // Out-of-stock cards are muted (dimmed) in the wireframe "All Products"
  // grid, where stock status is the point — but silently, via opacity only.
  // No "Out of Stock" text label anywhere; the icon alone is enough.
  const isWireframeOutOfStock = outOfStock && wireframe;
  const Container = onPress ? TouchableOpacity : View;
  const containerProps = onPress ? { onPress, activeOpacity: 0.7 } : {};

  return (
    <Container
      style={[styles.card, isWireframeOutOfStock && styles.cardMuted, wireframe && styles.wireframeCard]}
      {...containerProps}
    >
      <View style={styles.thumbWrap}>
        <View style={styles.thumbIconBg}>
          {image ? (
            <Image source={image} style={styles.thumbImage} resizeMode="contain" />
          ) : (
            <Icon name="boxPackage" size={36} />
          )}
        </View>

        {!outOfStock && (
          <View style={[styles.badge, styles.badgeTopRight, wireframe ? styles.wireframeBadge : styles.qtyBadge]}>
            <Text style={[styles.qtyBadgeText, wireframe && styles.wireframeBadgeText]}>{quantity} pcs</Text>
          </View>
        )}
      </View>

      {expiryBadge && (
        <View style={[styles.statusPill, { backgroundColor: expiryBadge.bg }]}>
          <Text style={[styles.badgeText, { color: expiryBadge.color }]} numberOfLines={1}>
            {expiryBadge.label}
          </Text>
        </View>
      )}

      <Text style={styles.productName} numberOfLines={1}>
        {productName}
      </Text>

      {!outOfStock && (
        <>
          <View style={styles.metaRow}>
            <Icon name="idCard" size={11} color={COLORS.textSecondary} />
            <Text style={styles.metaText} numberOfLines={1}>
              ID: {batchNumber || '—'}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Icon
              name={isNearExpiry ? 'warningTriangle' : 'calendar'}
              size={11}
              color={isNearExpiry ? COLORS.error : COLORS.textSecondary}
            />
            <Text style={[styles.metaText, isNearExpiry && styles.metaTextUrgent]} numberOfLines={1}>
              {expDate ? `Exp: ${new Date(expDate).toLocaleDateString()}` : 'No expiry set'}
              {isNearExpiry ? ' (Urgent!)' : ''}
            </Text>
          </View>
        </>
      )}
    </Container>
  );
}

StockBatchCard.propTypes = {
  productName: PropTypes.string.isRequired,
  image: PropTypes.oneOfType([PropTypes.number, PropTypes.object]),
  quantity: PropTypes.number,
  batchNumber: PropTypes.string,
  expDate: PropTypes.string,
  outOfStock: PropTypes.bool,
  wireframe: PropTypes.bool,
  statusLabel: PropTypes.string,
  onPress: PropTypes.func,
  tone: PropTypes.oneOf(['healthy', 'low', 'out']),
};

// Tile colours by stock level: a soft background for the picture, a stronger edge and badge.
const TILE_TONES = {
  healthy: { solid: '#2E9E5B', tint: '#E3F4EA', border: '#79C898' },
  low: { solid: '#E08A00', tint: '#FFF1D6', border: '#F2BE63' },
  out: { solid: '#C9485B', tint: '#FBE7EA', border: '#E6A3AE' },
};

const TILE_WIDTH = 148;

const styles = StyleSheet.create({
  tile: {
    width: TILE_WIDTH,
    borderRadius: 2,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tileOut: { opacity: 0.92 },
  tilePicture: {
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tilePictureOut: { height: 84 },
  tileImage: { width: 76, height: 76 },
  tileQty: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderBottomLeftRadius: 2,
  },
  tileQtyText: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#FFFFFF',
  },
  tileBody: { padding: SPACING.sm, gap: 4 },
  tileName: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  tilePill: { alignSelf: 'flex-start', borderRadius: 2, paddingHorizontal: 6, paddingVertical: 2 },
  tilePillText: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  tileMeta: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
  },
  tileId: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textTertiary,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 14,
    borderWidth: 1,
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  thumbIconBg: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
    maxWidth: CARD_WIDTH - SPACING.sm * 2 - 4,
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    marginBottom: SPACING.xs + 2,
  },
  badgeTopRight: {
    top: 6,
    right: 6,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  qtyBadge: {
    backgroundColor: COLORS.success + '20',
  },
  qtyBadgeText: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.success,
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
    marginBottom: SPACING.xs,
    minHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  metaText: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 16,
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
