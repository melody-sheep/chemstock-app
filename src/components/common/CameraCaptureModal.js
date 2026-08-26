// src/components/common/CameraCaptureModal.js
import React, { useRef, useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PropTypes from 'prop-types';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import Icon from './Icon';
import Button from './Button';
import BottomSheetModal from './Modal';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { formatCoordinates, formatDateTime } from '../../utils/formatters';

/**
 * CameraCaptureModal - full-screen, camera-only capture (no gallery access
 * anywhere in this UI). Reusable across any flow that needs mandatory
 * photo evidence (shipment receiving now; release/delivery proof later).
 * The permission request is *not* full-screen — it uses the shared
 * bottom-sheet Modal, since asking for a permission doesn't need to take
 * over the whole screen the way the live camera/preview does.
 */
export default function CameraCaptureModal({ visible, onClose, onCapture, initialUri = null }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [previewUri, setPreviewUri] = useState(initialUri);
  const cameraRef = useRef(null);

  // Metadata only exists for a photo taken *this* session — re-opening the
  // modal to just view an already-saved photo (initialUri set) has no
  // captured-at/coords to show, so the strip only appears for a fresh shot.
  const [isFreshCapture, setIsFreshCapture] = useState(false);
  const [capturedAt, setCapturedAt] = useState(null);
  const [previewCoords, setPreviewCoords] = useState(null);
  const [previewLocationError, setPreviewLocationError] = useState(null);

  // Re-sync to the caller's existing photo each time the modal opens, so
  // "view" (initialUri set) lands on the review screen while "retake" /
  // "take photo" (initialUri null) lands on the live camera.
  useEffect(() => {
    if (visible) {
      setPreviewUri(initialUri || null);
      setIsFreshCapture(false);
    }
  }, [visible, initialUri]);

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
      setIsFreshCapture(true);
      setCapturedAt(new Date());
      setPreviewCoords(null);
      setPreviewLocationError(null);

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setPreviewLocationError('Location permission denied');
          return;
        }
        const position = await Location.getCurrentPositionAsync({});
        setPreviewCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      } catch (locationError) {
        console.error('[ERROR] [CameraCaptureModal] Location error:', locationError);
        setPreviewLocationError('Unable to determine location');
      }
    } catch (error) {
      console.error('[ERROR] [CameraCaptureModal] Capture failed:', error);
    }
  };

  const handleRetake = () => setPreviewUri(null);

  const handleUsePhoto = () => {
    onCapture(previewUri);
    setPreviewUri(null);
    setIsCameraReady(false);
    onClose();
  };

  const hasPermission = !!permission?.granted;

  return (
    <>
      <Modal
        visible={visible && hasPermission}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleClose}
      >
        <SafeAreaView style={styles.container}>
          {previewUri ? (
            <>
              <Image source={{ uri: previewUri }} style={styles.preview} resizeMode="contain" />

              {isFreshCapture && (
                <View style={styles.metaStrip}>
                  <View style={styles.metaRow}>
                    <Icon name="calendar" size={14} color="#FFFFFF" />
                    <Text style={styles.metaText}>{formatDateTime(capturedAt)}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Icon name="location" size={14} color="#FFFFFF" />
                    <Text style={styles.metaText}>
                      {previewCoords
                        ? formatCoordinates(previewCoords.latitude, previewCoords.longitude)
                        : previewLocationError || 'Locating…'}
                    </Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Icon name="package" size={14} color="#FFFFFF" />
                    <Text style={styles.metaText}>{Device.modelName || 'Unknown device'}</Text>
                  </View>
                </View>
              )}

              <View style={styles.previewActions}>
                <Button
                  title="Retake"
                  variant="outline"
                  accentColor="#FFFFFF"
                  icon="returns"
                  iconSize={18}
                  onPress={handleRetake}
                  style={[styles.actionButton, styles.glassButton]}
                />
                <Button
                  title="Use Photo"
                  variant="outline"
                  accentColor="#1A1A1A"
                  icon="checkmark"
                  iconSize={18}
                  onPress={handleUsePhoto}
                  style={[styles.actionButton, styles.glassButtonSolid]}
                />
              </View>
            </>
          ) : (
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
          )}
        </SafeAreaView>
      </Modal>

      <BottomSheetModal visible={visible && !hasPermission} onClose={handleClose} height={340}>
        <View style={styles.permissionSheet}>
          <View style={styles.permissionIconCircle}>
            <Icon name="camera" size={30} color={COLORS.primary} />
          </View>
          <Text style={styles.permissionTitle}>Camera Access Needed</Text>
          <Text style={styles.permissionText}>
            ChemStock needs your camera to capture proof of the waybill/invoice for this shipment.
          </Text>
          <Button title="Grant Camera Access" onPress={requestPermission} style={styles.permissionButton} />
          <TouchableOpacity onPress={handleClose} style={styles.permissionCancelBtn} activeOpacity={0.7}>
            <Text style={styles.permissionCancelText}>Not now</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetModal>
    </>
  );
}

CameraCaptureModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onCapture: PropTypes.func.isRequired,
  initialUri: PropTypes.string,
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
  metaStrip: {
    gap: SPACING.xs,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    backgroundColor: '#000000',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  metaText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: '#FFFFFF',
  },
  previewActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.lg,
    backgroundColor: '#000000',
  },
  actionButton: { flex: 1 },
  // Faked "glassmorphism" (translucent + light border, no real blur library
  // pulled in for one screen) — fits the dark camera preview instead of the
  // app's usual navy buttons, which read oddly over a live camera feed.
  glassButton: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  glassButtonSolid: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  permissionSheet: {
    alignItems: 'center',
  },
  permissionIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  permissionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  permissionText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  permissionButton: {
    width: '100%',
  },
  permissionCancelBtn: {
    marginTop: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  permissionCancelText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textSecondary,
  },
});
