// src/components/common/MapLocationPickerModal.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, Pressable, TextInput, ScrollView, Keyboard } from 'react-native';
import Alert from '../../utils/appAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import PropTypes from 'prop-types';
import Icon, { ICONS } from './Icon';
import Button from './Button';
import UserAvatar from './UserAvatar';
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
import { LEAFLET_JS, LEAFLET_CSS } from '../../vendor/leafletBundle';

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
const TIER_GREEN = '#0085F9'; // the nearest tier is blue now
const TIER_ORANGE = '#F59E0B';
const TIER_RED = '#E63946';

// Search: wait for typing to pause, and show at most this many results.
const SEARCH_DEBOUNCE_MS = 400;
const SEARCH_MIN_LENGTH = 2;
const SEARCH_MIN_ONLINE_LENGTH = 3;
const MAX_SEARCH_RESULTS = 8;

// Floating panel heights and the zoom column's position below the search bar.
const SEARCH_BAR_HEIGHT = 40;

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
  <style>${LEAFLET_CSS}</style>
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
  <script>${LEAFLET_JS}</script>
  <script>
    var initial = ${initialJson};
    var PIN_PATH = ${JSON.stringify(ICONS.mapPinFill.svg)};
    var map = L.map('map', { zoomControl: false, attributionControl: false }).setView([${center.latitude}, ${center.longitude}], 15);
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
      var firstFix = !originLatLng;
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
      // The team was drawn before we knew where the manager is: redo it so nobody hides under the manager's marker.
      if (firstFix && lastTeam) window.setTeam(lastTeam);
      fitChain();
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
    // One run of arrowheads between two points; its colour shows how long that leg is.
    function drawLeg(fromLL, toLL, dragging, startGap, endGap) {
      var a = map.latLngToContainerPoint(fromLL);
      var b = map.latLngToContainerPoint(toLL);
      var dx = b.x - a.x, dy = b.y - a.y;
      var len = Math.sqrt(dx * dx + dy * dy);
      var step = dragging ? 30 : 26;
      if (len < startGap + endGap + step * 0.5) return;
      var deg = Math.atan2(dy, dx) * 180 / Math.PI;
      var color = trailColor(map.distance(fromLL, toLL));
      var count = Math.min(80, Math.floor((len - startGap - endGap) / step) + 1);
      for (var i = 0; i < count; i++) {
        var t = startGap + i * step;
        var p = L.point(a.x + dx / len * t, a.y + dy / len * t);
        L.marker(map.containerPointToLatLng(p), {
          icon: trailIcon(color, deg, dragging), interactive: false, keyboard: false, zIndexOffset: -100,
        }).addTo(trailLayer);
      }
    }
    // Released via a Collector: you -> Collector stays fixed, Collector -> pin follows the pin.
    // Direct release (or the Collector has no recorded spot): you -> pin, as before.
    var viaLatLng = null;
    var viaId = null;
    var chainFitted = false;
    function viaShown() {
      return viaId && teamMarkers[viaId] ? teamMarkers[viaId].marker.getLatLng() : viaLatLng;
    }
    function drawTrail() {
      trailLayer.clearLayers();
      var to = destinationMarker ? destinationMarker.getLatLng() : null;
      if (viaLatLng) {
        var via = viaShown();
        if (originLatLng) drawLeg(originLatLng, via, false, 36, 30);
        if (to) drawLeg(via, to, trailDragging, 30, 16);
        return;
      }
      if (originLatLng && to) drawLeg(originLatLng, to, trailDragging, 36, 16);
    }
    // Once, when both ends are known: frame you, the Collector and the pin together.
    function fitChain() {
      if (chainFitted || !originLatLng || !viaLatLng) return;
      chainFitted = true;
      var pts = [originLatLng, viaLatLng];
      if (destinationMarker) pts.push(destinationMarker.getLatLng());
      map.fitBounds(L.latLngBounds(pts), { paddingTopLeft: [40, 230], paddingBottomRight: [70, 340], maxZoom: 17, animate: false });
    }
    window.setVia = function (v) {
      viaLatLng = v ? [v.lat, v.lng] : null;
      viaId = v ? v.id : null;
      drawTrail();
      fitChain();
    };
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
    var teamMarkers = {};
    var lastTeam = null;
    var selectedId = null;

    function memberIcon(m, state) {
      var selected = state === 'selected';
      var face = m.photoUrl
        ? '<img src="' + escapeHtml(m.photoUrl) + '" alt="" style="width:100%;height:100%;object-fit:cover;" />'
        : escapeHtml(m.initials || '');
      var tag = !(m.isTarget || selected) ? '' : '<div style="position:absolute;bottom:100%;left:50%;transform:translateX(-50%);margin-bottom:' + (selected ? 12 : 6) + 'px;'
        + 'width:max-content;max-width:180px;background:#272632;color:#fff;padding:4px 8px;border-radius:8px;text-align:center;">'
        + '<div style="font-size:11px;font-weight:700;">' + escapeHtml(m.name) + '</div>'
        + '<div style="font-size:10px;opacity:.8;">' + escapeHtml(m.subtitle) + '</div></div>';
      var ring = !selected ? '' : '<div style="position:absolute;left:-10px;top:-10px;width:60px;height:60px;border-radius:30px;background:' + m.color + ';opacity:.35;animation:me-pulse 1.8s ease-out infinite;"></div>';
      return L.divIcon({
        className: '',
        html: '<div style="position:relative;width:40px;height:40px;opacity:' + (state === 'dim' ? 0.5 : 1) + ';">' + ring + tag
          + '<div style="position:relative;width:40px;height:40px;border-radius:20px;border:' + (selected ? 4 : 3) + 'px solid ' + m.color + ';background:#EEF2FF;'
          + 'overflow:hidden;display:flex;align-items:center;justify-content:center;font:700 12px sans-serif;color:#03045E;'
          + 'box-shadow:0 2px 4px rgba(0,0,0,.35);">' + face + '</div></div>',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });
    }

    function refreshTeamIcons() {
      Object.keys(teamMarkers).forEach(function (id) {
        var t = teamMarkers[id];
        var state = selectedId ? (id === selectedId ? 'selected' : 'dim') : 'normal';
        t.marker.setIcon(memberIcon(t.m, state));
        t.marker.setZIndexOffset(id === selectedId ? 1500 : (t.m.isTarget ? 500 : 0));
      });
    }

    // Called from React Native when a card in the team sheet is tapped (null clears it): the map moves to
    // that person and their marker gets a name tag and a pulse. The pin and its arrowheads are not touched.
    window.focusMember = function (id) {
      selectedId = id || null;
      refreshTeamIcons();
      if (!selectedId || !teamMarkers[selectedId]) return;
      map.setView(teamMarkers[selectedId].marker.getLatLng(), Math.max(map.getZoom(), 17));
    };

    window.setTeam = function (members) {
      lastTeam = members;
      teamLayer.clearLayers();
      teamMarkers = {};
      var seen = {};
      (members || []).forEach(function (m) {
        var key = m.lat.toFixed(4) + ',' + m.lng.toFixed(4);
        var n = seen[key] = (seen[key] || 0) + 1;
        // Same spot as someone already drawn: offset in a small circle.
        var angle = n * 1.2, step = n > 1 ? 0.00012 : 0;
        var lat = m.lat + Math.sin(angle) * step;
        var lng = m.lng + Math.cos(angle) * step;
        // Standing on the manager's own marker: nudge aside so both stay visible.
        if (originLatLng && map.distance(originLatLng, [lat, lng]) < 20) lng += 0.00018;
        var marker = L.marker([lat, lng], { icon: memberIcon(m, 'normal'), zIndexOffset: m.isTarget ? 500 : 0 }).on('click', function () {
          window.ReactNativeWebView.postMessage(JSON.stringify({ selected: m.agentId }));
        }).addTo(teamLayer);
        teamMarkers[m.agentId] = { marker: marker, m: m };
      });
      if (selectedId && !teamMarkers[selectedId]) selectedId = null;
      refreshTeamIcons();
      drawTrail();
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
  // When given, only these people (the picked Collector and the receiving Sales Rep) are listed and drawn.
  featuredAgentIds = null,
  // The Collector the stock goes through (release via Collector): the map links you -> them -> the pin.
  viaAgentId = null,
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
    if (distanceMeters <= NEAR_PIN_METERS) distanceTier = { color: TIER_GREEN, background: '#EAF4FF' };
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
  // Everyone with a recorded spot (Sales Reps and Collectors) for the team sheet; the release's recipient first.
  const teamList = (teamMembers || [])
    .filter((m) => (m.role === 'sales_rep' || m.role === 'collector') && m.latitude != null && m.longitude != null)
    .filter((m) => !featuredAgentIds || featuredAgentIds.length === 0 || featuredAgentIds.includes(m.agentId))
    .sort(
      (a, b) =>
        (b.agentId === targetRecipientId) - (a.agentId === targetRecipientId) ||
        (a.role === b.role ? 0 : a.role === 'sales_rep' ? -1 : 1) ||
        String(a.fullName).localeCompare(String(b.fullName))
    );
  const viaMember = viaAgentId ? teamList.find((m) => m.agentId === viaAgentId) || null : null;
  const viaCoords = viaMember ? { latitude: viaMember.latitude, longitude: viaMember.longitude } : null;
  const [lockedAgentId, setLockedAgentId] = useState(null);
  const lockedMember = teamList.find((m) => m.agentId === lockedAgentId) || null;
  // Team sheet: collapsed by default; tapping a card only moves the map to that person.
  const [isTeamOpen, setIsTeamOpen] = useState(false);
  const [focusedId, setFocusedId] = useState(null);
  const handleSelectMember = (member) => {
    const next = focusedId === member.agentId ? null : member.agentId;
    setFocusedId(next);
    webViewRef.current?.injectJavaScript(`window.focusMember && window.focusMember(${JSON.stringify(next)}); true;`);
  };
  // The pin starts locked on the Sales Rep; adjusting it is allowed but the Manager is told what it means.
  const handleUnlock = () => {
    Alert.alert(
      'Unlock the pin?',
      `The delivery will go to the spot you choose, not to ${lockedMember?.fullName || 'the recipient'}'s last recorded location. Unlock anyway?`,
      [
        { text: 'Keep locked', style: 'cancel' },
        { text: 'Unlock', onPress: () => sendMapCommand('unlock') },
      ]
    );
  };
  const lockOnTarget = () => {
    if (!targetMember) return;
    webViewRef.current?.injectJavaScript(
      `window.lockOn && window.lockOn(${JSON.stringify({ lat: targetMember.latitude, lng: targetMember.longitude, id: targetMember.agentId })}); true;`
    );
  };

  // Legs of the chain, shown as chips: you -> Collector, and Collector -> pin.
  const tierFor = (meters) =>
    meters <= NEAR_PIN_METERS
      ? { color: TIER_GREEN, background: '#EAF4FF' }
      : meters <= MID_PIN_METERS
        ? { color: '#D98200', background: '#FFF3E0' }
        : { color: TIER_RED, background: '#FDECEA' };
  const viaFirstName = viaMember ? String(viaMember.fullName || 'Collector').split(' ')[0] : '';
  const legToVia = viaCoords ? distanceInMeters(originCoords, viaCoords) : null;
  const legFromVia = viaCoords && pickedCoords ? distanceInMeters(viaCoords, pickedCoords) : null;

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
      teamList.map((m) => ({
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
    const via = viaCoords ? JSON.stringify({ lat: viaCoords.latitude, lng: viaCoords.longitude, id: viaAgentId }) : 'null';
    webViewRef.current.injectJavaScript(`window.setVia && window.setVia(${via}); true;`);
  };

  useEffect(() => {
    pushTeam();
  }, [teamMembers, targetRecipientId, viaAgentId]);

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
  // One header holds the title and the search; it can fold the search away to give the map more room.
  const [isHeaderOpen, setIsHeaderOpen] = useState(true);
  const [headerHeight, setHeaderHeight] = useState(110);
  const toggleHeader = () => {
    if (isHeaderOpen) {
      Keyboard.dismiss();
      setSearchQuery('');
    }
    setIsHeaderOpen((open) => !open);
  };
  const trimmedQuery = searchQuery.trim();
  // The results panel needs a focused box with something typed.
  const isResultsOpen = isSearchFocused && trimmedQuery.length >= SEARCH_MIN_LENGTH;
  // While the keyboard is up the bottom sheet and zoom buttons step aside (they would ride up above the
  // keyboard and cover the map); they return as soon as the keyboard closes, however it was closed.
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardOpen(false);
      setIsSearchFocused(false);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

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
      if (data.selected !== undefined) {
        const member = teamList.find((m) => m.agentId === data.selected);
        if (member) handleSelectMember(member);
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
    setIsTeamOpen(false);
    setFocusedId(null);
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

        <View
          onLayout={(e) => setHeaderHeight(Math.round(e.nativeEvent.layout.height))}
          style={[styles.headerSheet, { paddingTop: insets.top + SPACING.sm }]}
        >
          <TouchableOpacity
            style={styles.headerRow}
            onPress={toggleHeader}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={isHeaderOpen ? 'Hide the search' : 'Show the search'}
          >
            <View style={styles.headerTextCol}>
              <Text style={styles.title}>Pin Delivery Destination</Text>
              <Text style={styles.subtitle}>
                {lockedMember
                  ? `Pinned on ${lockedMember.fullName}'s last location`
                  : viaMember && targetRecipientId && !targetMember && !pickedCoords
                    ? 'The Sales Rep has no recorded location yet. Tap the map to place the pin.'
                    : 'Tap the map, or drag the pin to adjust'}
              </Text>
            </View>
            <View style={isHeaderOpen ? styles.caretUp : null}>
              <Icon name="caretDown" size={16} color={COLORS.primary} />
            </View>
          </TouchableOpacity>
          {isHeaderOpen && (
            <View style={styles.searchBar}>
              <Icon name="search" size={16} color={COLORS.textSecondary} />
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
                  <Icon name="xCircle" size={16} color={COLORS.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {isResultsOpen && (
          <View style={[styles.glass, styles.searchResults, { top: headerHeight + SPACING.sm }]}>
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

        {!isKeyboardOpen && (
        <View style={[styles.glass, styles.controls, { top: headerHeight + SPACING.md }]}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => sendMapCommand('zoomIn')}
            accessibilityRole="button"
            accessibilityLabel="Zoom in"
          >
            <Icon name="plus" size={16} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <View style={styles.controlDivider} />
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => sendMapCommand('zoomOut')}
            accessibilityRole="button"
            accessibilityLabel="Zoom out"
          >
            <Icon name="minus" size={16} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <View style={styles.controlDivider} />
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => sendMapCommand('recenter')}
            disabled={originLat === null}
            accessibilityRole="button"
            accessibilityLabel="Center on my location"
          >
            <Icon name="navigation" size={16} color={originLat === null ? COLORS.textTertiary : COLORS.primary} />
          </TouchableOpacity>
        </View>
        )}

        {!isKeyboardOpen && (
        <View style={[styles.footerSheet, { paddingBottom: insets.bottom + SPACING.md }]}>
          <View style={styles.sheetHandle} />
          {targetMember && lockedAgentId !== targetMember.agentId && (
            <TouchableOpacity style={styles.lockButton} onPress={lockOnTarget} activeOpacity={0.8}>
              <Icon name="location" size={16} color={COLORS.primary} />
              <Text style={styles.lockButtonText} numberOfLines={1}>
                Deliver to {targetMember.fullName}'s location
              </Text>
            </TouchableOpacity>
          )}
          {teamList.length > 0 && (
            <View>
              <TouchableOpacity
                style={styles.teamHeader}
                onPress={() => setIsTeamOpen((open) => !open)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={isTeamOpen ? 'Hide the team list' : 'Show the team list'}
              >
                <Text style={styles.teamTitle}>Team on the map ({teamList.length})</Text>
                <Text style={styles.teamToggle}>{isTeamOpen ? 'Hide' : 'Show more'}</Text>
                <View style={isTeamOpen ? styles.caretUp : null}>
                  <Icon name="caretDown" size={14} color={COLORS.primary} />
                </View>
              </TouchableOpacity>
              {isTeamOpen && (
                <ScrollView style={styles.teamList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                  {teamList.map((m) => {
                    const meters = distanceInMeters(originCoords, { latitude: m.latitude, longitude: m.longitude });
                    const isSelected = m.agentId === focusedId;
                    const roleColor = m.role === 'collector' ? '#F4A825' : '#E63946';
                    return (
                      <Pressable
                        key={m.agentId}
                        style={({ pressed }) => [styles.teamRow, pressed && styles.teamRowPressed, isSelected && styles.teamRowSelected]}
                        onPress={() => handleSelectMember(m)}
                        accessibilityRole="button"
                        accessibilityLabel={`Show ${m.fullName} on the map`}
                      >
                        <UserAvatar photoUrl={m.photoUrl} fallbackText={getInitials(m.fullName)} size={36} />
                        <View style={styles.teamRowText}>
                          <View style={styles.teamNameRow}>
                            <Text style={styles.teamName} numberOfLines={1}>{m.fullName}</Text>
                            <View style={[styles.teamRoleChip, { borderColor: roleColor }]}>
                              <Text style={[styles.teamRoleText, { color: roleColor }]}>{m.role === 'collector' ? 'Collector' : 'Sales Rep'}</Text>
                            </View>
                          </View>
                          <Text style={styles.teamMeta} numberOfLines={1}>Last seen {formatCheckpointTime(m.capturedAt)}</Text>
                          <Text style={styles.teamMeta} numberOfLines={1}>
                            {formatCoordinates(m.latitude, m.longitude)}
                            {meters === null ? '' : ` · ${formatDistance(meters)} from you`}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          )}
          {pickedCoords && (
            <View style={styles.insightCard}>
              <Text style={styles.addressText} numberOfLines={2}>
                {pickedAddress || 'Finding address…'}
              </Text>
              <View style={styles.insightRow}>
                {!viaMember && distanceLabel && (
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
              {!!viaMember && (
                <View style={styles.legRow}>
                  {legToVia !== null && (
                    <View style={[styles.legChip, { backgroundColor: tierFor(legToVia).background }]}>
                      <Text style={[styles.legName, { color: tierFor(legToVia).color }]} numberOfLines={1}>You</Text>
                      <Icon name="arrowRight" size={13} color={tierFor(legToVia).color} weight="bold" />
                      <Text style={[styles.legName, { color: tierFor(legToVia).color }]} numberOfLines={1}>{viaFirstName}</Text>
                      <Text style={[styles.legDistance, { color: tierFor(legToVia).color }]}>{formatDistance(legToVia)}</Text>
                    </View>
                  )}
                  {legFromVia !== null && (
                    <View style={[styles.legChip, { backgroundColor: tierFor(legFromVia).background }]}>
                      <Text style={[styles.legName, { color: tierFor(legFromVia).color }]} numberOfLines={1}>{viaFirstName}</Text>
                      <Icon name="arrowRight" size={13} color={tierFor(legFromVia).color} weight="bold" />
                      <Icon name="location" size={13} color={tierFor(legFromVia).color} />
                      <Text style={[styles.legName, { color: tierFor(legFromVia).color }]}>Pin</Text>
                      <Text style={[styles.legDistance, { color: tierFor(legFromVia).color }]}>{formatDistance(legFromVia)}</Text>
                    </View>
                  )}
                </View>
              )}
              {lockedMember && (
                <View style={styles.lockedBar}>
                  <Icon name="lock" size={16} color={TIER_GREEN} weight="fill" />
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
                    onPress={handleUnlock}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Unlock the pin to choose another place"
                  >
                    <Icon name="pencilSimpleLine" size={14} color={TIER_GREEN} />
                    <Text style={styles.unlockText}>Unlock</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
          <View style={styles.actionRow}>
            <View style={styles.confirmCol}>
              <Button
                title="Confirm Location"
                variant="black"
                onPress={handleConfirm}
                disabled={!pickedCoords}
                height={40}
                fontSize={15}
                borderRadius={20}
                style={styles.actionButton}
              />
            </View>
            <View style={styles.cancelCol}>
              <Button
                title="Cancel"
                variant="outline"
                accentColor="#E5366B"
                onPress={onClose}
                height={40}
                fontSize={15}
                borderRadius={20}
                style={styles.actionButton}
              />
            </View>
          </View>
          <Text style={styles.attribution}>Map © OpenStreetMap contributors · Leaflet</Text>
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
  featuredAgentIds: PropTypes.arrayOf(PropTypes.string),
  viaAgentId: PropTypes.string,
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
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: SPACING.sm,
    borderRadius: 12,
    backgroundColor: '#EAF4FF',
  },
  lockedTextCol: { flex: 1 },
  lockedText: { fontSize: TYPOGRAPHY.fontSize.sm, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700', color: TIER_GREEN },
  lockedMeta: { fontSize: TYPOGRAPHY.fontSize.xs, fontFamily: TYPOGRAPHY.fontFamily.regular, fontWeight: '400', color: COLORS.textSecondary },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 28,
    paddingHorizontal: SPACING.sm,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: TIER_GREEN,
  },
  unlockText: { fontSize: TYPOGRAPHY.fontSize.xs, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700', color: TIER_GREEN },
  actionRow: { gap: SPACING.sm },
  cancelCol: { width: '100%' },
  confirmCol: { width: '100%' },
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

  // Header attached to the top, left and right edges, like the bottom sheet at the other end.
  headerSheet: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 10,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  headerTextCol: { flex: 1 },
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
    marginTop: SPACING.sm,
    height: SEARCH_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 14,
    backgroundColor: '#F1F5FB',
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
    width: 38,
    alignItems: 'center',
    paddingVertical: 2,
  },
  controlButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlDivider: {
    width: 22,
    height: 1,
    backgroundColor: COLORS.glassBorder,
  },

  // Bottom sheet attached to the left, right and bottom edges of the screen, like the other screens' sheets.
  footerSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 10,
  },
  sheetHandle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#DADDE3' },
  attribution: { textAlign: 'center', fontSize: 10, lineHeight: 12, fontFamily: TYPOGRAPHY.fontFamily.regular, color: COLORS.textTertiary },
  teamHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  teamTitle: { flex: 1, fontSize: TYPOGRAPHY.fontSize.sm, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700', color: COLORS.textPrimary },
  teamToggle: { fontSize: TYPOGRAPHY.fontSize.xs, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700', color: COLORS.primary },
  caretUp: { transform: [{ rotate: '180deg' }] },
  teamList: { maxHeight: 170, marginTop: 4 },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: 8, marginBottom: 6, borderRadius: 12, borderWidth: 1, borderColor: '#E1EEFF', backgroundColor: '#F4F9FF' },
  teamRowPressed: { backgroundColor: '#E3F0FF' },
  teamRowSelected: { backgroundColor: '#D6E9FF', borderColor: '#0085F9' },
  teamRowText: { flex: 1 },
  teamNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  teamName: { flexShrink: 1, fontSize: TYPOGRAPHY.fontSize.sm, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700', color: COLORS.textPrimary },
  teamRoleChip: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, borderWidth: 1 },
  teamRoleText: { fontSize: 10, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  teamMeta: { fontSize: TYPOGRAPHY.fontSize.xs, fontFamily: TYPOGRAPHY.fontFamily.regular, color: COLORS.textSecondary, marginTop: 1 },
  insightCard: { gap: SPACING.sm },
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
  legRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  legChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: SPACING.sm, paddingVertical: 5, borderRadius: 12 },
  legName: { fontSize: TYPOGRAPHY.fontSize.xs, fontFamily: TYPOGRAPHY.fontFamily.semibold, fontWeight: '600', maxWidth: 90 },
  legDistance: { marginLeft: 4, paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: 'rgba(0,0,0,0.12)', fontSize: TYPOGRAPHY.fontSize.xs, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: '700' },
  coordsRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  coordsText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textSecondary,
  },
  addressText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textPrimary,
  },
  // Confirm and Cancel stack as full-width rows inside the footer.
  actionButton: { width: '100%' },
});
