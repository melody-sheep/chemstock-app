// src/components/common/ReleaseSummaryCard.js
import React, { useRef, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import PropTypes from 'prop-types';
import Icon from './Icon';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const PLACEHOLDER_IMAGE = require('../../../assets/image/empty_box1.png');

// Only the chevron animates, and only briefly. The list itself opens and
// closes instantly so the header never feels like it's lagging behind a tap.
const CHEVRON_DURATION_MS = 150;

// Orange release summary: total + recipient header (the whole header toggles
// the list), then one row per product.
export default function ReleaseSummaryCard({ totalUnits, recipientLine, items }) {
  const [isOpen, setIsOpen] = useState(true);
  // 1 = open (chevron points down), 0 = closed (chevron points right).
  const chevronProgress = useRef(new Animated.Value(1)).current;
  const itemCount = items.length;

  const toggle = () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    Animated.timing(chevronProgress, {
      toValue: nextOpen ? 1 : 0,
      duration: CHEVRON_DURATION_MS,
      useNativeDriver: true,
    }).start();
  };

  const chevronRotation = chevronProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['-90deg', '0deg'],
  });

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={[styles.header, isOpen && styles.headerOpen]}
        onPress={toggle}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={isOpen ? 'Collapse summary' : 'Expand summary'}
        accessibilityState={{ expanded: isOpen }}
      >
        <Icon name="trayDown" size={22} color={COLORS.accentOrange} />
        <View style={styles.headerText}>
          <Text style={styles.total}>
            Total: <Text style={styles.totalStrong}>{totalUnits} item{totalUnits === 1 ? '' : 's'}</Text> about to release
          </Text>
          <Text style={styles.recipient}>{recipientLine}</Text>
        </View>
        <Animated.View style={{ transform: [{ rotate: chevronRotation }] }}>
          <Icon name="caretDown" size={16} color={COLORS.accentOrange} />
        </Animated.View>
      </TouchableOpacity>

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
    borderRadius: 8,
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
  // A divider under the header only while the list is open, so the header and
  // the rows read as two separate levels.
  headerOpen: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.accentOrange + '33',
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
