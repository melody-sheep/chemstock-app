// src/components/common/MapLocationPickerModal.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, TextInput, ScrollView, Keyboard } from 'react-native';
import Alert from '../../utils/appAlert';
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
import { formatCoordinates, formatCheckpointTime } from '../../utils/formatters';
import { getInitials } from '../../utils/initials';
import { debugLog } from '../../utils/logger';
import { SAVED_PLACES } from '../../constants/savedPlaces';
import { getRecentPlaces, rememberPlace, searchPlacesOnline } from '../../utils/placeSearch';

// Wait this long after the last drag/tap before looking up the address, so a
// drag doesn't trigger a lookup on every frame.
const ADDRESS_LOOKUP_DELAY_MS = 400;

// Pins farther than this from the manager's position ask for confirmation.
// GPS drift is usually well under this, so a larger pin is a deliberate choice.
const FAR_PIN_WARNING_METERS = 200;
// Distance tiers for the trail of arrowheads and the distance chip: green under
// 500 m, orange up to 5 km, red beyond that.
// A pin this close to the recipient's last recorded spot counts as "at" it.
const AT_RECIPIENT_METERS = 50;
const NEAR_PIN_METERS = 500;
const MID_PIN_METERS = 5000;
const TIER_GREEN = '#2E9E5B';
const TIER_ORANGE = '#F59E0B';
const TIER_RED = '#E63946';

// Search: wait for typing to pause, and show at most this many results.
const SEARCH_DEBOUNCE_MS = 400;
const SEARCH_MIN_LENGTH = 2;
const SEARCH_MIN_ONLINE_LENGTH = 3;
const MAX_SEARCH_RESULTS = 8;

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
function buildMapHtml({ initialCoords, initialLockedTo = null }) {
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
    /* Destination pin: a soft red glow that pulses, lifts and grows while dragged. */
    .dest-wrap { position: relative; width: 44px; height: 44px; }
    .dest-glow {
      position: absolute; left: 50%; top: 34px; width: 30px; height: 12px; margin-left: -15px;
      border-radius: 50%; background: rgba(230, 57, 70, 0.45);
      animation: dest-glow 1.8s ease-out infinite;
    }
    .dest-pin {
      display: block; transform-origin: 50% 90%;
      transition: transform 0.15s ease, filter 0.15s ease;
      filter: drop-shadow(0 0 6px rgba(230, 57, 70, 0.75)) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.35));
    }
    .leaflet-marker-dragging .dest-pin {
      transform: translateY(-12px) scale(1.18);
      filter: drop-shadow(0 0 12px rgba(230, 57, 70, 0.95)) drop-shadow(0 8px 6px rgba(0, 0, 0, 0.3));
    }
    .leaflet-marker-dragging .dest-glow { animation: none; transform: scale(1.5); opacity: 0.6; }
    @keyframes dest-glow {
      0% { transform: scale(0.5); opacity: 0.9; }
      100% { transform: scale(1.8); opacity: 0; }
    }
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
      drawTrail();
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
      } else if (command === 'unlock') {
        window.unlockPin();
      }
    };

    // Same map-pin glyph as the app's "location" icon, in the app's error colour.
    var destinationIcon = L.divIcon({
      className: '',
      html: '<div class="dest-wrap"><div class="dest-glow"></div>'
        + '<svg class="dest-pin" width="44" height="44" viewBox="0 0 256 256">'
        + '<path fill="${COLORS.error}" stroke="#FFFFFF" stroke-width="14" stroke-linejoin="round" paint-order="stroke" d="' + PIN_PATH + '"/></svg></div>',
      iconSize: [44, 44],
      iconAnchor: [22, 40],
    });

    var destinationMarker = null;
    // While the pin is locked on a Sales Rep it cannot be dragged and map taps
    // are ignored; the Unlock button (React Native) is the only way out.
    var pinLocked = false;
    // Trail of small arrowheads (the tip of the navigation arrow) from where you are to
    // the pin, always visible. Its colour shows how far the pin is; while the pin is being
    // dragged the arrowheads get bigger and glow.
    var trailLayer = L.layerGroup().addTo(map);
    var trailDragging = false;
    var trailQueued = false;
    function trailColor(meters) {
      if (meters <= ${NEAR_PIN_METERS}) return '${TIER_GREEN}';
      if (meters <= ${MID_PIN_METERS}) return '${TIER_ORANGE}';
      return '${TIER_RED}';
    }
    function trailIcon(color, deg, dragging) {
      var size = dragging ? 18 : 14;
      var glow = dragging ? 'filter:drop-shadow(0 0 4px ' + color + ') drop-shadow(0 0 9px ' + color + ');' : '';
      return L.divIcon({
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        html: '<svg width="' + size + '" height="' + size + '" viewBox="0 0 14 14" style="display:block;transform:rotate(' + deg + 'deg);'
          + 'opacity:' + (dragging ? 1 : 0.85) + ';' + glow + '">'
          + '<path d="M1 1 L13 7 L1 13 L4.5 7 Z" fill="' + color + '" stroke="#FFFFFF" stroke-width="1.2" stroke-linejoin="round" paint-order="stroke"/></svg>',
      });
    }
    function drawTrail() {
      trailLayer.clearLayers();
      if (!originLatLng || !destinationMarker) return;
      var to = destinationMarker.getLatLng();
      var a = map.latLngToContainerPoint(originLatLng);
      var b = map.latLngToContainerPoint(to);
      var dx = b.x - a.x, dy = b.y - a.y;
      var len = Math.sqrt(dx * dx + dy * dy);
      var startGap = 36, endGap = 16, step = trailDragging ? 30 : 26;
      if (len < startGap + endGap + step * 0.5) return;
      var deg = Math.atan2(dy, dx) * 180 / Math.PI;
      var color = trailColor(map.distance(originLatLng, to));
      var count = Math.min(80, Math.floor((len - startGap - endGap) / step) + 1);
      for (var i = 0; i < count; i++) {
        var t = startGap + i * step;
        var p = L.point(a.x + dx / len * t, a.y + dy / len * t);
        L.marker(map.containerPointToLatLng(p), {
          icon: trailIcon(color, deg, trailDragging), interactive: false, keyboard: false, zIndexOffset: -100,
        }).addTo(trailLayer);
      }
    }
    // While dragging this runs on every move, so draw at most once per frame.
    function queueTrail() {
      if (trailQueued) return;
      trailQueued = true;
      requestAnimationFrame(function () {
        trailQueued = false;
        drawTrail();
      });
    }
    map.on('zoomend', drawTrail);

    function applyPinLock() {
      if (!destinationMarker) return;
      if (pinLocked) {
        destinationMarker.dragging.disable();
      } else {
        destinationMarker.dragging.enable();
      }
    }

    function placeDestination(lat, lng, lockedTo) {
      pinLocked = !!lockedTo;
      if (destinationMarker) {
        destinationMarker.setLatLng([lat, lng]);
      } else {
        destinationMarker = L.marker([lat, lng], { icon: destinationIcon, draggable: true, zIndexOffset: 900 }).addTo(map);
        destinationMarker.on('dragstart', function () {
          trailDragging = true;
          drawTrail();
        });
        destinationMarker.on('drag', queueTrail);
        destinationMarker.on('dragend', function () {
          trailDragging = false;
          drawTrail();
          var pos = destinationMarker.getLatLng();
          window.ReactNativeWebView.postMessage(JSON.stringify({ lat: pos.lat, lng: pos.lng, lockedTo: null }));
        });
      }
      applyPinLock();
      drawTrail();
      window.ReactNativeWebView.postMessage(JSON.stringify({ lat: lat, lng: lng, lockedTo: lockedTo || null }));
    }

    // Called from React Native (Unlock button): the pin stays where it is but is free again.
    window.unlockPin = function () {
      if (!destinationMarker) return;
      pinLocked = false;
      applyPinLock();
      var pos = destinationMarker.getLatLng();
      window.ReactNativeWebView.postMessage(JSON.stringify({ lat: pos.lat, lng: pos.lng, lockedTo: null }));
    };

    if (initial) {
      placeDestination(initial.latitude, initial.longitude, ${initialLockedTo ? JSON.stringify(initialLockedTo) : 'null'});
    }

    map.on('click', function (e) {
      if (pinLocked) return;
      placeDestination(e.latlng.lat, e.latlng.lng);
    });

    // The team (Manager only): each Sales Rep / Collector at their last
    // recorded location. Tapping one pins the destination there.
    window.lockOn = function (p) {
      placeDestination(p.lat, p.lng, p.id);
      map.setView([p.lat, p.lng], Math.max(map.getZoom(), 17));
    };

    var teamLayer = L.layerGroup().addTo(map);
    window.setTeam = function (members) {
      teamLayer.clearLayers();
      var seen = {};
      (members || []).forEach(function (m) {
        var key = m.lat.toFixed(4) + ',' + m.lng.toFixed(4);
        var n = seen[key] = (seen[key] || 0) + 1;
        // Same spot as someone already drawn: offset in a small circle.
        var angle = n * 1.2, step = n > 1 ? 0.00012 : 0;
        m = Object.assign({}, m, { lat: m.lat + Math.sin(angle) * step, lng: m.lng + Math.cos(angle) * step, pinLat: m.lat, pinLng: m.lng });
        var face = m.photoUrl
          ? '<img src="' + escapeHtml(m.photoUrl) + '" alt="" style="width:100%;height:100%;object-fit:cover;" />'
          : escapeHtml(m.initials || '');
        var tag = !m.isTarget ? '' : '<div style="position:absolute;bottom:100%;left:50%;transform:translateX(-50%);margin-bottom:6px;'
          + 'width:max-content;max-width:180px;background:#272632;color:#fff;padding:4px 8px;border-radius:8px;text-align:center;">'
          + '<div style="font-size:11px;font-weight:700;">' + escapeHtml(m.name) + '</div>'
          + '<div style="font-size:10px;opacity:.8;">' + escapeHtml(m.subtitle) + '</div></div>';
        var icon = L.divIcon({
          className: '',
          html: '<div style="position:relative;width:40px;height:40px;">' + tag
            + '<div style="width:40px;height:40px;border-radius:20px;border:3px solid ' + m.color + ';background:#EEF2FF;'
            + 'overflow:hidden;display:flex;align-items:center;justify-content:center;font:700 12px sans-serif;color:#03045E;'
            + 'box-shadow:0 2px 4px rgba(0,0,0,.35);">' + face + '</div></div>',
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });
        L.marker([m.lat, m.lng], { icon: icon, zIndexOffset: m.isTarget ? 500 : 0 }).on('click', function () {
          placeDestination(m.pinLat, m.pinLng, m.agentId);
        }).addTo(teamLayer);
      });
    };

    // Everything above is defined: tell React Native it can send the manager's position and
    // the team now. (Pushing on the WebView's own "load ended" can arrive before this page's
    // scripts have run, in which case the position is silently dropped and the map opens blank.)
    window.ReactNativeWebView.postMessage(JSON.stringify({ ready: true }));
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
  teamMembers = [],
  targetRecipientId = null,
  // Opens with the pin already locked on this Sales Rep (e.g. from the
  // "Go to <SR>'s last recorded location" card on the release screen).
  initialLockedAgentId = null,
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
  // Same green / orange / red tiers as the arrowhead trail on the map.
  let distanceTier = { color: COLORS.primary, background: COLORS.primaryLight };
  if (distanceMeters !== null) {
    if (distanceMeters <= NEAR_PIN_METERS) distanceTier = { color: TIER_GREEN, background: '#E8F5E9' };
    else if (distanceMeters <= MID_PIN_METERS) distanceTier = { color: '#D98200', background: '#FFF3E0' };
    else distanceTier = { color: TIER_RED, background: '#FDECEA' };
  }

  // The page only depends on the destination; the origin is pushed in below.
  // Primitives in the deps avoid rebuilding when the parent passes a new object
  // with the same values.
  // Sales Reps on the map (they are who stock is delivered to). Tapping one
  // locks the pin on their last recorded spot; tapping the map or dragging
  // the pin unlocks it. The release's own recipient is listed first.
  const salesReps = (teamMembers || [])
    .filter((m) => m.role === 'sales_rep')
    .sort((a, b) => (b.agentId === targetRecipientId) - (a.agentId === targetRecipientId));
  const targetMember = salesReps.find((m) => m.agentId === targetRecipientId) || null;
  const [lockedAgentId, setLockedAgentId] = useState(null);
  const lockedMember = salesReps.find((m) => m.agentId === lockedAgentId) || null;
  const lockOnTarget = () => {
    if (!targetMember) return;
    webViewRef.current?.injectJavaScript(
      `window.lockOn && window.lockOn(${JSON.stringify({ lat: targetMember.latitude, lng: targetMember.longitude, id: targetMember.agentId })}); true;`
    );
  };

  const originLat = originCoords?.latitude ?? null;
  const originLng = originCoords?.longitude ?? null;
  const initialLat = initialCoords?.latitude ?? null;
  const initialLng = initialCoords?.longitude ?? null;
  const mapHtml = useMemo(
    () =>
      buildMapHtml({
        initialCoords: initialLat === null ? null : { latitude: initialLat, longitude: initialLng },
        initialLockedTo: initialLockedAgentId,
      }),
    [initialLat, initialLng, initialLockedAgentId]
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

  const pushTeam = () => {
    if (!webViewRef.current) return;
    const payload = JSON.stringify(
      salesReps.map((m) => ({
        agentId: m.agentId,
        isTarget: m.agentId === targetRecipientId,
        lat: m.latitude,
        lng: m.longitude,
        name: m.fullName,
        subtitle: `${m.role === 'collector' ? 'Collector' : 'Sales Rep'} · ${formatCheckpointTime(m.capturedAt)}`,
        color: m.role === 'collector' ? '#F4A825' : '#E63946',
        photoUrl: m.photoUrl || null,
        initials: getInitials(m.fullName),
      }))
    );
    webViewRef.current.injectJavaScript(`window.setTeam && window.setTeam(${payload}); true;`);
  };

  useEffect(() => {
    pushTeam();
  }, [teamMembers, targetRecipientId]);

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
  // While the search box is in use the sheet and zoom buttons step aside, so the results have the room.
  const [isSearchFocused, setIsSearchFocused] = useState(false);
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
      // Offline first: the curated list, then places picked before on this phone.
      const recent = await getRecentPlaces();
      const local = [...SAVED_PLACES, ...recent]
        .filter((place) => place.name.toLowerCase().includes(needle))
        .slice(0, MAX_SEARCH_RESULTS);

      // Then online: OpenStreetMap search, and the phone's own geocoder if that finds
      // nothing or fails. With no connection both fail quietly and the offline results stay.
      let online = [];
      let onlineFailed = false;
      if (local.length < MAX_SEARCH_RESULTS && trimmedQuery.length >= SEARCH_MIN_ONLINE_LENGTH) {
        let osmFailed = false;
        try {
          online = await searchPlacesOnline(trimmedQuery, MAX_SEARCH_RESULTS);
        } catch (error) {
          osmFailed = true;
          console.error('[ERROR] [MapLocationPickerModal] Place search failed:', error);
        }
        if (online.length === 0) {
          let geocoderFailed = false;
          try {
            const found = await Location.geocodeAsync(trimmedQuery);
            online = found.slice(0, MAX_SEARCH_RESULTS).map((point, index) => ({
              id: `online-${index}`,
              name: trimmedQuery,
              latitude: point.latitude,
              longitude: point.longitude,
            }));
          } catch (error) {
            geocoderFailed = true;
            console.error('[ERROR] [MapLocationPickerModal] Geocode failed:', error);
          }
          onlineFailed = osmFailed && geocoderFailed;
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
    rememberPlace(place);
    Keyboard.dismiss();
    setIsSearchFocused(false);
    setSearchQuery('');
    setSearchResults([]);
    sendMapCommand('flyTo', place.latitude, place.longitude);
  };

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.ready) {
        pushOrigin();
        pushTeam();
        return;
      }
      const { lat, lng, lockedTo } = data;
      setLockedAgentId(lockedTo || null);
      debugLog('info', 'MapPicker', 'Pin set', { lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)) });
      setPickedCoords({ latitude: lat, longitude: lng });
    } catch (error) {
      console.error('[ERROR] [MapLocationPickerModal] Failed to parse WebView message:', error);
    }
  };

  const handleShow = () => {
    setPickedCoords(initialCoords || null);
    setLockedAgentId(initialLockedAgentId || null);
  };

  const handleConfirm = () => {
    if (!pickedCoords) return;
    // The pin is not where this release's recipient was last seen (and not locked on
    // them): make the Manager acknowledge it before it is used.
    const awayFromRecipient = targetMember
      ? distanceInMeters(pickedCoords, { latitude: targetMember.latitude, longitude: targetMember.longitude })
      : null;
    if (
      targetMember &&
      lockedAgentId !== targetMember.agentId &&
      awayFromRecipient !== null &&
      awayFromRecipient > AT_RECIPIENT_METERS
    ) {
      debugLog('info', 'MapPicker', 'Off-recipient confirm', { awayM: Math.round(awayFromRecipient) });
      Alert.alert(
        'Different location',
        `This pin is ${formatDistance(awayFromRecipient)} from where ${targetMember.fullName} was last seen (${formatCheckpointTime(targetMember.capturedAt)}). The delivery will go to this spot, not to ${targetMember.fullName}'s last recorded location.`,
        [
          { text: 'Go back', style: 'cancel' },
          { text: 'Use this location', onPress: () => onConfirm(pickedCoords) },
        ]
      );
      return;
    }
    // Locked on a Sales Rep: no "far from you" warning — the point is
    // where they are, not where the Manager is.
    if (lockedMember) {
      onConfirm(pickedCoords);
      return;
    }
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
          onLoadEnd={() => {
            pushOrigin();
            pushTeam();
          }}
          onMessage={handleMessage}
          style={StyleSheet.absoluteFill}
          originWhitelist={['*']}
        />

        <View style={[styles.glass, styles.header, { top: insets.top + SPACING.sm }]}>
          <Text style={styles.title}>Pin Delivery Destination</Text>
          <Text style={styles.subtitle}>
            {lockedMember
              ? `Pinned on ${lockedMember.fullName}'s last location`
              : 'Tap the map, or drag the pin to adjust'}
          </Text>
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
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
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

        {isSearchFocused && trimmedQuery.length >= SEARCH_MIN_LENGTH && (
          <View style={[styles.glass, styles.searchResults, { top: insets.top + HEADER_OFFSET + SEARCH_BAR_HEIGHT + SPACING.xs }]}>
            <ScrollView style={styles.resultsScroll} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
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
                    {place.detail || formatCoordinates(place.latitude, place.longitude)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
            {(isSearching || searchMessage) && (
              <Text style={styles.searchMessage}>{isSearching ? 'Searching…' : searchMessage}</Text>
            )}
            </ScrollView>
          </View>
        )}

        {!isSearchFocused && (
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
        )}

        {!isSearchFocused && (
        <View style={[styles.glass, styles.footer, { bottom: insets.bottom + FOOTER_OFFSET }]}>
          {targetMember && lockedAgentId !== targetMember.agentId && (
            <TouchableOpacity style={styles.lockButton} onPress={lockOnTarget} activeOpacity={0.8}>
              <Icon name="location" size={16} color={COLORS.primary} />
              <Text style={styles.lockButtonText} numberOfLines={1}>
                Deliver to {targetMember.fullName}'s location
              </Text>
            </TouchableOpacity>
          )}
          {pickedCoords && (
            <View style={styles.insightCard}>
              <Text style={styles.addressText} numberOfLines={2}>
                {pickedAddress || 'Finding address…'}
              </Text>
              <View style={styles.insightRow}>
                {distanceLabel && (
                  <View style={[styles.distanceChip, { backgroundColor: distanceTier.background }]}>
                    <Icon name="navigation" size={14} color={distanceTier.color} />
                    <Text style={[styles.distanceText, { color: distanceTier.color }]}>{distanceLabel}</Text>
                  </View>
                )}
                <View style={styles.coordsRow}>
                  <Icon name="location" size={14} color={COLORS.error} />
                  <Text style={styles.coordsText}>
                    {pickedCoords.latitude.toFixed(5)}, {pickedCoords.longitude.toFixed(5)}
                  </Text>
                </View>
              </View>
              {lockedMember && (
                <View style={styles.lockedBar}>
                  <Icon name="lock" size={16} color={COLORS.success} weight="fill" />
                  <View style={styles.lockedTextCol}>
                    <Text style={styles.lockedText} numberOfLines={1}>
                      Locked on {lockedMember.fullName}
                    </Text>
                    <Text style={styles.lockedMeta} numberOfLines={1}>
                      Last seen {formatCheckpointTime(lockedMember.capturedAt)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.unlockButton}
                    onPress={() => sendMapCommand('unlock')}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Unlock the pin to choose another place"
                  >
                    <Icon name="pencilSimpleLine" size={14} color={COLORS.success} />
                    <Text style={styles.unlockText}>Unlock</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
          <View style={styles.actionRow}>
            <View style={styles.cancelCol}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={onClose}
                height={48}
                fontSize={16}
                borderRadius={24}
                style={styles.actionButton}
              />
            </View>
            <View style={styles.confirmCol}>
              <Button
                title="Confirm Location"
                variant="black"
                onPress={handleConfirm}
                disabled={!pickedCoords}
                height={48}
                fontSize={16}
                borderRadius={24}
                style={styles.actionButton}
              />
            </View>
          </View>
        </View>
        )}
      </View>
    </Modal>
  );
}

MapLocationPickerModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  originCoords: PropTypes.shape({ latitude: PropTypes.number, longitude: PropTypes.number }),
  teamMembers: PropTypes.array,
  targetRecipientId: PropTypes.string,
  initialLockedAgentId: PropTypes.string,
  originAvatarUrl: PropTypes.string,
  originInitials: PropTypes.string,
  initialCoords: PropTypes.shape({ latitude: PropTypes.number, longitude: PropTypes.number }),
};

const styles = StyleSheet.create({
  lockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    alignSelf: 'flex-start',
    marginBottom: SPACING.sm,
    paddingVertical: 8,
    paddingHorizontal: SPACING.md,
    borderRadius: 999,
    backgroundColor: '#EEF0FF',
  },
  lockButtonText: { fontSize: TYPOGRAPHY.fontSize.sm, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700', color: COLORS.primary },
  lockedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
    padding: SPACING.sm,
    borderRadius: 12,
    backgroundColor: '#E8F5E9',
  },
  lockedTextCol: { flex: 1 },
  lockedText: { fontSize: TYPOGRAPHY.fontSize.sm, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700', color: COLORS.success },
  lockedMeta: { fontSize: TYPOGRAPHY.fontSize.xs, fontFamily: TYPOGRAPHY.fontFamily.regular, fontWeight: '400', color: COLORS.textSecondary },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: SPACING.sm,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  unlockText: { fontSize: TYPOGRAPHY.fontSize.xs, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700', color: COLORS.success },
  actionRow: { flexDirection: 'row', gap: SPACING.sm },
  cancelCol: { flex: 1 },
  confirmCol: { flex: 2 },
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
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.97)',
    left: SPACING.md,
    right: SPACING.md,
    padding: SPACING.xs,
  },
  resultsScroll: { maxHeight: 300 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DDDDDD',
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
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textPrimary,
  },
  // Confirm and Cancel stack as full-width rows inside the footer.
  actionButton: { width: '100%' },
});
