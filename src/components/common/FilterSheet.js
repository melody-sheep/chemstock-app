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
    <CustomModal visible={visible} onClose={onClose} height={Math.min(150 + options.length * 64, 540)}>
      <Text style={styles.title}>{title}</Text>
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
                <View style={[styles.rowIconWrap, isSelected && styles.rowIconWrapSelected]}>
                  <Icon name={option.icon} size={16} color={isSelected ? '#FFFFFF' : COLORS.textSecondary} />
                </View>
              )}
              <View style={styles.rowTextCol}>
                <Text style={[styles.rowText, isSelected && styles.rowTextSelected]}>{option.label}</Text>
                {!!option.description && <Text style={styles.rowDescription}>{option.description}</Text>}
              </View>
              <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                {isSelected && <View style={styles.radioInner} />}
              </View>
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
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      description: PropTypes.string,
      icon: PropTypes.string,
    })
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
  list: { gap: SPACING.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rowSelected: {
    backgroundColor: COLORS.primary + '0D',
    borderColor: COLORS.primary + '33',
  },
  rowIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  rowIconWrapSelected: {
    backgroundColor: COLORS.primary,
  },
  rowTextCol: { flex: 1 },
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
  radioOuterSelected: { borderColor: COLORS.primary },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
});
