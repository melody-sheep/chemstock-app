// src/components/common/SignaturePad.js
import React, { useRef, useState } from 'react';
import { View, Text, PanResponder, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import PropTypes from 'prop-types';
import CustomModal from './Modal';
import Button from './Button';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

export const PAD_WIDTH = 300;
export const PAD_HEIGHT = 120;

// "M x y L x y ..." for one stroke; a single tap becomes a small dot.
const pointsToPath = (points) => {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  if (rest.length === 0) return `M ${first.x} ${first.y} L ${first.x + 0.1} ${first.y + 0.1}`;
  return `M ${first.x.toFixed(1)} ${first.y.toFixed(1)} ${rest.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')}`;
};

/**
 * SignaturePad - draw a signature with a finger or stylus. Calls onSave({ width, height, paths })
 * with the strokes as SVG path strings. Nothing is sent anywhere.
 */
export default function SignaturePad({ visible, onClose, onSave }) {
  const [strokes, setStrokes] = useState([]); // finished strokes, each an array of points
  const [current, setCurrent] = useState([]);
  const currentRef = useRef([]);
  const sizeRef = useRef({ width: PAD_WIDTH, height: PAD_HEIGHT });

  const clamp = (value, max) => Math.max(0, Math.min(max, value));
  const pointFrom = (event) => {
    const { locationX, locationY } = event.nativeEvent;
    const { width, height } = sizeRef.current;
    // Map the touch to the fixed drawing space, whatever size the pad is drawn at.
    return {
      x: clamp((locationX / width) * PAD_WIDTH, PAD_WIDTH),
      y: clamp((locationY / height) * PAD_HEIGHT, PAD_HEIGHT),
    };
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        currentRef.current = [pointFrom(event)];
        setCurrent(currentRef.current);
      },
      onPanResponderMove: (event) => {
        currentRef.current = [...currentRef.current, pointFrom(event)];
        setCurrent(currentRef.current);
      },
      onPanResponderRelease: () => {
        const finished = currentRef.current;
        currentRef.current = [];
        setCurrent([]);
        if (finished.length > 0) setStrokes((prev) => [...prev, finished]);
      },
    })
  ).current;

  const reset = () => {
    currentRef.current = [];
    setCurrent([]);
    setStrokes([]);
  };
  const handleClose = () => {
    reset();
    onClose();
  };
  const handleSave = () => {
    if (strokes.length === 0) return;
    onSave({ width: PAD_WIDTH, height: PAD_HEIGHT, paths: strokes.map(pointsToPath) });
    reset();
  };

  const isEmpty = strokes.length === 0 && current.length === 0;

  return (
    <CustomModal visible={visible} onClose={handleClose} height="auto">
      <Text style={styles.title}>Sign here</Text>
      <Text style={styles.subtitle}>Use your finger. Your signature stays on this phone and prints on your reports.</Text>

      <View
        style={styles.pad}
        onLayout={(event) => {
          sizeRef.current = { width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height };
        }}
        {...panResponder.panHandlers}
      >
        <Svg width="100%" height="100%" viewBox={`0 0 ${PAD_WIDTH} ${PAD_HEIGHT}`} pointerEvents="none">
          {strokes.map((points, index) => (
            <Path key={index} d={pointsToPath(points)} stroke="#272632" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          ))}
          {current.length > 0 && (
            <Path d={pointsToPath(current)} stroke="#272632" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          )}
        </Svg>
        {isEmpty && <Text style={styles.placeholder}>Sign inside this box</Text>}
        <View style={styles.baseline} pointerEvents="none" />
      </View>

      <View style={styles.buttonRow}>
        <View style={styles.buttonCol}>
          <Button title="Clear" variant="outline" onPress={reset} hasShadow={false} height={48} fontSize={16} borderRadius={24} width="100%" />
        </View>
        <View style={styles.buttonCol}>
          <Button title="Save signature" variant="black" onPress={handleSave} disabled={strokes.length === 0} height={48} fontSize={16} borderRadius={24} width="100%" />
        </View>
      </View>
    </CustomModal>
  );
}

SignaturePad.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
};

const styles = StyleSheet.create({
  title: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  subtitle: {
    marginTop: 2,
    marginBottom: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
  },
  pad: {
    aspectRatio: 2.5,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dotted',
    borderColor: '#0085F9',
    backgroundColor: '#F7FBFF',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  placeholder: {
    position: 'absolute',
    alignSelf: 'center',
    fontSize: TYPOGRAPHY.fontSize.base,
    color: '#9AB8D6',
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  baseline: { position: 'absolute', left: 16, right: 16, bottom: 36, height: 1, backgroundColor: '#C9D6E6' },
  buttonRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  buttonCol: { flex: 1 },
});
