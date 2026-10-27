// src/components/common/PermissionsPrompt.js
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Image, Modal, StyleSheet, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Camera } from 'expo-camera';
import Icon from './Icon';
import Button from './Button';
import storage from '../../utils/storage';
import { debugLog } from '../../utils/logger';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const SEEN_KEY = 'chemstock_permissions_prompted_v1';
const LOGO = require('../../../assets/ChemStockLogo.png');

const ITEMS = [
  {
    key: 'location',
    icon: 'location',
    iconColor: '#F04D59',
    title: 'Location',
    text: 'Records where stock is released, received and delivered.',
  },
  {
    key: 'camera',
    icon: 'camera',
    iconColor: '#03045E',
    title: 'Camera',
    text: 'Scans QR codes and takes photo proof for handovers and reports.',
  },
];

const readStatus = async () => {
  const [location, camera] = await Promise.all([
    Location.getForegroundPermissionsAsync().catch(() => null),
    Camera.getCameraPermissionsAsync().catch(() => null),
  ]);
  return {
    location: location?.status === 'granted',
    camera: camera?.status === 'granted',
    // A permission the user denied twice can't be asked for again in the app.
    canAsk: (location?.canAskAgain ?? true) && (camera?.canAskAgain ?? true),
  };
};

/**
 * Shown once, on the first launch after a fresh install: lists what the app
 * needs and asks for it with one "Allow" tap, instead of the user finding
 * blocked permissions later. Skipped when everything is already allowed.
 * Settings → Device & Sync still shows (and fixes) the same permissions later.
 */
export default function PermissionsPrompt() {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState({ location: false, camera: false, canAsk: true });
  const [isAsking, setIsAsking] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (await storage.get(SEEN_KEY)) return;
        const current = await readStatus();
        if (!active) return;
        setStatus(current);
        if (current.location && current.camera) {
          storage.set(SEEN_KEY, true);
          return;
        }
        setVisible(true);
      } catch (error) {
        debugLog('warn', 'Permissions', 'Could not check permissions at launch', { error: error.message });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const finish = useCallback(() => {
    storage.set(SEEN_KEY, true);
    setVisible(false);
  }, []);

  const handleAllow = async () => {
    if (isAsking) return;
    // Denied for good: the phone's settings are the only way left.
    if (!status.canAsk) {
      Linking.openSettings();
      finish();
      return;
    }
    setIsAsking(true);
    try {
      if (!status.location) await Location.requestForegroundPermissionsAsync();
      if (!status.camera) await Camera.requestCameraPermissionsAsync();
    } catch (error) {
      debugLog('warn', 'Permissions', 'Permission request failed', { error: error.message });
    }
    const after = await readStatus();
    debugLog('info', 'Permissions', 'First-launch prompt answered', { location: after.location, camera: after.camera });
    setStatus(after);
    setIsAsking(false);
    finish();
  };

  const allGranted = status.location && status.camera;

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={() => {}}>
      <View style={[styles.screen, { paddingTop: insets.top + SPACING.xl, paddingBottom: Math.max(insets.bottom + SPACING.sm, SPACING.lg) }]}>
        <StatusBar style="dark" />
        <View style={styles.body}>
          <View style={styles.hero}>
            <View style={styles.heroCircle}>
              <Image source={LOGO} style={styles.logo} resizeMode="contain" accessibilityLabel="ChemStock" />
            </View>
            <Text style={styles.title}>Allow access to get started</Text>
            <Text style={styles.subtitle}>
              ChemStock needs these two things to record stock movements. You can change them any time in Settings.
            </Text>
          </View>

          <View style={styles.list}>
            {ITEMS.map((item, index) => (
              <View key={item.key} style={[styles.row, index > 0 && styles.rowDivider]}>
                <View style={[styles.rowIcon, { backgroundColor: item.iconColor + '14' }]}>
                  <Icon name={item.icon} size={22} color={item.iconColor} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{item.title}</Text>
                  <Text style={styles.rowBody}>{item.text}</Text>
                </View>
                {status[item.key] && (
                  <View style={styles.allowedPill}>
                    <Icon name="checkCircle" size={14} color={COLORS.success} weight="fill" />
                    <Text style={styles.allowedText}>Allowed</Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          <View style={styles.privacyNote}>
            <Icon name="lock" size={14} color={COLORS.textSecondary} />
            <Text style={styles.privacyText}>Location is only used while the app is open.</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Button
            title={allGranted ? 'Continue' : status.canAsk ? 'Allow' : 'Open Settings'}
            variant="black"
            onPress={allGranted ? finish : handleAllow}
            disabled={isAsking}
            height={52}
            fontSize={16}
            style={styles.fullWidth}
          />
          {isAsking && <ActivityIndicator style={styles.spinner} color={COLORS.primary} />}
          {!allGranted && (
            <TouchableOpacity onPress={finish} disabled={isAsking} style={styles.laterLink} activeOpacity={0.7}>
              <Text style={styles.laterText}>Not now</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.lg,
  },
  // The content sits together in the middle instead of being spread to the screen's edges.
  body: { flex: 1, justifyContent: 'center', gap: SPACING.xl },
  hero: { alignItems: 'center' },
  // The logo file has wide empty margins, so it is drawn larger than the circle it sits in.
  heroCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: '#EEF0FF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: SPACING.lg,
  },
  logo: { width: 150, height: 150 },
  title: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    color: '#272632',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  list: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAEFF5',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: SPACING.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.md },
  rowDivider: { borderTopWidth: 1, borderTopColor: '#EEF2F7' },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  allowedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#E8F6EE',
  },
  allowedText: { fontSize: 12, color: '#1E7A3A', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  privacyNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  privacyText: { fontSize: 12.5, color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.fontFamily.regular },
  rowTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
    color: '#272632',
  },
  rowBody: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
    lineHeight: 17,
  },
  footer: { alignItems: 'center' },
  fullWidth: { width: '100%' },
  spinner: { marginTop: SPACING.sm },
  laterLink: { marginTop: SPACING.md, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg },
  laterText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: COLORS.textSecondary,
  },
});
