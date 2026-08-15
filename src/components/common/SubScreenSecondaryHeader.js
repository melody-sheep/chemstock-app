// src/components/common/SubScreenSecondaryHeader.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import SecondaryHeader, { SUBSCREEN_HEADER_HEIGHT } from './SecondaryHeader';
import SyncStatusBadge from './SyncStatusBadge';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

/**
 * SubScreenSecondaryHeader - the "title + sync status" SecondaryHeader row
 * used by sub-screens reached from a dashboard (Receive Stock, Add New
 * Batches, and future flows like it). Pulled out once this exact row
 * (same height, same title style, same badge) appeared in two screens.
 */
export default function SubScreenSecondaryHeader({ title, syncStatus = 'online' }) {
  return (
    <SecondaryHeader height={SUBSCREEN_HEADER_HEIGHT}>
      <View style={styles.row}>
        <Text style={styles.title}>{title}</Text>
        <SyncStatusBadge status={syncStatus} />
      </View>
    </SecondaryHeader>
  );
}

SubScreenSecondaryHeader.propTypes = {
  title: PropTypes.string.isRequired,
  syncStatus: PropTypes.oneOf(['online', 'offline']),
};

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
});
