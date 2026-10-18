// src/components/common/SyncStatusBadge.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import useConnectionStatus from '../../hooks/useConnectionStatus';
import { formatAsOf } from '../../utils/formatters';
import useSavedDataTime from '../../utils/savedDataTime';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../styles/typography';

/**
 * SyncStatusBadge - green dot "Online", or red dot with how old the data on screen
 * is (else the last time the app reached the server). With no `status` prop it follows the live connection
 * state; pass `status` to force a fixed state (e.g. in a preview).
 */
export default function SyncStatusBadge({ status }) {
  const live = useConnectionStatus();
  const online = status ? status === 'online' : live.online;
  const savedAt = useSavedDataTime();

  const label = online ? 'Online' : `Offline · as of ${formatAsOf(savedAt ?? live.lastOnlineAt)}`;
  const color = online ? COLORS.success : COLORS.error;

  return (
    <View style={styles.container}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, !online && { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

SyncStatusBadge.propTypes = {
  status: PropTypes.oneOf(['online', 'offline']),
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  label: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
});
