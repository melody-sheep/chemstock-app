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
export default function BranchSelector({
  branches = [],
  selectedId = null,
  onSelect,
  edgePadding = null,
  truncateToFirstWord = false,
  compact = false,
}) {
  if (branches.length <= 1) return null;

  // edgePadding: the horizontal padding of the screen's content (pass e.g.
  // SPACING.md), so the first chip lines up with the page title above it.
  const rowStyle = edgePadding !== null ? { paddingHorizontal: edgePadding } : null;

  return (
    <View style={[styles.row, compact && styles.rowCompact, rowStyle]}>
      {branches.map((branch) => {
        const active = branch.id === selectedId;
        const fullName = branch.name || '';
        // Opt-in: show only the first word ("IPONAN BRANCH" -> "IPONAN") where
        // the full name is already shown elsewhere on the screen.
        const displayName = truncateToFirstWord ? fullName.split(' ')[0] || fullName : fullName;
        return (
          <Pressable
            key={branch.id}
            style={({ pressed }) => [
              styles.chip,
              compact && styles.chipCompact,
              active && styles.chipActive,
              pressed && styles.chipPressed,
            ]}
            onPress={() => onSelect(branch.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={fullName}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
              {displayName}
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
  truncateToFirstWord: PropTypes.bool,
  compact: PropTypes.bool,
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
  // compact (opt-in): chips hug their label and sit together on the left,
  // instead of dividing the row evenly. Kept opt-in because the other
  // screens that use this component show full names (and an "All Branches"
  // chip), which would run off the edge if every chip sized to its content.
  // flexShrink lets a long label truncate rather than overflow.
  rowCompact: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: SPACING.sm,
  },
  chipCompact: {
    flex: 0,
    flexShrink: 1,
    paddingHorizontal: SPACING.md,
    marginRight: 0,
    justifyContent: 'center',
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
