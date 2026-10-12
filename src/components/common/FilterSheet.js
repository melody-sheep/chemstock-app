import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import PropTypes from 'prop-types';
import DateTimePicker from '@react-native-community/datetimepicker';
import CustomModal from './Modal';
import Icon from './Icon';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { RADIUS } from '../../styles/radius';

const formatShortDate = (date) =>
  date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null;

/**
 * FilterSheet - bottom-sheet radio list for single-choice filters, with an
 * optional "Custom date range" section at the bottom.
 *
 * Selecting an option applies it and closes the sheet immediately.
 * If `clearKey` is provided and the currently-selected key is not that key,
 * a "Clear filter" row appears at the bottom of the list.
 *
 * The custom date range section only renders when a caller passes
 * `onDateRangeChange` — screens that don't (e.g. StockLogsScreen until it
 * adopts it) keep working with zero changes to their own call site.
 */
export default function FilterSheet({
  visible,
  onClose,
  title,
  options,
  selectedKey,
  onSelect,
  clearKey = null,
  clearLabel = 'Clear filter',
  dateRange = null,
  onDateRangeChange = null,
}) {
  const supportsDateRange = typeof onDateRangeChange === 'function';
  const [isDateSectionOpen, setIsDateSectionOpen] = useState(false);
  const [pendingFrom, setPendingFrom] = useState(dateRange?.from ?? null);
  const [pendingTo, setPendingTo] = useState(dateRange?.to ?? null);
  const [activePickerField, setActivePickerField] = useState(null); // 'from' | 'to' | null

  const handleSelect = (key) => {
    onSelect(key);
    onClose();
  };

  const openDateSection = () => {
    setPendingFrom(dateRange?.from ?? null);
    setPendingTo(dateRange?.to ?? null);
    setIsDateSectionOpen(true);
  };

  const handleDateChange = (field) => (event, selectedDate) => {
    setActivePickerField(null);
    if (event.type === 'set' && selectedDate) {
      if (field === 'from') setPendingFrom(selectedDate);
      else setPendingTo(selectedDate);
    }
  };

  const applyDateRange = () => {
    if (!pendingFrom || !pendingTo) return;
    onDateRangeChange({ from: pendingFrom, to: pendingTo });
    setIsDateSectionOpen(false);
    onClose();
  };

  const clearDateRange = () => {
    setPendingFrom(null);
    setPendingTo(null);
    setIsDateSectionOpen(false);
    onDateRangeChange(null);
  };

  const showClear = clearKey != null && selectedKey !== clearKey;
  const hasActiveDateRange = !!(dateRange?.from && dateRange?.to);

  return (
    <CustomModal visible={visible} onClose={onClose} height="auto" maxHeight={620}>
      <View style={styles.headerRow}>
        <View style={styles.headerTextCol}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>Tap to select</Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeButton}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Icon name="xCircle" size={22} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
        <View style={styles.list}>
          {options.map((option) => {
            const isSelected = option.key === selectedKey;
            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.row, isSelected && styles.rowSelected]}
                onPress={() => handleSelect(option.key)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
              >
                {!!option.icon && (
                  <View style={styles.rowIconWrap}>
                    <Icon name={option.icon} size={20} color={COLORS.primary} />
                  </View>
                )}
                <View style={styles.rowTextCol}>
                  <Text style={[styles.rowText, isSelected && styles.rowTextSelected]}>{option.label}</Text>
                  {!!option.description && <Text style={styles.rowDescription}>{option.description}</Text>}
                </View>
                <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                  {isSelected && <Icon name="check" size={12} color="#FFFFFF" weight="bold" />}
                </View>
              </TouchableOpacity>
            );
          })}

          {supportsDateRange && (
            <>
              <TouchableOpacity
                style={styles.row}
                onPress={openDateSection}
                activeOpacity={0.7}
                accessibilityRole="button"
              >
                <View style={styles.rowIconWrap}>
                  <Icon name="calendar" size={20} color={COLORS.primary} />
                </View>
                <View style={styles.rowTextCol}>
                  <Text style={styles.rowText}>Custom date range</Text>
                  <Text style={styles.rowDescription}>
                    {hasActiveDateRange
                      ? `${formatShortDate(dateRange.from)} – ${formatShortDate(dateRange.to)}`
                      : 'Pick a specific period'}
                  </Text>
                </View>
                {hasActiveDateRange && (
                  <TouchableOpacity
                    onPress={clearDateRange}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Clear date range"
                  >
                    <Text style={styles.clearRangeText}>Clear</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              {isDateSectionOpen && (
                <View style={styles.dateSection}>
                  <View style={styles.dateInputsRow}>
                    <TouchableOpacity
                      style={styles.dateInput}
                      onPress={() => setActivePickerField('from')}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.dateInputLabel}>From</Text>
                      <Text style={styles.dateInputValue}>
                        {pendingFrom ? formatShortDate(pendingFrom) : 'Select'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.dateInput}
                      onPress={() => setActivePickerField('to')}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.dateInputLabel}>To</Text>
                      <Text style={styles.dateInputValue}>
                        {pendingTo ? formatShortDate(pendingTo) : 'Select'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={[styles.applyRangeButton, (!pendingFrom || !pendingTo) && styles.applyRangeButtonDisabled]}
                    onPress={applyDateRange}
                    disabled={!pendingFrom || !pendingTo}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.applyRangeText}>Apply range</Text>
                  </TouchableOpacity>
                </View>
              )}

              {activePickerField === 'from' && (
                <DateTimePicker
                  value={pendingFrom || new Date()}
                  mode="date"
                  display="calendar"
                  maximumDate={pendingTo || undefined}
                  onChange={handleDateChange('from')}
                />
              )}
              {activePickerField === 'to' && (
                <DateTimePicker
                  value={pendingTo || new Date()}
                  mode="date"
                  display="calendar"
                  minimumDate={pendingFrom || undefined}
                  onChange={handleDateChange('to')}
                />
              )}
            </>
          )}
        </View>
      </ScrollView>

      {showClear && (
        <TouchableOpacity
          style={styles.clearRow}
          onPress={() => handleSelect(clearKey)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={clearLabel}
        >
          <Icon name="xCircle" size={16} color={COLORS.error} />
          <Text style={styles.clearText}>{clearLabel}</Text>
        </TouchableOpacity>
      )}
    </CustomModal>
  );
}

FilterSheet.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      description: PropTypes.string,
      icon: PropTypes.string,
    })
  ).isRequired,
  selectedKey: PropTypes.string.isRequired,
  onSelect: PropTypes.func.isRequired,
  clearKey: PropTypes.string,
  clearLabel: PropTypes.string,
  dateRange: PropTypes.shape({
    from: PropTypes.instanceOf(Date),
    to: PropTypes.instanceOf(Date),
  }),
  onDateRangeChange: PropTypes.func,
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  headerTextCol: { flex: 1 },
  title: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textPrimary,
  },
  subtitle: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
  },
  closeButton: {
    padding: SPACING.xs,
  },
  scrollArea: {
    flexGrow: 0,
  },
  clearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
  },
  clearText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.error,
  },
  list: { gap: SPACING.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minHeight: 56,
    paddingVertical: 12,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rowSelected: {
    backgroundColor: COLORS.primary + '0D',
    borderColor: COLORS.primary + '20',
  },
  rowIconWrap: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary + '15',
  },
  rowTextCol: { flex: 1 },
  rowText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textPrimary,
  },
  rowTextSelected: {
    color: COLORS.primary,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  rowDescription: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#C0C0C0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  clearRangeText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.error,
  },
  dateSection: {
    marginTop: SPACING.xs,
    marginBottom: SPACING.xs,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.placeholderBg,
    gap: SPACING.sm,
  },
  dateInputsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  dateInput: {
    flex: 1,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    backgroundColor: '#FFFFFF',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  dateInputLabel: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textTertiary,
  },
  dateInputValue: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textPrimary,
  },
  applyRangeButton: {
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  applyRangeButtonDisabled: {
    backgroundColor: COLORS.primary + '55',
  },
  applyRangeText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: '#FFFFFF',
  },
});
