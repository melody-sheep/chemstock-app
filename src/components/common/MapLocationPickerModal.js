// src/components/common/MapLocationPickerModal.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import PropTypes from 'prop-types';
import Icon, { ICONS } from './Icon';
import Button from './Button';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { distanceInMeters, formatDistance } from '../../utils/distance';
import { formatPlace } from '../../utils/formatPlace';
import { formatCoordinates } from '../../utils/formatters';
import { debugLog } from '../../utils/logger';
import { SAVED_PLACES } from '../../constants/savedPlaces';

// Wait this long after the last drag/tap before looking up the address, so a
// drag doesn't trigger a lookup on every frame.
const ADDRESS_LOOKUP_DELAY_MS = 400;

// Pins farther than this from the manager's position ask for confirmation.
// GPS drift is usually well under this, so a larger pin is a deliberate choice.
const FAR_PIN_WARNING_METERS = 200;

// Search: wait for typing to pause, and show at most this many results.
const SEARCH_DEBOUNCE_MS = 400;
const SEARCH_MIN_LENGTH = 2;
const SEARCH_MIN_ONLINE_LENGTH = 3;
const MAX_SEARCH_RESULTS = 5;

// Floating panel heights and the zoom column's position below the search bar.
const SEARCH_BAR_HEIGHT = 48;
const CONTROLS_OFFSET = 160;

// Cagayan de Oro city center — only used when neither an origin point nor a
// previously-picked point is available to center the map on.
const FALLBACK_CENTER = { latitude: 8.4542, longitude: 124.6319 };

// Space the floating header takes at the top, so the zoom column sits below it.
const HEADER_OFFSET = 96;
// Space the glass footer takes at the bottom. Leaves the OpenStreetMap
// attribution (required by its licence) visible under the footer.
const FOOTER_OFFSET = 28;

// No react-native-maps here on purpose — it pulls in the Google Maps Android
// SDK, which needs a billed API key to avoid crashing once the app is built
// into an APK (that's exactly what broke before). A WebView rendering
// Leaflet + OpenStreetMap tiles needs no API key, no billing account, and is
// stable in production Android WebViews — the app already assumes an
// internet connection everywhere else (Supabase, the "Online" pill on every
// screen), so loading Leaflet/tiles from a CDN is consistent with that.
//
// The origin marker is NOT baked into the page: it is pushed in later with
// window.setOrigin(), so a GPS fix that arrives after the map has loaded shows
// up without reloading the page (which would drop a pin the manager placed).
function buildMapHtml({ initialCoords }) {
  const center = initialCoords || FALLBACK_CENTER;
  const initialJson = initialCoords ? JSON.stringify(initialCoords) : 'null';

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { position: absolute; top: 0; left: 0; right: 0; bottom: 0; margin: 0; padding: 0; }
    .me-marker { position: relative; width: 56px; height: 56px; }
    .me-pulse {
      position: absolute; inset: 0; border-radius: 28px;
      background: rgba(0, 133, 249, 0.28);
      animation: me-pulse 2s ease-out infinite;
    }
    .me-avatar {
      position: absolute; left: 8px; top: 8px; width: 40px; height: 40px;
      border-radius: 20px; border: 3px solid #FFFFFF;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      overflow: hidden; background: #E0E7FF; color: #03045E;
      display: flex; align-items: center; justify-content: center;
      font: 600 14px -apple-system, Roboto, sans-serif;
    }
    .me-avatar img { width: 100%; height: 100%; object-fit: cover; }
    @keyframes me-pulse {
      0% { transform: scale(0.6); opacity: 1; }
      100% { transform: scale(1.5); opacity: 0; }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var initial = ${initialJson};
    var PIN_PATH = ${JSON.stringify(ICONS.mapPinFill.svg)};
    var map = L.map('map', { zoomControl: false }).setView([${center.latitude}, ${center.longitude}], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    function escapeHtml(text) {
      return String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    }

    // The manager's own position: their profile photo in a pulsing ring, or
    // their initials when there is no photo.
    function originIcon(photoUrl, initials) {
      var avatar = photoUrl
        ? '<img src="' + escapeHtml(photoUrl) + '" alt="" />'
        : escapeHtml(initials || '');
      return L.divIcon({
        className: '',
        html: '<div class="me-marker"><div class="me-pulse"></div><div class="me-avatar">' + avatar + '</div></div>',
        iconSize: [56, 56],
        iconAnchor: [28, 28],
      });
    }

    var originMarker = null;
    var originLatLng = null;
    // Center on the manager's position once, the first time a fix arrives —
    // but only when no destination is already pinned (that one keeps the view).
    var hasCentered = !!initial;

    // Called from React Native (injectJavaScript) whenever the GPS fix or the
    // profile photo changes.
    window.setOrigin = function (data) {
      originLatLng = [data.lat, data.lng];
      var icon = originIcon(data.photoUrl, data.initials);
      if (originMarker) {
        originMarker.setLatLng(originLatLng).setIcon(icon);
      } else {
        originMarker = L.marker(originLatLng, { icon: icon, interactive: false, zIndexOffset: 1000 }).addTo(map);
      }
      if (!hasCentered) {
        map.setView(originLatLng, 16);
        hasCentered = true;
      }
    };

    // Zoom and recenter buttons are drawn in React Native, so they call in here.
    window.mapCommand = function (command, lat, lng) {
      if (command === 'zoomIn') {
        map.zoomIn();
      } else if (command === 'zoomOut') {
        map.zoomOut();
      } else if (command === 'recenter' && originLatLng) {
        map.setView(originLatLng, Math.max(map.getZoom(), 16));
      } else if (command === 'flyTo') {
        map.setView([lat, lng], 16);
      }
    };

    // Same map-pin glyph as the app's "location" icon, in the app's error colour.
    var destinationIcon = L.divIcon({
      className: '',
      html: '<svg width="44" height="44" viewBox="0 0 256 256" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.35));">'
        + '<path fill="${COLORS.error}" stroke="#FFFFFF" stroke-width="14" stroke-linejoin="round" paint-order="stroke" d="' + PIN_PATH + '"/></svg>',
      iconSize: [44, 44],
      iconAnchor: [22, 40],
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
 * billing account, doesn't crash a production APK build). The manager's own
 * position shows as their profile photo, and the header, zoom/recenter column,
 * and footer float over the map as glass panels.
 */
export default function MapLocationPickerModal({
  visible,
  onClose,
  onConfirm,
  originCoords,
  originAvatarUrl,
  originInitials,
  initialCoords,
}) {
  const insets = useSafeAreaInsets();
  const [pickedCoords, setPickedCoords] = useState(initialCoords || null);
  const [pickedAddress, setPickedAddress] = useState(null);
  const webViewRef = useRef(null);

  const pickedLat = pickedCoords?.latitude ?? null;
  const pickedLng = pickedCoords?.longitude ?? null;

  // Address of the pinned point, looked up after the pin settles.
  useEffect(() => {
    if (pickedLat === null) return undefined;
    setPickedAddress(null);
    const timer = setTimeout(async () => {
      try {
        const results = await Location.reverseGeocodeAsync({ latitude: pickedLat, longitude: pickedLng });
        setPickedAddress(formatPlace(results?.[0]));
      } catch (error) {
        console.error('[ERROR] [MapLocationPickerModal] Reverse geocode failed:', error);
      }
    }, ADDRESS_LOOKUP_DELAY_MS);
    return () => clearTimeout(timer);
  }, [pickedLat, pickedLng]);

  // Straight-line distance from the manager's position (advisory, not a route).
  const distanceMeters = distanceInMeters(originCoords, pickedCoords);
  const distanceLabel =
    distanceMeters === null ? (originCoords ? null : 'Locating you…') : `${formatDistance(distanceMeters)} away`;

  // The page only depends on the destination; the origin is pushed in below.
  // Primitives in the deps avoid rebuilding when the parent passes a new object
  // with the same values.
  const originLat = originCoords?.latitude ?? null;
  const originLng = originCoords?.longitude ?? null;
  const initialLat = initialCoords?.latitude ?? null;
  const initialLng = initialCoords?.longitude ?? null;
  const mapHtml = useMemo(
    () =>
      buildMapHtml({
        initialCoords: initialLat === null ? null : { latitude: initialLat, longitude: initialLng },
      }),
    [initialLat, initialLng]
  );

  // Show the current-location marker whenever a fix exists, including fixes
  // that arrive after the map has loaded (the first open is often still locating).
  const pushOrigin = () => {
    if (originLat === null || !webViewRef.current) return;
    const payload = JSON.stringify({
      lat: originLat,
      lng: originLng,
      photoUrl: originAvatarUrl || null,
      initials: originInitials || '',
    });
    webViewRef.current.injectJavaScript(`window.setOrigin && window.setOrigin(${payload}); true;`);
  };

  useEffect(() => {
    pushOrigin();
  }, [originLat, originLng, originAvatarUrl, originInitials]);

  // Sends a command to the map page, e.g. sendMapCommand('flyTo', lat, lng).
  const sendMapCommand = (command, ...args) => {
    const argsJson = args.map((arg) => JSON.stringify(arg)).join(', ');
    webViewRef.current?.injectJavaScript(
      `window.mapCommand && window.mapCommand('${command}'${argsJson ? `, ${argsJson}` : ''}); true;`
    );
  };

  // Search: the offline list first, then the device geocoder when online.
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState(null);
  const trimmedQuery = searchQuery.trim();

  useEffect(() => {
    if (trimmedQuery.length < SEARCH_MIN_LENGTH) {
      setSearchResults([]);
      setSearchMessage(null);
      setIsSearching(false);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      const needle = trimmedQuery.toLowerCase();
      const local = SAVED_PLACES.filter((place) => place.name.toLowerCase().includes(needle));

      let online = [];
      let onlineFailed = false;
      if (local.length < MAX_SEARCH_RESULTS && trimmedQuery.length >= SEARCH_MIN_ONLINE_LENGTH) {
        try {
          const found = await Location.geocodeAsync(trimmedQuery);
          online = found.slice(0, MAX_SEARCH_RESULTS).map((point, index) => ({
            id: `online-${index}`,
            name: trimmedQuery,
            latitude: point.latitude,
            longitude: point.longitude,
          }));
        } catch (error) {
          onlineFailed = true;
          console.error('[ERROR] [MapLocationPickerModal] Geocode failed:', error);
        }
      }

      if (cancelled) return;
      const merged = [...local, ...online].slice(0, MAX_SEARCH_RESULTS);
      debugLog('info', 'MapPicker', 'Search', {
        query: trimmedQuery,
        offline: local.length,
        online: online.length,
        onlineFailed,
      });
      setSearchResults(merged);
      if (merged.length > 0) {
        setSearchMessage(null);
      } else {
        setSearchMessage(onlineFailed ? 'Search needs a connection' : 'No matching place');
      }
      setIsSearching(false);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmedQuery]);

  const handleSelectPlace = (place) => {
    setSearchQuery('');
    setSearchResults([]);
    sendMapCommand('flyTo', place.latitude, place.longitude);
  };

  const handleMessage = (event) => {
    try {
      const { lat, lng } = JSON.parse(event.nativeEvent.data);
      debugLog('info', 'MapPicker', 'Pin set', { lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)) });
      setPickedCoords({ latitude: lat, longitude: lng });
    } catch (error) {
      console.error('[ERROR] [MapLocationPickerModal] Failed to parse WebView message:', error);
    }
  };

  const handleShow = () => {
    setPickedCoords(initialCoords || null);
  };

  const handleConfirm = () => {
    if (!pickedCoords) return;
    debugLog('info', 'MapPicker', 'Confirm pressed', {
      distanceM: distanceMeters === null ? null : Math.round(distanceMeters),
      farWarning: distanceMeters !== null && distanceMeters > FAR_PIN_WARNING_METERS,
    });
    if (distanceMeters !== null && distanceMeters > FAR_PIN_WARNING_METERS) {
      Alert.alert(
        'Pin is far from you',
        `This pin is ${formatDistance(distanceMeters)} from your current position. Confirm this location?`,
        [
          { text: 'Go back', style: 'cancel' },
          { text: 'Confirm anyway', onPress: () => onConfirm(pickedCoords) },
        ]
      );
      return;
    }
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
      <View style={styles.container}>
        <WebView
          ref={webViewRef}
          key={visible ? 'open' : 'closed'}
          source={{ html: mapHtml }}
          onLoadEnd={pushOrigin}
          onMessage={handleMessage}
          style={StyleSheet.absoluteFill}
          originWhitelist={['*']}
        />

        <View style={[styles.glass, styles.header, { top: insets.top + SPACING.sm }]}>
          <Text style={styles.title}>Pin Delivery Destination</Text>
          <Text style={styles.subtitle}>Tap the map, or drag the pin to adjust</Text>
        </View>

        <View style={[styles.glass, styles.searchBar, { top: insets.top + HEADER_OFFSET }]}>
          <Icon name="search" size={18} color={COLORS.textSecondary} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search a place"
            placeholderTextColor={COLORS.textTertiary}
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Search for a place"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="xCircle" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {trimmedQuery.length >= SEARCH_MIN_LENGTH && (
          <View style={[styles.glass, styles.searchResults, { top: insets.top + HEADER_OFFSET + SEARCH_BAR_HEIGHT + SPACING.xs }]}>
            {searchResults.map((place) => (
              <TouchableOpacity
                key={place.id || `${place.latitude}-${place.longitude}`}
                style={styles.resultRow}
                onPress={() => handleSelectPlace(place)}
                accessibilityRole="button"
                accessibilityLabel={`Go to ${place.name}`}
              >
                <Icon name="location" size={16} color={COLORS.primary} />
                <View style={styles.resultTextWrap}>
                  <Text style={styles.resultName} numberOfLines={1}>{place.name}</Text>
                  <Text style={styles.resultMeta} numberOfLines={1}>
                    {formatCoordinates(place.latitude, place.longitude)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
            {(isSearching || searchMessage) && (
              <Text style={styles.searchMessage}>{isSearching ? 'Searching…' : searchMessage}</Text>
            )}
          </View>
        )}

        <View style={[styles.glass, styles.controls, { top: insets.top + CONTROLS_OFFSET }]}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => sendMapCommand('zoomIn')}
            accessibilityRole="button"
            accessibilityLabel="Zoom in"
          >
            <Icon name="plus" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <View style={styles.controlDivider} />
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => sendMapCommand('zoomOut')}
            accessibilityRole="button"
            accessibilityLabel="Zoom out"
          >
            <Icon name="minus" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <View style={styles.controlDivider} />
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => sendMapCommand('recenter')}
            disabled={originLat === null}
            accessibilityRole="button"
            accessibilityLabel="Center on my location"
          >
            <Icon name="navigation" size={20} color={originLat === null ? COLORS.textTertiary : COLORS.primary} />
          </TouchableOpacity>
        </View>

        <View style={[styles.glass, styles.footer, { bottom: insets.bottom + FOOTER_OFFSET }]}>
          {pickedCoords && (
            <View style={styles.insightCard}>
              <View style={styles.insightRow}>
                {distanceLabel && (
                  <View style={styles.distanceChip}>
                    <Icon name="navigation" size={14} color={COLORS.primary} />
                    <Text style={styles.distanceText}>{distanceLabel}</Text>
                  </View>
                )}
                <View style={styles.coordsRow}>
                  <Icon name="location" size={14} color={COLORS.error} />
                  <Text style={styles.coordsText}>
                    {pickedCoords.latitude.toFixed(5)}, {pickedCoords.longitude.toFixed(5)}
                  </Text>
                </View>
              </View>
              <Text style={styles.addressText} numberOfLines={2}>
                {pickedAddress || 'Finding address…'}
              </Text>
            </View>
          )}
          <Button
            title="Confirm Location"
            variant="black"
            onPress={handleConfirm}
            disabled={!pickedCoords}
            height={44}
            fontSize={15}
            style={styles.actionButton}
          />
          <Button
            title="Cancel"
            variant="outline"
            onPress={onClose}
            height={44}
            fontSize={15}
            style={styles.actionButton}
          />
        </View>
      </View>
    </Modal>
  );
}

MapLocationPickerModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  originCoords: PropTypes.shape({ latitude: PropTypes.number, longitude: PropTypes.number }),
  originAvatarUrl: PropTypes.string,
  originInitials: PropTypes.string,
  initialCoords: PropTypes.shape({ latitude: PropTypes.number, longitude: PropTypes.number }),
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // Shared glass look for every floating panel.
  glass: {
    position: 'absolute',
    backgroundColor: COLORS.glassSurface,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },

  header: {
    left: SPACING.md,
    right: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textPrimary,
  },
  subtitle: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },

  searchBar: {
    left: SPACING.md,
    right: SPACING.md,
    height: SEARCH_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  searchInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textPrimary,
    paddingVertical: 0,
  },
  // Results sit beside the zoom column, not over it.
  searchResults: {
    left: SPACING.md,
    right: SPACING.md + 56,
    padding: SPACING.xs,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  resultTextWrap: { flex: 1 },
  resultName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textPrimary,
  },
  resultMeta: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
  searchMessage: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },

  controls: {
    right: SPACING.md,
    width: 48,
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  controlButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlDivider: {
    width: 28,
    height: 1,
    backgroundColor: COLORS.glassBorder,
  },

  footer: {
    left: SPACING.md,
    right: SPACING.md,
    padding: SPACING.sm,
    gap: SPACING.sm,
  },
  insightCard: { gap: SPACING.xs },
  insightRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  distanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: COLORS.primaryLight,
  },
  distanceText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.primary,
  },
  coordsRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  coordsText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textSecondary,
  },
  addressText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textPrimary,
  },
  // Confirm and Cancel stack as full-width rows inside the footer.
  actionButton: { width: '100%' },
});
