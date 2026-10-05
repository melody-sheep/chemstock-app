// src/components/common/BranchSelector.js
import React from 'react';
import { ScrollView, Text, TouchableOpacity, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

/**
 * BranchSelector - chip row for choosing which branch's stock a screen shows.
 * Each branch keeps its own storage, so stock screens filter by this choice.
 * Renders nothing for a single-branch account, so those screens look unchanged.
 */
export default function BranchSelector({ branches = [], selectedId = null, onSelect, edgePadding = null }) {
  if (branches.length <= 1) return null;

  // edgePadding: the horizontal padding of the screen's content (pass e.g.
  // SPACING.md). The row then extends to the screen edges so chips scroll off
  // the edge instead of being cut at the padding, and the first chip still
  // lines up with the page title. Null keeps the default inset.
  const bleedStyle = edgePadding !== null ? { marginHorizontal: -edgePadding } : null;
  const rowStyle = edgePadding !== null ? { paddingHorizontal: edgePadding } : null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.wrap, bleedStyle]}
      contentContainerStyle={[styles.row, rowStyle]}
    >
      {branches.map((branch) => {
        const active = branch.id === selectedId;
        return (
          <TouchableOpacity
            key={branch.id}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onSelect(branch.id)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
              {branch.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

BranchSelector.propTypes = {
  branches: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string.isRequired, name: PropTypes.string })),
  selectedId: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
  edgePadding: PropTypes.number,
};

// Neutral chips (dark text, grey outline) so the selector doesn't read as a
// blue link. The selected chip is filled dark so it still stands out.
const styles = StyleSheet.create({
  wrap: { flexGrow: 0, paddingTop: SPACING.sm },
  row: { paddingHorizontal: SPACING.lg, gap: SPACING.sm },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.borderNeutral,
    backgroundColor: COLORS.textWhite,
  },
  chipActive: { backgroundColor: COLORS.textPrimary, borderColor: COLORS.textPrimary },
  chipText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textPrimary,
  },
  chipTextActive: { color: COLORS.textWhite },
});
