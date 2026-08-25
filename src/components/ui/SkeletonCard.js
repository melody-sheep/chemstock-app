// src/components/ui/SkeletonCard.js
import React from 'react';
import { View, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import SkeletonBlock from './SkeletonBlock';
import { SPACING } from '../../styles/spacing';

/**
 * SkeletonCard - one placeholder "card row" (thumbnail + a few text
 * lines), matching the shape most list/card screens in the app already
 * use (StockBatchCard, RegisteredItemsList rows, activity log rows,
 * account rows, etc). Render a handful of these while real data is still
 * loading — see SkeletonList below for that in one call.
 */
export function SkeletonCard({ lines = 2, thumbSize = 56, style }) {
  return (
    <View style={[styles.card, style]}>
      <SkeletonBlock width={thumbSize} height={thumbSize} borderRadius={8} />
      <View style={styles.textColumn}>
        <SkeletonBlock width="70%" height={14} />
        {Array.from({ length: lines }).map((_, index) => (
          <SkeletonBlock key={index} width={index === lines - 1 ? '45%' : '90%'} height={10} />
        ))}
      </View>
    </View>
  );
}

SkeletonCard.propTypes = {
  lines: PropTypes.number,
  thumbSize: PropTypes.number,
  style: PropTypes.object,
};

/**
 * SkeletonList - a handful of SkeletonCards stacked with the given gap,
 * for the common "waiting on a list of rows" case in one line at the call
 * site instead of every screen hand-rolling its own `.map()`.
 */
export function SkeletonList({ count = 3, lines = 2, thumbSize = 56, gap = SPACING.sm, style }) {
  return (
    <View style={[{ gap }, style]}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} lines={lines} thumbSize={thumbSize} />
      ))}
    </View>
  );
}

SkeletonList.propTypes = {
  count: PropTypes.number,
  lines: PropTypes.number,
  thumbSize: PropTypes.number,
  gap: PropTypes.number,
  style: PropTypes.object,
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.sm,
  },
  textColumn: {
    flex: 1,
    gap: 6,
  },
});

export default SkeletonCard;
