// src/components/common/DeliveryStatusPill.js
import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const PULSE_MS = 900;

// Each status maps to one accent: in transit is orange and pulses so it reads as live.
const VARIANTS = {
  in_transit: { color: COLORS.accentOrange, pulse: true },
  delivered: { color: COLORS.success, pulse: false },
};
const FALLBACK = { color: COLORS.textSecondary, pulse: false };

/**
 * DeliveryStatusPill - a tinted pill with a dot for a delivery's status. The
 * "In Transit" dot pulses continuously, so an active delivery stands out.
 */
export default function DeliveryStatusPill({ status, label }) {
  const variant = VARIANTS[status] || FALLBACK;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!variant.pulse) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.25, duration: PULSE_MS, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: PULSE_MS, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [variant.pulse, pulse]);

  return (
    <View style={[styles.pill, { backgroundColor: variant.color + '1F', borderColor: variant.color }]}>
      <Animated.View
        style={[styles.dot, { backgroundColor: variant.color }, variant.pulse && { opacity: pulse }]}
      />
      <Text style={[styles.label, { color: variant.color }]}>{label}</Text>
    </View>
  );
}

DeliveryStatusPill.propTypes = {
  status: PropTypes.string,
  label: PropTypes.string.isRequired,
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 999,
    borderWidth: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
});
