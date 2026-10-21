// src/components/common/RouteLegChips.js
// Distance of each leg of a delivery's route as small chips ("Start ➜ Collector │ 1.2 km"). Display only:
// straight-line distances, coloured with the same tiers the route arrows on the map use
// (blue up to 200 m, orange up to 1 km, red beyond).
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import Icon from './Icon';
import { distanceInMeters, formatDistance } from '../../utils/distance';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const NEAR_METERS = 200;
const MID_METERS = 1000;
// Closer than this the two are standing together (e.g. the Collector has reached the Sales Rep).
const SAME_SPOT_METERS = 30;

const tierFor = (meters) =>
  meters <= NEAR_METERS
    ? { color: '#0085F9', background: '#EAF4FF' }
    : meters <= MID_METERS
      ? { color: '#D98200', background: '#FFF3E0' }
      : { color: '#E63946', background: '#FDECEA' };

const isPoint = (p) => p && typeof p.latitude === 'number' && typeof p.longitude === 'number';

/**
 * @param {Array<{ from: string, to: string, fromCoords: {latitude, longitude}, toCoords: {latitude, longitude} }>} legs
 */
export default function RouteLegChips({ legs }) {
  const rows = (legs || [])
    .filter((leg) => isPoint(leg.fromCoords) && isPoint(leg.toCoords))
    .map((leg) => ({ ...leg, meters: distanceInMeters(leg.fromCoords, leg.toCoords) }))
    .filter((leg) => leg.meters !== null);
  if (rows.length === 0) return null;

  return (
    <View style={styles.row}>
      {rows.map((leg) => {
        const tier = tierFor(leg.meters);
        return (
          <View key={`${leg.from}-${leg.to}`} style={[styles.chip, { backgroundColor: tier.background }]}>
            <Text style={[styles.name, { color: tier.color }]} numberOfLines={1}>{leg.from}</Text>
            <Icon name="arrowRight" size={13} color={tier.color} weight="bold" />
            <Text style={[styles.name, { color: tier.color }]} numberOfLines={1}>{leg.to}</Text>
            <Text style={[styles.distance, { color: tier.color }]}>{leg.meters < SAME_SPOT_METERS ? 'Same spot' : formatDistance(leg.meters)}</Text>
          </View>
        );
      })}
    </View>
  );
}

RouteLegChips.propTypes = {
  legs: PropTypes.arrayOf(
    PropTypes.shape({
      from: PropTypes.string.isRequired,
      to: PropTypes.string.isRequired,
      fromCoords: PropTypes.object,
      toCoords: PropTypes.object,
    })
  ),
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: SPACING.sm, paddingVertical: 5, borderRadius: 12 },
  name: { fontSize: TYPOGRAPHY.fontSize.xs, fontFamily: TYPOGRAPHY.fontFamily.semibold, fontWeight: '600', maxWidth: 100 },
  distance: {
    marginLeft: 4,
    paddingLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(0,0,0,0.12)',
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
});
