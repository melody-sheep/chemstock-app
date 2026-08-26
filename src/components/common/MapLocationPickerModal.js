// src/components/common/MapLocationPickerModal.js
import React, { useRef, useState } from 'react';
import { View, Text, Modal, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import PropTypes from 'prop-types';
import Icon from './Icon';
import Button from './Button';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

// Cagayan de Oro city center — only used when neither an origin point nor a
// previously-picked point is available to center the map on.
const FALLBACK_CENTER = { latitude: 8.4542, longitude: 124.6319 };

// No react-native-maps here on purpose — it pulls in the Google Maps Android
// SDK, which needs a billed API key to avoid crashing once the app is built
// into an APK (that's exactly what broke before). A WebView rendering
// Leaflet + OpenStreetMap tiles needs no API key, no billing account, and is
// stable in production Android WebViews — the app already assumes an
// internet connection everywhere else (Supabase, the "Online" pill on every
// screen), so loading Leaflet/tiles from a CDN is consistent with that.
function buildMapHtml({ originCoords, initialCoords }) {
  const center = initialCoords || originCoords || FALLBACK_CENTER;
  const originJson = originCoords ? JSON.stringify(originCoords) : 'null';
  const initialJson = initialCoords ? JSON.stringify(initialCoords) : 'null';

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { position: absolute; top: 0; left: 0; right: 0; bottom: 0; margin: 0; padding: 0; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var origin = ${originJson};
    var initial = ${initialJson};
    var map = L.map('map', { zoomControl: true }).setView([${center.latitude}, ${center.longitude}], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    if (origin) {
      var originIcon = L.divIcon({
        className: '',
        html: '<div style="width:16px;height:16px;border-radius:8px;background:#0085F9;border:2px solid #FFFFFF;box-shadow:0 0 0 1px #0085F9;"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      L.marker([origin.latitude, origin.longitude], { icon: originIcon, interactive: false }).addTo(map);
    }

    var destinationIcon = L.divIcon({
      className: '',
      html: '<div style="width:20px;height:20px;border-radius:10px 10px 10px 0;background:#E63946;border:2px solid #FFFFFF;transform:rotate(-45deg);box-shadow:0 1px 3px rgba(0,0,0,0.4);"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 20],
    });

    var destinationMarker = null;

    function placeDestination(lat, lng) {
      if (destinationMarker) {
        destinationMarker.setLatLng([lat, lng]);
      } else {
        destinationMarker = L.marker([lat, lng], { icon: destinationIcon, draggable: true }).addTo(map);
        destinationMarker.on('dragend', function () {
          var pos = destinationMarker.getLatLng();
          window.ReactNativeWebView.postMessage(JSON.stringify({ lat: pos.lat, lng: pos.lng }));
        });
      }
      window.ReactNativeWebView.postMessage(JSON.stringify({ lat: lat, lng: lng }));
    }

    if (initial) {
      placeDestination(initial.latitude, initial.longitude);
    }

    map.on('click', function (e) {
      placeDestination(e.latlng.lat, e.latlng.lng);
    });
  </script>
</body>
</html>`;
}

/**
 * MapLocationPickerModal - full-screen tap-to-pin destination picker, backed
 * by Leaflet + OpenStreetMap inside a WebView (no Google Maps API key, no
 * billing account, doesn't crash a production APK build). Optionally renders
 * a fixed origin marker alongside the draggable destination one, so the
 * manager can see both points relative to each other while picking.
 */
export default function MapLocationPickerModal({ visible, onClose, onConfirm, originCoords, initialCoords }) {
  const [pickedCoords, setPickedCoords] = useState(initialCoords || null);
  const htmlRef = useRef(buildMapHtml({ originCoords, initialCoords }));

  const handleMessage = (event) => {
    try {
      const { lat, lng } = JSON.parse(event.nativeEvent.data);
      setPickedCoords({ latitude: lat, longitude: lng });
    } catch (error) {
      console.error('[ERROR] [MapLocationPickerModal] Failed to parse WebView message:', error);
    }
  };

  const handleShow = () => {
    htmlRef.current = buildMapHtml({ originCoords, initialCoords });
    setPickedCoords(initialCoords || null);
  };

  const handleConfirm = () => {
    if (!pickedCoords) return;
    onConfirm(pickedCoords);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      onShow={handleShow}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Text style={styles.title}>Pin Delivery Destination</Text>
          <Text style={styles.subtitle}>Tap anywhere on the map, or drag the pin to adjust</Text>
        </View>

        <WebView
          key={visible ? 'open' : 'closed'}
          source={{ html: htmlRef.current }}
          onMessage={handleMessage}
          style={styles.webview}
          originWhitelist={['*']}
        />

        <View style={styles.bottomBar}>
          {pickedCoords && (
            <View style={styles.coordsRow}>
              <Icon name="location" size={16} color={COLORS.error} />
              <Text style={styles.coordsText}>
                {pickedCoords.latitude.toFixed(5)}, {pickedCoords.longitude.toFixed(5)}
              </Text>
            </View>
          )}
          <View style={styles.buttonRow}>
            <Button title="Cancel" variant="outline" onPress={onClose} style={styles.actionButton} />
            <Button
              title="Confirm Location"
              variant="black"
              onPress={handleConfirm}
              disabled={!pickedCoords}
              style={styles.actionButton}
            />
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

MapLocationPickerModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  originCoords: PropTypes.shape({ latitude: PropTypes.number, longitude: PropTypes.number }),
  initialCoords: PropTypes.shape({ latitude: PropTypes.number, longitude: PropTypes.number }),
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topBar: {
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  subtitle: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  webview: { flex: 1 },
  bottomBar: {
    padding: SPACING.md,
    gap: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
  },
  coordsRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, justifyContent: 'center' },
  coordsText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: '#272632',
  },
  buttonRow: { flexDirection: 'row', gap: SPACING.sm },
  actionButton: { flex: 1 },
});
