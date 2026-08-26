// src/hooks/useRippleAnimation.js
import { useCallback, useRef } from 'react';
import { Animated, Easing } from 'react-native';

/**
 * Two-phase Material-style ripple (grow while pressed, fade on release),
 * driven entirely by Animated so it renders identically on every platform —
 * unlike Pressable's `android_ripple`, which only ever renders on Android.
 * Spread `onPressIn`/`onPressOut` onto the Pressable and apply `rippleStyle`
 * to an absolutely-positioned Animated.View behind its content; the caller
 * still owns the ripple's own size/color/position via its own style object.
 */
export function useRippleAnimation({
  growDuration = 200,
  fadeDuration = 160,
  peakOpacity = 0.35,
  minScale = 0.3,
} = {}) {
  const growth = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  const onPressIn = useCallback(() => {
    fade.setValue(1);
    growth.setValue(0);
    Animated.timing(growth, {
      toValue: 1,
      duration: growDuration,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [growth, fade, growDuration]);

  const onPressOut = useCallback(() => {
    Animated.timing(fade, {
      toValue: 0,
      duration: fadeDuration,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [fade, fadeDuration]);

  const scale = growth.interpolate({ inputRange: [0, 1], outputRange: [minScale, 1] });
  const opacity = fade.interpolate({ inputRange: [0, 1], outputRange: [0, peakOpacity] });

  return {
    onPressIn,
    onPressOut,
    rippleStyle: { opacity, transform: [{ scale }] },
  };
}

export default useRippleAnimation;
