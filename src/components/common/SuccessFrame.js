// src/components/common/SuccessFrame.js
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import PropTypes from 'prop-types';
import Icon from './Icon';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const { width: screenWidth } = Dimensions.get('window');

/**
 * SuccessFrame - Full width, no rounded corners
 * Positioned 50px below Header 2
 * Shows: ✅ [x] branches ready for setup (no extra "check char" icon)
 */
export default function SuccessFrame({ visible, branchCount = 0, onFadeComplete = null }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            if (onFadeComplete) onFadeComplete();
          });
        }, 3000);
      });
    } else {
      fadeAnim.setValue(0);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [visible, fadeAnim, onFadeComplete]);

  if (!visible) return null;

  // ✅ REMOVED: "check char" icon - now only shows checkmark + count + text
  const messageText = branchCount === 1 
    ? `${branchCount} branch ready for setup`
    : `${branchCount} branches ready for setup`;

  return (
    <Animated.View 
      style={[
        styles.overlayContainer,
        {
          opacity: fadeAnim,
          transform: [{
            scale: fadeAnim.interpolate({
              inputRange: [0, 0.3, 1],
              outputRange: [0.98, 1.02, 1],
            }),
          }],
        },
      ]}
      pointerEvents="none"
    >
      <View style={styles.frameContainer}>
        <View style={styles.contentRow}>
          <Icon name="checkmarkCircle" size={18} color={COLORS.success} />
          <Text style={styles.messageText}>{messageText}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

SuccessFrame.propTypes = {
  visible: PropTypes.bool.isRequired,
  branchCount: PropTypes.number,
  onFadeComplete: PropTypes.func,
};

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    top: 148,
    left: 0,
    right: 0,
    zIndex: 999,
    alignItems: 'center',
  },
  frameContainer: {
    width: screenWidth,
    height: 36,
    backgroundColor: '#E7FFF2',
    borderRadius: 0,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.success,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  messageText: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.success,
    textAlign: 'center',
  },
});