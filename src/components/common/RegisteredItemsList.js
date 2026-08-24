// src/components/common/RegisteredItemsList.js
import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from './Icon';
import { useItemDatePicker } from '../../hooks/useItemDatePicker';
import { formatDisplayDate } from '../../utils/formatters';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const PLACEHOLDER_IMAGE = require('../../../assets/image/empty_box1.png');

/**
 * RegisteredItemsList - the "Items To Be Registered" section: heading with
 * status dot, empty state, and a collapsible card listing each item (tinted
 * image, name, tap-to-open Mfg/Exp date buttons, quantity stepper). Owns its
 * own collapse state and date-picker instance (via useItemDatePicker) so
 * AddNewBatchesScreen and ProductPickerList no longer need to duplicate any
 * of this — they just hand over `items` and two callbacks.
 */
export default function RegisteredItemsList({
  items,
  onAdjustQty,
  onDateChange,
  sectionTitle = 'Items To Be Registered',
  cardHeaderTitle = 'List of Items',
  emptyText = 'Search and select products above to add them here',
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const datePicker = useItemDatePicker(items, onDateChange);

  return (
    <>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>{sectionTitle}</Text>
        {items.length > 0 && <View style={styles.statusDot} />}
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>{emptyText}</Text>
        </View>
      ) : (
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.cardHeader}
            onPress={() => setIsExpanded((v) => !v)}
            activeOpacity={0.8}
            accessibilityLabel={isExpanded ? `Collapse ${cardHeaderTitle}` : `Expand ${cardHeaderTitle}`}
            accessibilityRole="button"
          >
            <Text style={styles.cardHeaderText}>{cardHeaderTitle}</Text>
            <Icon
              name="caretDown"
              size={16}
              color="#FFFFFF"
              weight="bold"
              style={{ transform: [{ rotate: isExpanded ? '0deg' : '180deg' }] }}
            />
          </TouchableOpacity>

          {(isExpanded ? items : items.slice(0, 1)).map((item, index) => (
              <View key={item.code} style={[styles.itemRow, index > 0 && styles.itemRowDivider]}>
                <View style={[styles.itemThumbWrap, { backgroundColor: item.tint || '#F1F5F9' }]}>
                  <Image source={item.image || PLACEHOLDER_IMAGE} style={styles.itemThumb} resizeMode="cover" />
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <View style={styles.itemBottomRow}>
                    <TouchableOpacity
                      style={styles.dateRow}
                      onPress={() => datePicker.open(item.code, 'mfgDate')}
                      activeOpacity={0.7}
                      accessibilityLabel={`Set ${item.name} manufacture date`}
                      accessibilityRole="button"
                    >
                      <Icon name="calendar" size={16} color={COLORS.primary} weight="fill" />
                      <Text style={styles.dateRowText}>Mfg: {formatDisplayDate(item.mfgDate) || 'Set date'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.dateRow}
                      onPress={() => datePicker.open(item.code, 'expDate')}
                      activeOpacity={0.7}
                      accessibilityLabel={`Set ${item.name} expiration date`}
                      accessibilityRole="button"
                    >
                      <Icon name="calendar" size={16} color={COLORS.error} weight="fill" />
                      <Text style={styles.dateRowText}>Exp: {formatDisplayDate(item.expDate) || 'Set date'}</Text>
                    </TouchableOpacity>
                    <View style={styles.stepperInline}>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => onAdjustQty(item.code, -1)}
                        accessibilityLabel={`Decrease ${item.name} quantity`}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Icon name="minus" size={14} color={COLORS.primary} weight="bold" />
                      </TouchableOpacity>
                      <Text style={styles.stepperValue}>{item.registeredQty}</Text>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => onAdjustQty(item.code, 1)}
                        accessibilityLabel={`Increase ${item.name} quantity`}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Icon name="plus" size={14} color={COLORS.primary} weight="bold" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            ))}
        </View>
      )}

      {datePicker.target && (
        <DateTimePicker value={datePicker.value} mode="date" display="calendar" onChange={datePicker.handleChange} />
      )}
    </>
  );
}

RegisteredItemsList.propTypes = {
  items: PropTypes.array.isRequired,
  onAdjustQty: PropTypes.func.isRequired,
  onDateChange: PropTypes.func.isRequired,
  sectionTitle: PropTypes.string,
  cardHeaderTitle: PropTypes.string,
  emptyText: PropTypes.string,
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
  },
  emptyBox: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderStyle: 'dashed',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    backgroundColor: '#FFFFFF',
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: '#757575',
    textAlign: 'center',
  },
  card: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#272632',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  cardHeaderText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: '#FFFFFF',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
  },
  itemRowDivider: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  itemThumbWrap: {
    width: 88,
    height: 110,
    borderRadius: 10,
    overflow: 'hidden',
  },
  itemThumb: {
    width: '100%',
    height: '100%',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  itemBottomRow: {
    marginTop: SPACING.xs,
    gap: 6,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  dateRowText: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: '#272632',
  },
  stepperInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: 2,
  },
  stepperBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  stepperValue: {
    minWidth: 26,
    textAlign: 'center',
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
});
