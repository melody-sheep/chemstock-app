import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../styles/typography';

export default function AnimatedTextDot({
  data = [],
  loop = true,
  yOffset = -300,
  textSize = 32,
  dotSize = 32,
}) {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState(data.length > 1 ? 1 : 0);

  // Background color never animates directly (backgroundColor interpolation
  // can't use the native driver, which was the main source of jank — every
  // frame had to round-trip the JS thread at the same time setInterval was
  // also driving the typing effect there). Instead: two solid color layers
  // stacked, and only the top one's opacity animates (native-driven) to
  // crossfade into the next color.
  //
  // Text opacity intentionally does NOT animate. An earlier version dipped
  // it to 50% during the erase phase as a polish touch, but that read as a
  // visibility flicker rather than a nice fade — the character-by-character
  // type/erase is already the "animation" for the text itself.
  const crossfade = useRef(new Animated.Value(0)).current;
  const intervalRef = useRef(null);

  const currentItem = data[currentIndex] || { text: '', bgColor: COLORS.primary };
  const nextItem = data[nextIndex] || currentItem;

  const getTypingSpeed = (textLength) => {
    const targetDuration = 1000;
    const speed = Math.floor(targetDuration / textLength);
    return Math.min(60, Math.max(20, speed));
  };

  const advanceTo = (upcoming) => {
    setNextIndex(upcoming);
    crossfade.setValue(0);
    Animated.timing(crossfade, {
      toValue: 1,
      duration: 400,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: true,
    }).start(() => {
      setCurrentIndex(upcoming);
    });
  };

  const typeText = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    let i = 0;
    setDisplayText('');

    const textLength = currentItem.text.length;

    // If text is empty, skip typing animation
    if (textLength === 0) {
      const upcoming = (currentIndex + 1) % data.length;
      setTimeout(() => {
        if (upcoming === 0 && !loop) return;
        advanceTo(upcoming);
      }, 500);
      return;
    }

    const typingSpeed = getTypingSpeed(textLength);

    const forwardInterval = setInterval(() => {
      if (i < currentItem.text.length) {
        setDisplayText(currentItem.text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(forwardInterval);

        const waitTime = Math.max(400, 800 - (textLength * 15));

        setTimeout(() => {
          let j = currentItem.text.length;
          const reverseSpeed = Math.min(35, Math.max(15, typingSpeed - 10));

          const reverseInterval = setInterval(() => {
            if (j > 0) {
              setDisplayText(currentItem.text.slice(0, j - 1));
              j--;
            } else {
              clearInterval(reverseInterval);

              const upcoming = (currentIndex + 1) % data.length;
              if (upcoming === 0 && !loop) return;
              advanceTo(upcoming);
            }
          }, reverseSpeed);
        }, waitTime);
      }
    }, typingSpeed);

    intervalRef.current = forwardInterval;
  };

  useEffect(() => {
    if (data.length > 0 && currentItem.text) {
      typeText();
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [currentIndex]);

  if (data.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: currentItem.bgColor }]} />
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: nextItem.bgColor, opacity: crossfade }]}
      />

      <View style={[styles.centerContainer, { marginTop: yOffset }]}>
        <View style={styles.row}>
          <Text
            style={[
              styles.text,
              {
                color: COLORS.textWhite,
                fontFamily: TYPOGRAPHY.fontFamily?.bold,
                fontSize: textSize,
              },
            ]}
          >
            {displayText || ''}
          </Text>
          <View
            style={[
              styles.dot,
              {
                backgroundColor: COLORS.textWhite,
                width: dotSize,
                height: dotSize,
                borderRadius: dotSize / 2,
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { fontWeight: 'bold' },
  dot: { marginLeft: 8 },
});
