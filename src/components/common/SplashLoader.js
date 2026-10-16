// src/components/common/SplashLoader.js
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../styles/typography';

const MESSAGES = ['Preparing ChemStock', 'Loading your workspace', 'Almost there'];
const TYPE_MS = 45;
const HOLD_MS = 900;
const DOT_COUNT = 3;

/**
 * Loading state shown under the splash logo: the message types out like the
 * login screen's headline, with three dots pulsing in turn beside it.
 */
export default function SplashLoader({ style }) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [visibleLength, setVisibleLength] = useState(0);
  const dots = useRef(Array.from({ length: DOT_COUNT }, () => new Animated.Value(0.25))).current;

  const message = MESSAGES[messageIndex];

  useEffect(() => {
    const timer = visibleLength < message.length
      ? setTimeout(() => setVisibleLength((length) => length + 1), TYPE_MS)
      : setTimeout(() => {
          setMessageIndex((index) => (index + 1) % MESSAGES.length);
          setVisibleLength(0);
        }, HOLD_MS);
    return () => clearTimeout(timer);
  }, [visibleLength, message]);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.stagger(
        160,
        dots.map((dot) =>
          Animated.sequence([
            Animated.timing(dot, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(dot, { toValue: 0.25, duration: 320, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          ])
        )
      )
    );
    pulse.start();
    return () => pulse.stop();
  }, [dots]);

  return (
    <View style={[styles.container, style]} accessibilityRole="progressbar" accessibilityLabel="Loading ChemStock">
      <Text style={styles.message}>{message.slice(0, visibleLength)}</Text>
      <View style={styles.dots}>
        {dots.map((opacity, index) => (
          <Animated.View key={index} style={[styles.dot, { opacity }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 10,
  },
  message: {
    // Fixed height so the dots don't jump while the text types out.
    height: 22,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.primary,
    letterSpacing: 0.3,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
});
