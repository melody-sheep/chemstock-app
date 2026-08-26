// src/components/common/RegisteredItemsList.js
import React, { useState, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from './Icon';
import SpotlightHint from './SpotlightHint';
import QuantityStepper from './QuantityStepper';
import { useItemDatePicker } from '../../hooks/useItemDatePicker';
import { useFirstTimeHint } from '../../hooks/useFirstTimeHint';
import { formatDisplayDate } from '../../utils/formatters';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const PLACEHOLDER_IMAGE = require('../../../assets/image/empty_box1.png');

/**
 * RegisteredItemsList - the "Items To Be Registered" section: heading with
 * status dot, empty state, and a collapsible card listing each item (tinted
 * image, name, tap-to-open Mfg/Exp date buttons, quantity stepper, and a
 * per-row remove button). Owns its own collapse state and date-picker
 * instance (via useItemDatePicker) so AddNewBatchesScreen and
 * ProductPickerList no longer need to duplicate any of this — they just
 * hand over `items` and three callbacks.
 */
export default function RegisteredItemsList({
  items,
  onSetQty,
  onDateChange,
  onRemove,
  sectionTitle = 'Items To Be Registered',
  cardHeaderTitle = 'List of Items',
  emptyText = 'Search and select products above to add them here',
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const visibleItems = isExpanded ? items : items.slice(0, 1);
  const datePicker = useItemDatePicker(items, onDateChange);
  const dateHint = useFirstTimeHint('registered_items_mfg_exp_dates');

  // Measured window position of the first item's Mfg/Exp buttons, so
  // SpotlightHint can highlight the *actual* buttons instead of adding a
  // separate explainer element to the layout.
  const firstDateGroupRef = useRef(null);
  const [spotlightTarget, setSpotlightTarget] = useState(null);
  const measureSpotlightTarget = () => {
    firstDateGroupRef.current?.measureInWindow((x, y, width, height) => {
      // Explicit no-op guard: skip the setState if the measurement didn't
      // actually change. onLayout should already only fire on a real frame
      // change, but this makes the settle-after-one-pass guarantee true by
      // construction rather than relying on that RN internal.
      setSpotlightTarget((prev) => {
        if (prev && prev.x === x && prev.y === y && prev.width === width && prev.height === height) {
          return prev;
        }
        return { x, y, width, height };
      });
    });
  };

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
        <>
          <SpotlightHint
            visible={dateHint.isVisible}
            target={spotlightTarget}
            title="Set the item dates"
            description="Tap Mfg and Exp to set each item's dates — Exp can't be set earlier than Mfg."
            onDismiss={dateHint.dismiss}
          />
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

            {visibleItems.map((item, index) => (
              <View
                key={item.code}
                style={[styles.itemRow, index < visibleItems.length - 1 && styles.itemRowGap]}
              >
                <View style={styles.itemThumbWrap}>
                  <Image
                    source={item.image || PLACEHOLDER_IMAGE}
                    style={item.image ? styles.itemThumb : styles.itemThumbPlaceholder}
                    resizeMode={item.image ? 'cover' : 'contain'}
                  />
                </View>

                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={styles.itemQtyText}>Qty: {item.registeredQty}</Text>

                  <View
                    ref={index === 0 ? firstDateGroupRef : null}
                    onLayout={index === 0 ? measureSpotlightTarget : undefined}
                    style={styles.dateStack}
                  >
                    <TouchableOpacity
                      style={styles.dateLine}
                      onPress={() => datePicker.open(item.code, 'mfgDate')}
                      activeOpacity={0.7}
                      accessibilityLabel={`Set ${item.name} manufacture date`}
                      accessibilityRole="button"
                      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                    >
                      <Icon name="calendar" size={13} color={COLORS.primary} weight="fill" />
                      <Text style={styles.dateLineText}>MFG: {formatDisplayDate(item.mfgDate) || 'Set date'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.dateLine}
                      onPress={() => datePicker.open(item.code, 'expDate')}
                      activeOpacity={0.7}
                      accessibilityLabel={`Set ${item.name} expiration date`}
                      accessibilityRole="button"
                      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                    >
                      <Icon name="calendar" size={13} color={COLORS.error} weight="fill" />
                      <Text style={styles.dateLineText}>EXP: {formatDisplayDate(item.expDate) || 'Set date'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.itemRemoveBtn}
                  onPress={() => onRemove(item.code)}
                  activeOpacity={0.7}
                  accessibilityLabel={`Remove ${item.name} from this batch`}
                  accessibilityRole="button"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon name="trashSimple" size={18} color={COLORS.error} weight="duotone" />
                </TouchableOpacity>

                <View style={styles.itemStepperWrap}>
                  <QuantityStepper
                    value={item.registeredQty}
                    onChange={(qty) => onSetQty(item.code, qty)}
                    label={item.name}
                  />
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      {datePicker.target && (
        <DateTimePicker
          value={datePicker.value}
          mode="date"
          display="calendar"
          onChange={datePicker.handleChange}
          minimumDate={datePicker.minimumDate}
          maximumDate={datePicker.maximumDate}
        />
      )}
    </>
  );
}

RegisteredItemsList.propTypes = {
  items: PropTypes.array.isRequired,
  onSetQty: PropTypes.func.isRequired,
  onDateChange: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
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
    alignItems: 'center',
    minHeight: 148,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  itemRowGap: {
    marginBottom: 2,
  },
  itemThumbWrap: {
    width: 92,
    height: 132,
    marginLeft: SPACING.sm,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemThumb: {
    width: '100%',
    height: '100%',
  },
  itemThumbPlaceholder: {
    width: 40,
    height: 40,
  },
  itemInfo: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingLeft: SPACING.sm,
    paddingRight: 40,
  },
  itemName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  itemQtyText: {
    marginTop: 4,
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textSecondary,
  },
  dateStack: {
    marginTop: SPACING.sm,
    gap: 4,
  },
  dateLine: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
  },
  dateLineText: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: '#272632',
  },
  itemRemoveBtn: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
  },
  itemStepperWrap: {
    position: 'absolute',
    bottom: SPACING.sm,
    right: SPACING.sm,
  },
});
