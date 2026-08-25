// src/components/common/SpotlightHint.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Modal } from 'react-native';
import PropTypes from 'prop-types';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';
import Icon from './Icon';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const SPOTLIGHT_PADDING = 8;

/**
 * SpotlightHint - dims the whole screen and cuts a highlighted hole around
 * an existing on-screen element via an SVG mask, with a short callout next
 * to it. This points *at* the real component instead of adding a new one
 * to the layout — pass the target's measured window rect (x/y/width/height,
 * from a ref's measureInWindow) plus a short message.
 */
export default function SpotlightHint({ visible, target, title, description, onDismiss }) {
  if (!visible || !target) return null;

  const holeX = target.x - SPOTLIGHT_PADDING;
  const holeY = target.y - SPOTLIGHT_PADDING;
  const holeWidth = target.width + SPOTLIGHT_PADDING * 2;
  const holeHeight = target.height + SPOTLIGHT_PADDING * 2;

  // Callout sits below the highlighted area unless that would run off the
  // bottom of the screen, in which case it flips to sit above instead.
  const spaceBelow = screenHeight - (holeY + holeHeight);
  const placeBelow = spaceBelow > 160;
  const calloutTop = placeBelow ? holeY + holeHeight + SPACING.sm : undefined;
  const calloutBottom = placeBelow ? undefined : screenHeight - holeY + SPACING.sm;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={StyleSheet.absoluteFill}>
        <Svg width={screenWidth} height={screenHeight} style={StyleSheet.absoluteFill}>
          <Defs>
            <Mask id="spotlight-mask" x="0" y="0" width="100%" height="100%">
              <Rect x="0" y="0" width="100%" height="100%" fill="#FFFFFF" />
              <Rect x={holeX} y={holeY} width={holeWidth} height={holeHeight} rx={12} fill="#000000" />
            </Mask>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="rgba(15,17,26,0.78)" mask="url(#spotlight-mask)" />
        </Svg>

        <View
          pointerEvents="none"
          style={[styles.highlightRing, { left: holeX, top: holeY, width: holeWidth, height: holeHeight }]}
        />

        <View style={[styles.callout, { left: SPACING.lg, right: SPACING.lg, top: calloutTop, bottom: calloutBottom }]}>
          <View style={styles.calloutIconWrap}>
            <Icon name="calendar" size={18} color={COLORS.primary} weight="fill" />
          </View>
          <View style={styles.calloutTextWrap}>
            {title && <Text style={styles.calloutTitle}>{title}</Text>}
            <Text style={styles.calloutText}>{description}</Text>
          </View>
          <TouchableOpacity
            style={styles.gotItButton}
            onPress={onDismiss}
            activeOpacity={0.8}
            accessibilityLabel="Got it, dismiss tip"
            accessibilityRole="button"
          >
            <Text style={styles.gotItText}>Got it</Text>
          </TouchableOpacity>
        </View>
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
  onDismiss: PropTypes.func.isRequired,
};

const styles = StyleSheet.create({
  highlightRing: {
    position: 'absolute',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.secondary,
  },
  callout: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: SPACING.md,
  },
  calloutIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  calloutTextWrap: {
    marginBottom: SPACING.sm,
  },
  calloutTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  calloutText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  gotItButton: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  gotItText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: '#FFFFFF',
  },
});
