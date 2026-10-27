// src/components/common/PermissionsCard.js
// What the app needs from the phone (Location, Camera) with its live state and an "Allow" button for
// anything missing. Used in the first-login overview of every role. Settings → Device & Sync keeps showing
// and fixing the same permissions later.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, AppState, Linking } from 'react-native';
import PropTypes from 'prop-types';
import * as Location from 'expo-location';
import { Camera } from 'expo-camera';
import Icon from './Icon';
import { TYPOGRAPHY } from '../../styles/typography';
import { SPACING } from '../../styles/spacing';

const ITEMS = [
  { key: 'location', icon: 'location', color: '#F04D59', title: 'Location', text: 'Records where stock is handled.' },
  { key: 'camera', icon: 'camera', color: '#0E9AA7', title: 'Camera', text: 'Scans QR codes and takes photos.' },
];

async function readAll() {
  const [location, camera] = await Promise.all([
    Location.getForegroundPermissionsAsync().catch(() => null),
    Camera.getCameraPermissionsAsync().catch(() => null),
  ]);
  const shape = (p) => ({ granted: p?.status === 'granted', canAsk: p?.canAskAgain ?? true });
  return { location: shape(location), camera: shape(camera) };
}

export default function PermissionsCard({ style }) {
  const [status, setStatus] = useState(null);

  const refresh = useCallback(() => {
    readAll().then(setStatus);
  }, []);

  // Re-read when the person comes back from the phone's settings.
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const handlePress = async (item) => {
    const current = status?.[item.key];
    if (!current || current.granted) return;
    if (!current.canAsk) {
      Linking.openSettings();
      return;
    }
    if (item.key === 'location') await Location.requestForegroundPermissionsAsync();
    else await Camera.requestCameraPermissionsAsync();
    refresh();
  };

  return (
    <View style={[styles.card, style]}>
      {ITEMS.map((item, index) => {
        const current = status?.[item.key];
        return (
          <View key={item.key} style={[styles.row, index > 0 && styles.rowDivider]}>
            <View style={[styles.iconWrap, { backgroundColor: item.color + '1A' }]}>
              <Icon name={item.icon} size={18} color={item.color} />
            </View>
            <View style={styles.textCol}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.text}>{item.text}</Text>
            </View>
            {current?.granted ? (
              <View style={styles.allowed}>
                <Icon name="checkCircle" size={14} color="#1E7A3A" weight="fill" />
                <Text style={styles.allowedText}>Allowed</Text>
              </View>
            ) : current ? (
              <Pressable style={styles.button} onPress={() => handlePress(item)} accessibilityRole="button" accessibilityLabel={`Allow ${item.title}`}>
                <Text style={styles.buttonText}>{current.canAsk ? 'Allow' : 'Open settings'}</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

PermissionsCard.propTypes = {
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
};

// Soft rounded corners and a translucent fill.
const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    backgroundColor: 'rgba(234, 244, 255, 0.78)',
    paddingHorizontal: SPACING.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 7 },
  rowDivider: { borderTopWidth: 1, borderTopColor: 'rgba(0, 133, 249, 0.12)' },
  iconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  textCol: { flex: 1 },
  title: { fontSize: TYPOGRAPHY.fontSize.sm, color: '#272632', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  text: { marginTop: 1, fontSize: 12, color: '#4B5563', fontFamily: TYPOGRAPHY.fontFamily.regular },
  allowed: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  allowedText: { fontSize: 12, color: '#1E7A3A', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  button: {
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#0085F9',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  buttonText: { fontSize: 12, color: '#0085F9', fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
});
