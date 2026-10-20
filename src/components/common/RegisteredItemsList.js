// src/components/common/RegisteredItemsList.js
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from './Icon';
import SectionHeader from './SectionHeader';
import DateChip from './DateChip';
import SpotlightHint from './SpotlightHint';
import QuantityStepper from './QuantityStepper';
import { useItemDatePicker } from '../../hooks/useItemDatePicker';
import { useFirstTimeHint } from '../../hooks/useFirstTimeHint';
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
  // true: the heading uses the icon + uppercase label look of Manage Accounts
  labelHeader = false,
  // Review screens: the quantity is shown as text with a pencil, and the pencil
  // calls onEditQuantity (the screen sends the manager back to change it).
  quantityLocked = false,
  onEditQuantity,
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  // Adding a product always opens the list so every item is on screen — a
  // list folded earlier must not hide the product that was just picked.
  const previousCount = useRef(items.length);
  useEffect(() => {
    if (items.length > previousCount.current) setIsExpanded(true);
    previousCount.current = items.length;
  }, [items.length]);
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
        {labelHeader ? (
          <SectionHeader icon="clipboardText" size="md" label={sectionTitle} style={styles.labelHeaderSpacing} />
        ) : (
          <Text style={styles.sectionTitle}>{sectionTitle}</Text>
        )}
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
              <Text style={styles.cardHeaderText}>
                {cardHeaderTitle} <Text style={styles.cardHeaderCount}>({items.length})</Text>
              </Text>
              {items.length > 1 && (
                <View style={styles.cardHeaderAction}>
                  <Text style={styles.cardHeaderActionText}>{isExpanded ? 'Hide' : 'Show all'}</Text>
                  <Icon
                    name="caretDown"
                    size={16}
                    color="#FFFFFF"
                    weight="bold"
                    style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}
                  />
                </View>
              )}
            </TouchableOpacity>
            {!isExpanded && items.length > 1 && (
              <View style={styles.showingRow}>
                <Text style={styles.showingText}>Showing 1 of {items.length} items</Text>
              </View>
            )}

            {visibleItems.map((item, index) => (
              <View
                key={item.code}
                style={[styles.itemRow, index < visibleItems.length - 1 && styles.itemRowGap]}
              >
                <View style={styles.itemThumbWrap}>
                  <Image
                    source={item.image || PLACEHOLDER_IMAGE}
                    style={item.image ? styles.itemThumb : styles.itemThumbPlaceholder}
                    resizeMode="contain"
                    resizeMethod="scale"
                  />
                </View>

                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <View
                    ref={index === 0 ? firstDateGroupRef : null}
                    onLayout={index === 0 ? measureSpotlightTarget : undefined}
                    style={styles.dateStack}
                  >
                    <DateChip
                      label="MFG"
                      value={item.mfgDate}
                      onPress={() => datePicker.open(item.code, 'mfgDate')}
                      accessibilityLabel={`Set ${item.name} manufacture date`}
                    />
                    <DateChip
                      label="EXP"
                      value={item.expDate}
                      onPress={() => datePicker.open(item.code, 'expDate')}
                      accessibilityLabel={`Set ${item.name} expiration date`}
                    />
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
                  <Icon name="trash" size={16} color={COLORS.error} weight="fill" />
                </TouchableOpacity>

                <View style={styles.itemStepperWrap}>
                  {quantityLocked ? (
                    <View style={styles.qtyLocked}>
                      <Text style={styles.qtyLockedLabel}>Qty</Text>
                      <Text style={styles.qtyLockedValue}>{item.registeredQty}</Text>
                      <TouchableOpacity
                        style={styles.qtyEditBtn}
                        onPress={onEditQuantity}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`Edit quantity of ${item.name}`}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Icon name="pencilSimpleLine" size={16} color="#E0436B" weight="bold" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <QuantityStepper
                      value={item.registeredQty}
                      onChange={(qty) => onSetQty(item.code, qty)}
                      label={item.name}
                    />
                  )}
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
  labelHeaderSpacing: { marginTop: SPACING.md, marginBottom: 0 },
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
  cardHeaderCount: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: '#C9CDD6',
  },
  cardHeaderAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardHeaderActionText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: '#C9CDD6',
  },
  showingRow: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    backgroundColor: '#F4F6FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  showingText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textSecondary,
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
    paddingTop: SPACING.sm,
    paddingBottom: 56,
    paddingLeft: SPACING.sm,
    paddingRight: 40,
  },
  itemName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  dateStack: {
    marginTop: SPACING.sm,
    gap: 6,
  },
  itemRemoveBtn: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDECEC',
  },
  qtyLocked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingLeft: 10,
    paddingRight: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E4E7EE',
    backgroundColor: '#FFFFFF',
  },
  qtyLockedLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textSecondary,
  },
  qtyLockedValue: {
    minWidth: 20,
    textAlign: 'center',
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  qtyEditBtn: {
    width: 26,
    height: 26,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F6C1D0',
  },
  itemStepperWrap: {
    position: 'absolute',
    bottom: SPACING.sm,
    right: SPACING.sm,
  },
});
