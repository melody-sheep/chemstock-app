// src/components/common/BranchSelector.js
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

/**
 * BranchSelector - chip row for choosing which branch's stock a screen shows.
 * Each branch keeps its own storage, so stock screens filter by this choice.
 * Renders nothing for a single-branch account, so those screens look unchanged.
 *
 * Redesigned Oct 8 — the original horizontal ScrollView + TouchableOpacity +
 * gap version kept rendering the active chip overlapping the inactive one on
 * Android, and it survived a full cache-clear rebuild, so it wasn't a stale
 * bundle and it wasn't fixed by swapping `gap` for `marginRight` either.
 * That points at the ScrollView/TouchableOpacity combination itself, not the
 * spacing method: TouchableOpacity wraps its child in an Animated opacity
 * View, which on some Android/Hermes combinations can affect stacking order
 * during a rapid style change (exactly what happens here — the active chip's
 * background swaps on every press). Rebuilt without either: a plain
 * flex-wrap row (no ScrollView — there are only ever 1-2 branches today, so
 * there was never a real need to scroll) and Pressable (no Animated wrapper).
 */
export default function BranchSelector({ branches = [], selectedId = null, onSelect, edgePadding = null }) {
  if (branches.length <= 1) return null;

  // edgePadding: the horizontal padding of the screen's content (pass e.g.
  // SPACING.md), so the first chip lines up with the page title above it.
  const rowStyle = edgePadding !== null ? { paddingHorizontal: edgePadding } : null;

  return (
    <View style={[styles.row, rowStyle]}>
      {branches.map((branch) => {
        const active = branch.id === selectedId;
        return (
          <Pressable
            key={branch.id}
            style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.chipPressed]}
            onPress={() => onSelect(branch.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
              {branch.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
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
  row: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  // flex: 1 (not content-sized) so any number of chips always divides the
  // row evenly and stays on one line — text truncates (numberOfLines={1}
  // below) instead of ever wrapping to a second row.
  chip: {
    flex: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
    marginRight: SPACING.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.borderNeutral,
    backgroundColor: COLORS.textWhite,
    alignItems: 'center',
  },
  chipActive: { backgroundColor: COLORS.textPrimary, borderColor: COLORS.textPrimary },
  chipPressed: { opacity: 0.7 },
  chipText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textPrimary,
  },
  chipTextActive: { color: COLORS.textWhite },
});
