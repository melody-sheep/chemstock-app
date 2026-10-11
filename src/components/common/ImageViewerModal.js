// src/components/common/ImageViewerModal.js
import React, { useEffect } from 'react';
import {
  Modal,
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar as RNStatusBar,
} from 'react-native';
import PropTypes from 'prop-types';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Icon from './Icon';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;

/**
 * ImageViewerModal - full-screen zoomable image viewer.
 *
 * Gestures:
 *  - Pinch to zoom (1x → 4x)
 *  - Double-tap to toggle between 1x and 2.5x
 *  - Drag to pan while zoomed in
 *  - X button (top-right) to close
 *
 * All gestures use react-native-gesture-handler + reanimated, so they run
 * on the UI thread (smooth on lower-end Android devices too).
 *
 * Every time `visible` flips to true, the transform resets to scale 1,
 * translate 0 — so re-opening always starts fresh.
 */
export default function ImageViewerModal({ visible, onClose, imageUri }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = 1;
      savedScale.value = 1;
      translateX.value = 0;
      translateY.value = 0;
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    }
  }, [visible]);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      const next = savedScale.value * e.scale;
      scale.value = Math.min(Math.max(next, MIN_SCALE), MAX_SCALE);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value < 1.1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (savedScale.value > 1) {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (savedScale.value > 1) {
        scale.value = withTiming(1, { duration: 220 });
        savedScale.value = 1;
        translateX.value = withTiming(0, { duration: 220 });
        translateY.value = withTiming(0, { duration: 220 });
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        scale.value = withTiming(DOUBLE_TAP_SCALE, { duration: 220 });
        savedScale.value = DOUBLE_TAP_SCALE;
      }
    });

  const composed = Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan));

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={styles.root}>
        <View style={styles.backdrop} />

        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          activeOpacity={0.7}
          accessibilityLabel="Close image viewer"
          accessibilityRole="button"
        >
          <Icon name="xCircle" size={28} color="#FFFFFF" weight="fill" />
        </TouchableOpacity>

        <GestureDetector gesture={composed}>
          <Animated.View style={[styles.imageWrap, animatedStyle]}>
            {imageUri ? (
              <Image
                source={{ uri: imageUri }}
                style={styles.image}
                resizeMode="contain"
              />
            ) : (
              <Icon name="warningTriangle" size={48} color="#FFFFFF" />
            )}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

ImageViewerModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  imageUri: PropTypes.string,
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  closeButton: {
    position: 'absolute',
    top: (RNStatusBar.currentHeight || 0) + 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  imageWrap: {
    width: SCREEN_W,
    height: SCREEN_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: SCREEN_W,
    height: SCREEN_H,
  },
});
