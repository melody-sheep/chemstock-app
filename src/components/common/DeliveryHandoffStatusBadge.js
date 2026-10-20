// src/components/common/DeliveryHandoffStatusBadge.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

/**
 * DeliveryHandoffStatusBadge - small colored pill for the SR handoff state.
 * Distinct from DeliveryStatusPill (which tracks in_transit/delivered):
 * this specifically flags whether the SR has confirmed receipt of a
 * collector-mediated delivery.
 *
 *   'pending_sr' → gold    "Awaiting your confirmation"
 *   'confirmed'  → green   "Confirmed"
 *   'disputed'   → red     "Issue reported"
 */
const STATUS_META = {
  pending_sr: {
    label: 'Awaiting your confirmation',
    bg: '#FFF1D6',
    color: '#B26400',
  },
  confirmed: {
    label: 'Confirmed',
    bg: '#EAFBF2',
    color: '#1E7A3A',
  },
  disputed: {
    label: 'Issue reported',
    bg: '#FBDCDC',
    color: '#B91C1C',
  },
  // Confirmed offline on this phone, not synced yet.
  queued: {
    label: 'Confirmed — waiting to send',
    bg: '#E3F2FF',
    color: '#0085F9',
  },
  // Received on this phone; the Collector's "delivered" hasn't synced yet.
  queued_waiting: {
    label: 'Received — waiting for the Collector to go online',
    bg: '#E3F2FF',
    color: '#0085F9',
  },
  // Issue reported offline on this phone, not synced yet.
  queued_issue: {
    label: 'Issue reported — waiting to send',
    bg: '#FBDCDC',
    color: '#B91C1C',
  },
  // Still on the way on the server; the SR can receive it once handed over
  // (the Collector may have marked it delivered offline).
  awaiting_collector: {
    label: 'On the way — receive when handed to you',
    bg: '#FFF1D6',
    color: '#B26400',
  },
};

export default function DeliveryHandoffStatusBadge({ status, style = {} }) {
  const meta = STATUS_META[status] || STATUS_META.pending_sr;
  return (
    <View style={[styles.pill, { backgroundColor: meta.bg }, style]}>
      <Text style={[styles.text, { color: meta.color }]} numberOfLines={1}>
        {meta.label}
      </Text>
    </View>
  );
}

DeliveryHandoffStatusBadge.propTypes = {
  status: PropTypes.oneOf(['pending_sr', 'confirmed', 'disputed']).isRequired,
  style: PropTypes.object,
};

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 5,
  },
  text: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    letterSpacing: 0.2,
  },
});
