// src/components/common/Modal.js
import React, { useRef } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  TouchableWithoutFeedback,
  Keyboard,
  Dimensions,
} from 'react-native';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useKeyboardInset from '../../hooks/useKeyboardInset';

const { height: screenHeight } = Dimensions.get('window');

export default function CustomModal({
  visible,
  onClose,
  children,
  height = 467, // pass 'auto' to size the sheet to its content
  maxHeight = null, // only used when height === 'auto'
  backgroundColor = '#FFFFFF',
  closeOnBackdropPress = true,
  backdropOpacity = 0.2,
  // 'sheet' (default): bottom sheet, slides up, full width, rounded top
  // corners only. 'center': small dialog centered on screen, fades/dissolves
  // in instead of sliding, always sized to its content (height is ignored).
  variant = 'sheet',
}) {
  const insets = useSafeAreaInsets();
  const isCentered = variant === 'center';
  // Lifts the sheet above the keyboard in a built APK, where Android no
  // longer resizes the screen for it (see useKeyboardInset).
  const overlayRef = useRef(null);
  const { inset: keyboardInset } = useKeyboardInset(overlayRef);
  // With the keyboard open, a tall sheet must not run off the top.
  const availableHeight = Dimensions.get('window').height - keyboardInset - insets.top - SPACING.md;
  const handleBackdropPress = () => {
    if (closeOnBackdropPress) {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType={isCentered ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <View
          ref={overlayRef}
          collapsable={false}
          style={[
            styles.overlay,
            isCentered && styles.overlayCentered,
            { backgroundColor: `rgba(0, 0, 0, ${backdropOpacity})` },
            keyboardInset > 0 && { paddingBottom: keyboardInset },
          ]}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View
              style={[
                isCentered ? styles.centerContainer : styles.modalContainer,
                {
                  ...(isCentered || height === 'auto' ? {} : { height: keyboardInset > 0 ? Math.min(height, availableHeight) : height }),
                  ...(keyboardInset > 0 ? { maxHeight: availableHeight } : {}),
                  ...(!isCentered && height === 'auto' && maxHeight ? { maxHeight } : {}),
                  ...(isCentered ? {} : { paddingBottom: Math.max(insets.bottom, SPACING.lg) }),
                  backgroundColor: backgroundColor,
                },
              ]}
            >
              {children}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayCentered: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  modalContainer: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING['3xl'],
    width: '100%',
    // Shadows removed for clean, flat design
  },
  centerContainer: {
    borderRadius: 20,
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 340,
  },
});