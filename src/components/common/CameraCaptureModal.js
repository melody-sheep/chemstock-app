// src/components/common/CameraCaptureModal.js
import React, { useRef, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PropTypes from 'prop-types';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Icon from './Icon';
import Button from './Button';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

/**
 * CameraCaptureModal - full-screen, camera-only capture (no gallery access
 * anywhere in this UI). Reusable across any flow that needs mandatory
 * photo evidence (shipment receiving now; release/delivery proof later).
 */
export default function CameraCaptureModal({ visible, onClose, onCapture }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [previewUri, setPreviewUri] = useState(null);
  const cameraRef = useRef(null);

  const handleClose = () => {
    setPreviewUri(null);
    setIsCameraReady(false);
    onClose();
  };

  const handleCapture = async () => {
    if (!cameraRef.current || !isCameraReady) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      setPreviewUri(photo.uri);
    } catch (error) {
      console.error('❌ [CameraCaptureModal] Capture failed:', error);
    }
  };

  const handleRetake = () => setPreviewUri(null);

  const handleUsePhoto = () => {
    onCapture(previewUri);
    setPreviewUri(null);
    setIsCameraReady(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleClose}>
      <SafeAreaView style={styles.container}>
        {previewUri ? (
          <>
            <Image source={{ uri: previewUri }} style={styles.preview} resizeMode="contain" />
            <View style={styles.previewActions}>
              <Button title="Retake" variant="outline" onPress={handleRetake} style={styles.actionButton} />
              <Button title="Use Photo" variant="black" onPress={handleUsePhoto} style={styles.actionButton} />
            </View>
          </>
        ) : permission?.granted ? (
          <>
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing="back"
              onCameraReady={() => setIsCameraReady(true)}
            />
            <View style={styles.topBar}>
              <TouchableOpacity style={styles.closeButton} onPress={handleClose} accessibilityLabel="Close camera">
                <Icon name="xCircle" size={28} color="#FFFFFF" weight="fill" />
              </TouchableOpacity>
            </View>
            <View style={styles.bottomBar}>
              <TouchableOpacity
                style={styles.shutterButton}
                onPress={handleCapture}
                disabled={!isCameraReady}
                accessibilityLabel="Take photo"
                accessibilityRole="button"
              >
                <View style={styles.shutterInner} />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.permissionWrap}>
            <Icon name="camera" size={40} color={COLORS.textSecondary} />
            <Text style={styles.permissionText}>
              Camera access is required to capture shipment proof.
            </Text>
            <Button title="Grant Camera Access" onPress={requestPermission} style={styles.permissionButton} />
            <Button title="Cancel" variant="outline" onPress={handleClose} hasShadow={false} />
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

CameraCaptureModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onCapture: PropTypes.func.isRequired,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  camera: { flex: 1 },
  preview: { flex: 1, backgroundColor: '#000000' },
  topBar: {
    position: 'absolute',
    top: SPACING.md,
    left: SPACING.md,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: SPACING.xl,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  shutterButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
  },
  previewActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.lg,
    backgroundColor: '#000000',
  },
  actionButton: { flex: 1 },
  permissionWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    gap: SPACING.md,
    backgroundColor: COLORS.background,
  },
  permissionText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  permissionButton: { marginTop: SPACING.sm },
});
