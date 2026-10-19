// src/components/common/KeyboardAwareScrollView.js
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { ScrollView, Animated } from 'react-native';
import useKeyboardInset, { scrollFocusedIntoView } from '../../hooks/useKeyboardInset';

/**
 * Drop-in ScrollView for screens with text fields. While the keyboard is
 * open it adds exactly the space the keyboard covers below the content and
 * scrolls the focused field above the keyboard (also when the user taps
 * another field with the keyboard already open). Works the same in Expo Go
 * and in a built APK — see useKeyboardInset.
 *
 * Pass `animated` to render an Animated.ScrollView.
 */
const KeyboardAwareScrollView = forwardRef(function KeyboardAwareScrollView(
  { animated = false, contentContainerStyle, onScroll, onTouchEnd, children, keyboardShouldPersistTaps = 'handled', ...rest },
  ref
) {
  const scrollRef = useRef(null);
  const scrollY = useRef(0);
  // Measured on the scroll view itself (its frame never changes with the
  // padding added below).
  const { inset, keyboardTop, isVisible } = useKeyboardInset(scrollRef);
  useImperativeHandle(ref, () => scrollRef.current);

  const reveal = useCallback(() => {
    // After the added space has been laid out.
    setTimeout(() => scrollFocusedIntoView(scrollRef, scrollY.current, keyboardTop), 60);
  }, [keyboardTop]);

  useEffect(() => {
    if (isVisible) reveal();
  }, [isVisible, reveal]);

  const handleScroll = (event) => {
    scrollY.current = event.nativeEvent.contentOffset.y;
    onScroll?.(event);
  };

  // Tapping another field while the keyboard stays open.
  const handleTouchEnd = (event) => {
    onTouchEnd?.(event);
    if (isVisible) setTimeout(reveal, 250);
  };

  const Component = animated ? Animated.ScrollView : ScrollView;
  return (
    <Component
      ref={scrollRef}
      {...rest}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      onTouchEnd={handleTouchEnd}
      contentContainerStyle={[contentContainerStyle, inset > 0 && { paddingBottom: inset + 24 }]}
    >
      {children}
    </Component>
  );
});

export default KeyboardAwareScrollView;
