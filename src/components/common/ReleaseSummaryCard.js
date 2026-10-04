// src/components/common/ReleaseSummaryCard.js
import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import Icon from './Icon';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const PLACEHOLDER_IMAGE = require('../../../assets/image/empty_box1.png');

// Orange release summary: total + recipient header with a collapse toggle, then one row per product.
export default function ReleaseSummaryCard({ totalUnits, recipientLine, items }) {
  const [isOpen, setIsOpen] = useState(true);
  const itemCount = items.length;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconBox}>
          <Icon name="trayDown" size={22} color={COLORS.accentOrange} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.total}>
            Total: <Text style={styles.totalStrong}>{totalUnits} item{totalUnits === 1 ? '' : 's'}</Text> about to release
          </Text>
          <Text style={styles.recipient}>{recipientLine}</Text>
        </View>
        <TouchableOpacity
          style={styles.toggle}
          onPress={() => setIsOpen((open) => !open)}
          accessibilityRole="button"
          accessibilityLabel={isOpen ? 'Collapse summary' : 'Expand summary'}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="caretDown" size={16} color={COLORS.accentOrange} />
        </TouchableOpacity>
      </View>

      {isOpen && (
        <View style={styles.body}>
          {items.map((item, index) => (
            <View key={item.key} style={[styles.row, index < itemCount - 1 && styles.rowDivider]}>
              <Image source={item.image || PLACEHOLDER_IMAGE} style={styles.thumb} resizeMode="contain" />
              <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.itemQty}>Qty: {item.qty}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

ReleaseSummaryCard.propTypes = {
  totalUnits: PropTypes.number.isRequired,
  recipientLine: PropTypes.string.isRequired,
  items: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      qty: PropTypes.number.isRequired,
      image: PropTypes.any,
    })
  ).isRequired,
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: COLORS.accentOrange,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.textWhite,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: COLORS.accentOrange + '1A',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.textWhite,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  total: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textPrimary,
  },
  totalStrong: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  recipient: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  toggle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.accentOrange,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.textWhite,
  },
  body: {
    paddingHorizontal: SPACING.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  thumb: {
    width: 36,
    height: 36,
    backgroundColor: COLORS.textWhite,
  },
  itemName: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textPrimary,
  },
  itemQty: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textSecondary,
  },
});
