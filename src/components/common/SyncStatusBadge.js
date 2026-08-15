// src/components/common/SyncStatusBadge.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { TYPOGRAPHY } from '../../styles/typography';

/**
 * SyncStatusBadge - small dot + label showing connection/sync state.
 * Only 'online' is used today; 'offline' is reserved for once local
 * SQLite offline sync (Sprint 5) lands and queued writes need surfacing.
 */
export default function SyncStatusBadge({ status = 'online' }) {
  const isOnline = status === 'online';
  return (
    <View style={styles.container}>
      <View style={[styles.dot, isOnline ? styles.dotOnline : styles.dotOffline]} />
      <Text style={styles.label}>{isOnline ? 'Online' : 'Offline Sync'}</Text>
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
    gap: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  dotOnline: {
    backgroundColor: '#B7FFD6',
    borderColor: '#00FF6E',
  },
  dotOffline: {
    backgroundColor: '#FFE0B2',
    borderColor: '#FF9800',
  },
  label: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: '#555353',
  },
});
