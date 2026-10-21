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

// Two colour families only: blue for the choices, a darker blue for the date range, red for clearing.
const CHIP_BLUE = '#0085F9';
const CHIP_BLUE_TEXT = '#0A66C2';
const DATE_TONE = '#03045E';

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
    // The picker returns the chosen day with the current time of day, so
    // "today to today" was a zero-length range that matched nothing. A range
    // always covers whole days.
    const from = new Date(pendingFrom);
    from.setHours(0, 0, 0, 0);
    const to = new Date(pendingTo);
    to.setHours(23, 59, 59, 999);
    onDateRangeChange({ from, to });
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
    <>
    <CustomModal visible={visible} onClose={onClose} height="auto" maxHeight={620}>
      <View style={styles.headerRow}>
        <View style={styles.headerTextCol}>
          <Text style={styles.title}>{title}</Text>
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
          <View style={styles.chipWrap}>
            {options.map((option) => {
              const isSelected = option.key === selectedKey;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.chip,
                    isSelected
                      ? { backgroundColor: option.tone || CHIP_BLUE, borderColor: option.tone || CHIP_BLUE }
                      : option.tone
                      ? { backgroundColor: option.tone + '14', borderColor: option.tone + '55' }
                      : { backgroundColor: '#EAF4FF', borderColor: '#B9D9FF' },
                  ]}
                  onPress={() => handleSelect(option.key)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                >
                  {!!option.icon && <Icon name={option.icon} size={16} color={isSelected ? '#FFFFFF' : option.tone || CHIP_BLUE_TEXT} />}
                  <Text style={[styles.chipText, { color: isSelected ? '#FFFFFF' : option.tone || CHIP_BLUE_TEXT }]}>{option.label}</Text>
                  {isSelected && <Icon name="check" size={13} color="#FFFFFF" weight="bold" />}
                </TouchableOpacity>
              );
            })}

            {supportsDateRange && (
              <TouchableOpacity
                style={[
                  styles.chip,
                  hasActiveDateRange
                    ? { backgroundColor: DATE_TONE, borderColor: DATE_TONE }
                    : { backgroundColor: '#FFFFFF', borderColor: DATE_TONE },
                ]}
                onPress={openDateSection}
                activeOpacity={0.7}
                accessibilityRole="button"
              >
                <Icon name="calendar" size={16} color={hasActiveDateRange ? '#FFFFFF' : DATE_TONE} />
                <Text style={[styles.chipText, { color: hasActiveDateRange ? '#FFFFFF' : DATE_TONE }]}>
                  {hasActiveDateRange
                    ? `${formatShortDate(dateRange.from)} – ${formatShortDate(dateRange.to)}`
                    : 'Custom range'}
                </Text>
                {hasActiveDateRange && (
                  <TouchableOpacity
                    onPress={clearDateRange}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Clear date range"
                  >
                    <Icon name="xCircle" size={15} color="#FFFFFF" weight="fill" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            )}
          </View>

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

    {supportsDateRange && (
      <CustomModal visible={isDateSectionOpen} onClose={() => setIsDateSectionOpen(false)} variant="center">
        <View style={styles.dateIconWrap}>
          <Icon name="calendar" size={24} color={DATE_TONE} />
        </View>
        <Text style={styles.dateTitle}>Custom range</Text>
        <Text style={styles.dateSubtitle}>Pick a start and an end date.</Text>

        <View style={styles.dateInputsRow}>
          <TouchableOpacity style={styles.dateInput} onPress={() => setActivePickerField('from')} activeOpacity={0.7}>
            <Text style={styles.dateInputLabel}>From</Text>
            <Text style={[styles.dateInputValue, !pendingFrom && styles.dateInputPlaceholder]}>
              {pendingFrom ? formatShortDate(pendingFrom) : 'Select'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dateInput} onPress={() => setActivePickerField('to')} activeOpacity={0.7}>
            <Text style={styles.dateInputLabel}>To</Text>
            <Text style={[styles.dateInputValue, !pendingTo && styles.dateInputPlaceholder]}>
              {pendingTo ? formatShortDate(pendingTo) : 'Select'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.applyRangeButton, (!pendingFrom || !pendingTo) && styles.applyRangeButtonDisabled]}
          onPress={applyDateRange}
          disabled={!pendingFrom || !pendingTo}
          activeOpacity={0.7}
          accessibilityRole="button"
        >
          <Text style={styles.applyRangeText}>Apply range</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dateCancel} onPress={() => setIsDateSectionOpen(false)} accessibilityRole="button">
          <Text style={styles.dateCancelText}>Cancel</Text>
        </TouchableOpacity>

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
      </CustomModal>
    )}
    </>
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
      // Optional colour for this one option (e.g. a red-pink for Returns).
      tone: PropTypes.string,
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
  list: { gap: 2 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, paddingTop: SPACING.xs, paddingBottom: SPACING.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipText: { fontSize: TYPOGRAPHY.fontSize.sm, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minHeight: 48,
    paddingVertical: 8,
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
  dateIconWrap: {
    alignSelf: 'center',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EAF4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateTitle: {
    marginTop: SPACING.sm,
    textAlign: 'center',
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textPrimary,
  },
  dateSubtitle: {
    marginTop: 2,
    marginBottom: SPACING.md,
    textAlign: 'center',
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
  },
  dateInputPlaceholder: { color: COLORS.textTertiary },
  dateCancel: { alignItems: 'center', paddingTop: SPACING.sm },
  dateCancelText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: COLORS.textSecondary,
  },
  dateInputsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
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
    fontSize: 12,
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
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#03045E',
  },
  applyRangeButtonDisabled: {
    backgroundColor: '#03045E55',
  },
  applyRangeText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: '#FFFFFF',
  },
});
