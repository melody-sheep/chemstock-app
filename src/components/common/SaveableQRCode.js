// src/components/common/SaveableQRCode.js
import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Alert, Platform } from 'react-native';
import PropTypes from 'prop-types';
import QRCode from 'react-native-qrcode-svg';
// /legacy: the new default APIs (File/Paths, Asset.create()) need native
// modules Expo Go doesn't ship yet ("...Next"), while /legacy is backed by
// the modules Expo Go has always bundled — same reasoning as elsewhere in
// this app (ReceiveStockPreviewScreen originally, now here).
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as Sharing from 'expo-sharing';
import Button from './Button';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

/**
 * SaveableQRCode - renders a QR code plus a "Save to Gallery" action.
 *
 * expo-media-library's full gallery-write access is blocked under plain
 * Expo Go (Expo removed it from Expo Go's bundled native modules in SDK 48
 * due to Play Store policy — a platform restriction, not something app
 * code can work around). Two fallbacks, in order, when that happens:
 *   1. Android's Storage Access Framework — the user picks a real folder
 *      (e.g. "Pictures") via the native picker and the file is written
 *      straight into it, so it actually shows up in Gallery. Not blocked
 *      in Expo Go since it's a different permission model than
 *      MediaLibrary's broad photo/video access.
 *   2. The native share sheet (expo-sharing) — always available as a last
 *      resort, but only *sends* the image to whatever app is chosen; it
 *      does not itself save a copy anywhere on the device.
 */
export default function SaveableQRCode({ value, size = 200, showValueText = true, style = {} }) {
  const qrRef = useRef(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveToGallery = () => {
    if (!qrRef.current) return;
    setIsSaving(true);

    qrRef.current.toDataURL(async (dataURL) => {
      try {
        const base64 = dataURL.includes(',') ? dataURL.split(',')[1] : dataURL;
        const safeName = value.replace(/[^a-zA-Z0-9-_]/g, '_');
        const fileUri = FileSystem.cacheDirectory + `chemstock-qr-${safeName}.png`;
        await FileSystem.writeAsStringAsync(fileUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        try {
          // Scoped to write-only + photo — the unscoped call requests
          // photo+video+audio by default, and Expo Go's shared manifest
          // doesn't declare audio access, which rejects the whole request.
          const { status } = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
          if (status !== 'granted') {
            throw new Error('Photo permission not granted');
          }
          await MediaLibrary.createAssetAsync(fileUri);
          Alert.alert('Saved', 'QR code saved to your photos.');
          return;
        } catch (mediaLibraryError) {
          // Expected under Expo Go — MediaLibrary's full gallery-write
          // access isn't available there.
          console.warn('[WARN] [SaveableQRCode] MediaLibrary save failed:', mediaLibraryError);
        }

        if (Platform.OS === 'android') {
          try {
            const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
            if (permissions.granted) {
              const safUri = await FileSystem.StorageAccessFramework.createFileAsync(
                permissions.directoryUri,
                `chemstock-qr-${safeName}`,
                'image/png'
              );
              await FileSystem.writeAsStringAsync(safUri, base64, {
                encoding: FileSystem.EncodingType.Base64,
              });
              Alert.alert('Saved', 'QR code saved to the folder you selected.');
              return;
            }
          } catch (safError) {
            console.warn('[WARN] [SaveableQRCode] Storage Access Framework save failed, falling back to share:', safError);
          }
        }

        // Last resort — sends the file to whatever app the user picks
        // rather than saving it directly, so tell them that up front.
        const canShare = await Sharing.isAvailableAsync();
        if (!canShare) {
          throw new Error('No save method available on this device');
        }
        Alert.alert(
          'Direct Save Unavailable',
          'Pick an app below to send the QR code to (e.g. Files) — it will not be saved automatically.',
          [{ text: 'Continue', onPress: () => Sharing.shareAsync(fileUri, { mimeType: 'image/png', dialogTitle: 'Save QR Code' }) }]
        );
      } catch (error) {
        console.error('[ERROR] [SaveableQRCode] Save to gallery failed:', error);
        Alert.alert('Failed to Save', 'Could not save the QR code to your photos.');
      } finally {
        setIsSaving(false);
      }
    });
  };

  return (
    <View style={[styles.card, style]}>
      <View style={styles.qrPanel}>
        <QRCode value={value} size={size} getRef={(c) => (qrRef.current = c)} />
      </View>
      {showValueText && (
        <View style={styles.codePill}>
          <Text style={styles.codeText}>{value}</Text>
        </View>
      )}
      <Button
        title={isSaving ? 'Saving…' : 'Save to Gallery'}
        variant="fill"
        accentColor={COLORS.success}
        icon="trayDown"
        iconSize={16}
        onPress={handleSaveToGallery}
        loading={isSaving}
        disabled={isSaving}
        height={40}
        fontSize={14}
        style={styles.saveButton}
      />
    </View>
  );
}

SaveableQRCode.propTypes = {
  value: PropTypes.string.isRequired,
  size: PropTypes.number,
  showValueText: PropTypes.bool,
  style: PropTypes.object,
};

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: SPACING.xs,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  qrPanel: {
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  codePill: {
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
  },
  codeText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  saveButton: {
    width: '100%',
  },
});
