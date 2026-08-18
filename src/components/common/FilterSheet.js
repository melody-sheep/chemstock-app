// src/components/common/FilterSheet.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import CustomModal from './Modal';
import Icon from './Icon';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

/**
 * FilterSheet - bottom-sheet radio list for single-choice filters (e.g.
 * "All" vs "Near Expiry Only", or a date range). Selecting an option applies
 * it and closes the sheet immediately — no separate Apply step, since these
 * are cheap, instantly-visible filters rather than a multi-field form.
 */
export default function FilterSheet({ visible, onClose, title, options, selectedKey, onSelect }) {
  const handleSelect = (key) => {
    onSelect(key);
    onClose();
  };

  return (
    <CustomModal visible={visible} onClose={onClose} height={Math.min(140 + options.length * 56, 520)}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.list}>
        {options.map((option, index) => {
          const isSelected = option.key === selectedKey;
          return (
            <TouchableOpacity
              key={option.key}
              style={[styles.row, index === options.length - 1 && styles.rowLast]}
              onPress={() => handleSelect(option.key)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
            >
              <Text style={[styles.rowText, isSelected && styles.rowTextSelected]}>{option.label}</Text>
              {isSelected && <Icon name="checkmark" size={18} color={COLORS.primary} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </CustomModal>
  );
}

FilterSheet.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({ key: PropTypes.string.isRequired, label: PropTypes.string.isRequired })
  ).isRequired,
  selectedKey: PropTypes.string.isRequired,
  onSelect: PropTypes.func.isRequired,
};

const styles = StyleSheet.create({
  title: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  list: { gap: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  rowLast: { borderBottomWidth: 0 },
  rowText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textPrimary,
  },
  rowTextSelected: {
    color: COLORS.primary,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
});
