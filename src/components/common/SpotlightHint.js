// src/components/common/SpotlightHint.js
import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Animated, Easing, useWindowDimensions } from 'react-native';
import PropTypes from 'prop-types';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';
import Icon from './Icon';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const SPOTLIGHT_PADDING = 8;
const HOLE_RADIUS = 16;
const CALLOUT_ROOM = 190;

/**
 * SpotlightHint - dims the screen and cuts a soft, glowing hole around an
 * existing on-screen element (an SVG mask), with a short frosted-glass card
 * next to it. It points *at* the real component instead of adding a new one
 * to the layout: pass the target's measured window rect (x/y/width/height,
 * from a ref's measureInWindow) plus a short message.
 *
 * One tip: shows a "Got it" button. A tour of several tips: pass `step`
 * ({ index, count }) and `onNext`; the card then shows progress dots, a Skip
 * link and Next / Done. (Frosted glass is a translucent white card, not a
 * blur: the blur view paints a dark slab on some Android release builds.)
 */
export default function SpotlightHint({ visible, target, title, description, icon = 'info', round = false, step, onNext, onSkip, onDismiss }) {
  const { width, height } = useWindowDimensions();
  const appear = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const stepKey = `${step?.index ?? 0}-${title}`;

  useEffect(() => {
    if (!visible) return undefined;
    appear.setValue(0);
    Animated.timing(appear, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, stepKey, appear, glow]);

  if (!visible || !target) return null;

  // Keep the cut-out on the screen, whatever the measured rect.
  const holeX = Math.max(target.x - SPOTLIGHT_PADDING, 4);
  const holeY = Math.max(target.y - SPOTLIGHT_PADDING, 4);
  const holeWidth = Math.min(target.width + SPOTLIGHT_PADDING * 2, width - holeX - 4);
  const holeHeight = Math.min(target.height + SPOTLIGHT_PADDING * 2, height - holeY - 4);

  // A round button gets a round hole.
  const holeRadius = round ? Math.min(holeWidth, holeHeight) / 2 : HOLE_RADIUS;

  // The card sits below the highlighted area unless it would run off the
  // bottom, in which case it flips to sit above.
  const spaceBelow = height - (holeY + holeHeight);
  const placeBelow = spaceBelow > CALLOUT_ROOM;
  const calloutTop = placeBelow ? holeY + holeHeight + SPACING.md : undefined;
  const calloutBottom = placeBelow ? undefined : height - holeY + SPACING.md;

  const isTour = !!step && step.count > 1;
  const isLast = !isTour || step.index >= step.count - 1;
  const handlePrimary = isLast ? onDismiss : onNext;
  const handleSkip = onSkip || onDismiss;

  const cardStyle = {
    opacity: appear,
    transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [placeBelow ? -8 : 8, 0] }) }],
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleSkip}>
      <View style={StyleSheet.absoluteFill}>
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Defs>
            <Mask id="spotlight-mask" x="0" y="0" width="100%" height="100%">
              <Rect x="0" y="0" width="100%" height="100%" fill="#FFFFFF" />
              <Rect x={holeX} y={holeY} width={holeWidth} height={holeHeight} rx={holeRadius} fill="#000000" />
            </Mask>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="rgba(9,13,32,0.66)" mask="url(#spotlight-mask)" />
        </Svg>

        <Animated.View
          pointerEvents="none"
          style={[
            styles.glowRing,
            {
              left: holeX - 5,
              top: holeY - 5,
              width: holeWidth + 10,
              height: holeHeight + 10,
              borderRadius: holeRadius + 5,
              opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.75] }),
            },
          ]}
        />
        <View
          pointerEvents="none"
          style={[styles.highlightRing, { left: holeX, top: holeY, width: holeWidth, height: holeHeight, borderRadius: holeRadius }]}
        />

        <Animated.View
          style={[styles.callout, { left: SPACING.lg, right: SPACING.lg, top: calloutTop, bottom: calloutBottom }, cardStyle]}
        >
          <View style={styles.calloutHeader}>
            <View style={styles.iconTile}>
              <Icon name={icon} size={18} color={COLORS.primary} weight="fill" />
            </View>
            {title ? <Text style={styles.calloutTitle}>{title}</Text> : <View style={{ flex: 1 }} />}
          </View>
          <Text style={styles.calloutText}>{description}</Text>

          <View style={styles.footer}>
            {isTour ? (
              <View style={styles.dots} accessibilityLabel={`Tip ${step.index + 1} of ${step.count}`}>
                {Array.from({ length: step.count }).map((_, i) => (
                  <View key={i} style={[styles.dot, i === step.index && styles.dotActive]} />
                ))}
              </View>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            {isTour && !isLast && (
              <TouchableOpacity onPress={handleSkip} activeOpacity={0.7} style={styles.skipButton} accessibilityRole="button" accessibilityLabel="Skip the tips">
                <Text style={styles.skipText}>Skip</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handlePrimary}
              activeOpacity={0.85}
              accessibilityLabel={isLast ? 'Got it, dismiss tip' : 'Next tip'}
              accessibilityRole="button"
            >
              <Text style={styles.primaryText}>{isLast ? (isTour ? 'Done' : 'Got it') : 'Next'}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

SpotlightHint.propTypes = {
  visible: PropTypes.bool.isRequired,
  target: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
    width: PropTypes.number.isRequired,
    height: PropTypes.number.isRequired,
  }),
  title: PropTypes.string,
  description: PropTypes.string.isRequired,
  icon: PropTypes.string,
  round: PropTypes.bool,
  step: PropTypes.shape({ index: PropTypes.number.isRequired, count: PropTypes.number.isRequired }),
  onNext: PropTypes.func,
  onSkip: PropTypes.func,
  onDismiss: PropTypes.func.isRequired,
};

const styles = StyleSheet.create({
  glowRing: {
    position: 'absolute',
    borderRadius: HOLE_RADIUS + 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  highlightRing: {
    position: 'absolute',
    borderRadius: HOLE_RADIUS,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.95)',
  },
  // Frosted glass: a translucent white card with a bright hairline edge.
  callout: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm + 2,
    shadowColor: '#0B1030',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 14,
  },
  calloutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs + 2,
  },
  iconTile: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: 'rgba(3,4,94,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calloutTitle: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textPrimary,
  },
  calloutText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  dots: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(3,4,94,0.18)' },
  dotActive: { width: 18, backgroundColor: COLORS.primary },
  skipButton: { paddingVertical: 8, paddingHorizontal: 8 },
  skipText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: COLORS.textSecondary,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 20,
  },
  primaryText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: '#FFFFFF',
  },
});
