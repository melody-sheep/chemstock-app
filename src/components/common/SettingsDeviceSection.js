// src/components/common/SettingsDeviceSection.js
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, AppState, Linking, ActivityIndicator } from 'react-native';
import PropTypes from 'prop-types';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { Camera } from 'expo-camera';
import Icon from './Icon';
import Alert from '../../utils/appAlert';
import { resetHints } from './HintChip';
import useOutbox from '../../hooks/useOutbox';
import useConnectionStatus from '../../hooks/useConnectionStatus';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../styles/typography';
import { SPACING } from '../../styles/spacing';

const PILL = {
  ok: { bg: '#EAFBF2', color: '#1E7A3A' },
  warn: { bg: '#FFF1D6', color: '#B26400' },
  off: { bg: '#FBDCDC', color: '#B91C1C' },
};

// Location: allowed, plus the phone's GPS itself switched on.
async function readLocationStatus() {
  const { status } = await Location.getForegroundPermissionsAsync();
  if (status !== 'granted') return status === 'undetermined' ? 'ask' : 'denied';
  const gpsOn = await Location.hasServicesEnabledAsync().catch(() => true);
  return gpsOn ? 'granted' : 'gps_off';
}

async function readCameraStatus() {
  const { status } = await Camera.getCameraPermissionsAsync();
  if (status === 'granted') return 'granted';
  return status === 'undetermined' ? 'ask' : 'denied';
}

const STATUS_PILL = {
  granted: { label: 'Allowed', tone: 'ok' },
  ask: { label: 'Tap to allow', tone: 'warn' },
  denied: { label: 'Blocked — open settings', tone: 'off' },
  gps_off: { label: 'GPS is off', tone: 'warn' },
};

/**
 * Settings → "Device & Sync": the phone's real location and camera
 * permission (tap to allow, or to open the phone's settings when blocked)
 * and this account's offline sync status with a Sync now button. Replaces
 * switches that only changed on screen and did nothing.
 */
export default function SettingsDeviceSection({ agentId = null, styles: shared }) {
  const connection = useConnectionStatus();
  const { pendingCount, failed, retryNow } = useOutbox(null, agentId ?? null);
  const [locationStatus, setLocationStatus] = useState(null);
  const [cameraStatus, setCameraStatus] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setLocationStatus(await readLocationStatus());
      setCameraStatus(await readCameraStatus());
    } catch (error) {
      // Permission APIs unavailable — leave the rows as they are.
    }
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  // Coming back from the phone's settings app.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const handlePermissionPress = async (kind, status) => {
    if (status === 'granted') return;
    if (status === 'ask') {
      if (kind === 'location') await Location.requestForegroundPermissionsAsync();
      else await Camera.requestCameraPermissionsAsync();
      refresh();
      return;
    }
    if (status === 'gps_off') {
      try {
        await Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
      } catch (error) {
        Linking.openSettings();
      }
      return;
    }
    Linking.openSettings();
  };

  const handleShowTips = async () => {
    await resetHints();
    Alert.alert('Tips Reset', 'The how-to tips will show again on the screens that have them.');
  };

  const handleSyncNow = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await retryNow();
    } finally {
      setIsSyncing(false);
    }
  };

  const renderPermissionRow = (kind, icon, iconColor, label, subLabel, status) => {
    const pill = STATUS_PILL[status];
    const tone = pill ? PILL[pill.tone] : null;
    return (
      <Pressable
        style={shared.rowItem}
        onPress={() => handlePermissionPress(kind, status)}
        disabled={!status || status === 'granted'}
        accessibilityRole="button"
      >
        <View style={shared.rowLeft}>
          <View style={[shared.rowIconWrap, { backgroundColor: iconColor + '1A' }]}>
            <Icon name={icon} size={18} color={iconColor} />
          </View>
          <View style={local.textWrap}>
            <Text style={shared.rowLabel}>{label}</Text>
            <Text style={shared.rowSubLabel}>{subLabel}</Text>
          </View>
        </View>
        {pill ? (
          <View style={[local.pill, { backgroundColor: tone.bg }]}>
            <Text style={[local.pillText, { color: tone.color }]} numberOfLines={1}>{pill.label}</Text>
          </View>
        ) : (
          <ActivityIndicator size="small" color={COLORS.textSecondary} />
        )}
      </Pressable>
    );
  };

  const failedCount = failed.length;
  const syncTone = failedCount > 0 ? PILL.off : pendingCount > 0 ? PILL.warn : PILL.ok;
  const syncLabel = failedCount > 0
    ? `${failedCount} couldn't be sent`
    : pendingCount > 0
      ? `${pendingCount} waiting to send`
      : 'All sent';
  const syncSub = failedCount > 0
    ? 'It was not accepted. Open the screen it came from (e.g. Submit Report) to retry or discard it.'
    : pendingCount > 0
      ? connection.online ? 'Sending automatically…' : 'Sends automatically once you are back online.'
      : 'Everything you did on this phone has been sent.';

  return (
    <View style={shared.groupCard}>
      {renderPermissionRow('location', 'location', '#F04D59', 'Location (GPS)', 'Recorded when stock is released, received or delivered.', locationStatus)}
      <View style={shared.rowDivider} />
      {renderPermissionRow('camera', 'camera', '#0E9AA7', 'Camera', 'For QR scanning and photo proof.', cameraStatus)}
      <View style={shared.rowDivider} />
      <View style={shared.rowItem}>
        <View style={shared.rowLeft}>
          <View style={[shared.rowIconWrap, { backgroundColor: '#2E9E5B1A' }]}>
            <Icon name="clock" size={18} color="#2E9E5B" />
          </View>
          <View style={local.textWrap}>
            <Text style={shared.rowLabel}>Saved Offline</Text>
            <Text style={shared.rowSubLabel}>{syncSub}</Text>
          </View>
        </View>
        {pendingCount > 0 && connection.online ? (
          <Pressable style={local.syncButton} onPress={handleSyncNow} disabled={isSyncing} accessibilityRole="button">
            {isSyncing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={local.syncButtonText}>Send now</Text>
            )}
          </Pressable>
        ) : (
          <View style={[local.pill, { backgroundColor: syncTone.bg }]}>
            <Text style={[local.pillText, { color: syncTone.color }]} numberOfLines={1}>{syncLabel}</Text>
          </View>
        )}
      </View>
      <View style={shared.rowDivider} />
      <View style={shared.rowItem}>
        <View style={shared.rowLeft}>
          <View style={[shared.rowIconWrap, { backgroundColor: '#0085F91A' }]}>
            <Icon name="info" size={18} color="#0085F9" />
          </View>
          <View style={local.textWrap}>
            <Text style={shared.rowLabel}>Tips</Text>
            <Text style={shared.rowSubLabel}>Short how-to notes shown on some screens.</Text>
          </View>
        </View>
        <Pressable style={local.tipsButton} onPress={handleShowTips} accessibilityRole="button">
          <Text style={local.tipsButtonText}>Show again</Text>
        </Pressable>
      </View>
    </View>
  );
}

SettingsDeviceSection.propTypes = {
  agentId: PropTypes.string,
  styles: PropTypes.object.isRequired,
};

const local = StyleSheet.create({
  textWrap: { flex: 1 },
  pill: {
    maxWidth: 140,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillText: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
  syncButton: {
    minWidth: 84,
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: SPACING.md,
    paddingVertical: 7,
    backgroundColor: COLORS.primary,
  },
  tipsButton: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 0, borderWidth: 1, borderColor: '#0085F9', backgroundColor: 'rgba(255, 255, 255, 0.7)' },
  tipsButtonText: { fontSize: 12, color: '#0085F9', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  syncButtonText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: '700',
  },
});
