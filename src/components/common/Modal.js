// src/components/common/Modal.js
import React from 'react';
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
          style={[
            styles.overlay,
            isCentered && styles.overlayCentered,
            { backgroundColor: `rgba(0, 0, 0, ${backdropOpacity})` },
          ]}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View
              style={[
                isCentered ? styles.centerContainer : styles.modalContainer,
                {
                  ...(isCentered || height === 'auto' ? {} : { height }),
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