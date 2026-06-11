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

const { height: screenHeight } = Dimensions.get('window');

export default function CustomModal({
  visible,
  onClose,
  children,
  height = 467,
  backgroundColor = '#FFFFFF',
  closeOnBackdropPress = true,
  backdropOpacity = 0.2,
}) {
  const handleBackdropPress = () => {
    if (closeOnBackdropPress) {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <View style={[styles.overlay, { backgroundColor: `rgba(0, 0, 0, ${backdropOpacity})` }]}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View
              style={[
                styles.modalContainer,
                {
                  height: height,
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
  modalContainer: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING['3xl'],
    width: '100%',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: -10,
    },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 10,
  },
});