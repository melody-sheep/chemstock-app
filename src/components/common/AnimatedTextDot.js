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
  
  const bgAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const intervalRef = useRef(null);
  
  const currentItem = data[currentIndex] || { text: '', bgColor: COLORS.primary };
  
  const getTypingSpeed = (textLength) => {
    const targetDuration = 1000;
    const speed = Math.floor(targetDuration / textLength);
    return Math.min(60, Math.max(20, speed));
  };
  
  const typeText = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    let i = 0;
    setDisplayText('');
    fadeAnim.setValue(1);
    
    const textLength = currentItem.text.length;
    const typingSpeed = getTypingSpeed(textLength);
    
    const forwardInterval = setInterval(() => {
      if (i < currentItem.text.length) {
        setDisplayText(currentItem.text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(forwardInterval);
        
        const waitTime = Math.max(400, 800 - (textLength * 15));
        
        setTimeout(() => {
          Animated.timing(fadeAnim, {
            toValue: 0.7,
            duration: 100,
            useNativeDriver: false,
          }).start();
          
          let j = currentItem.text.length;
          const reverseSpeed = Math.min(35, Math.max(15, typingSpeed - 10));
          
          const reverseInterval = setInterval(() => {
            if (j > 0) {
              setDisplayText(currentItem.text.slice(0, j - 1));
              j--;
            } else {
              clearInterval(reverseInterval);
              fadeAnim.setValue(1);
              
              const nextIndex = (currentIndex + 1) % data.length;
              
              Animated.timing(bgAnim, {
                toValue: nextIndex,
                duration: 400,
                easing: Easing.bezier(0.25, 0.1, 0.25, 1),
                useNativeDriver: false,
              }).start(() => {
                if (nextIndex === 0 && !loop) return;
                setCurrentIndex(nextIndex);
              });
            }
          }, reverseSpeed);
        }, waitTime);
      }
    }, typingSpeed);
    
    intervalRef.current = forwardInterval;
  };
  
  useEffect(() => {
    if (data.length > 0) typeText();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [currentIndex]);
  
  const bgColor = bgAnim.interpolate({
    inputRange: [...Array(data.length).keys()],
    outputRange: data.map(item => item.bgColor)
  });
  
  if (data.length === 0) return null;
  
  return (
    <Animated.View style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.centerContainer, { marginTop: yOffset }]}>
        <View style={styles.row}>
          <Animated.Text 
            style={[
              styles.text,
              { 
                opacity: fadeAnim,
                color: COLORS.textWhite,
                fontFamily: TYPOGRAPHY.fontFamily?.bold,
                fontSize: textSize,
              }
            ]}
          >
            {displayText}
          </Animated.Text>
          <Animated.View 
            style={[
              styles.dot,
              { 
                opacity: fadeAnim,
                backgroundColor: COLORS.textWhite,
                width: dotSize,
                height: dotSize,
                borderRadius: dotSize / 2,
              }
            ]} 
          />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { fontWeight: 'bold' },
  dot: { marginLeft: 8 },
});