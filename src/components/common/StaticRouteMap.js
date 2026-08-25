// src/components/common/StaticRouteMap.js
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import PropTypes from 'prop-types';
import { COLORS } from '../../constants/colors';

const FALLBACK_CENTER = { latitude: 8.4542, longitude: 124.6319 };

// Read-only counterpart to MapLocationPickerModal — no tap/drag handling, no
// confirm button, just a small inline preview of a handful of points
// (origin, destination, and the Collector's last logged checkpoint). Same
// Leaflet + OpenStreetMap-via-WebView approach for the same reason: no
// Google Maps API key, so it can't crash a production APK build.
//
// `destinations` is additive-only — a batch delivery trip needs 2+
// destination pins visible at once (one per still-undelivered leg), which
// the single `destinationCoords` prop can't express. Existing callers
// (Manager/SR Track Deliveries, both single-destination) are untouched.
function buildHtml({ originCoords, destinationCoords, lastCheckpoint, destinations }) {
  const extraPoints = (destinations || []).map((d) => ({ latitude: d.latitude, longitude: d.longitude }));
  const points = [originCoords, destinationCoords, lastCheckpoint, ...extraPoints].filter(Boolean);
  const center = points[0] || FALLBACK_CENTER;

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { position: absolute; top: 0; left: 0; right: 0; bottom: 0; margin: 0; padding: 0; }
    .leaflet-control-zoom { display: none; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: false, dragging: true, scrollWheelZoom: false })
      .setView([${center.latitude}, ${center.longitude}], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    function dot(color) {
      return L.divIcon({
        className: '',
        html: '<div style="width:14px;height:14px;border-radius:7px;background:' + color + ';border:2px solid #FFFFFF;box-shadow:0 1px 3px rgba(0,0,0,0.4);"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
    }

    function labeledPin(color, label) {
      var labelHtml = label
        ? '<div style="position:absolute;top:-22px;left:50%;transform:translateX(-50%);white-space:nowrap;background:#272632;color:#FFFFFF;font-size:10px;font-weight:700;padding:2px 6px;border-radius:6px;">' + label + '</div>'
        : '';
      return L.divIcon({
        className: '',
        html:
          '<div style="position:relative;width:18px;height:18px;">' +
          labelHtml +
          '<div style="width:18px;height:18px;border-radius:9px 9px 9px 0;background:' + color + ';border:2px solid #FFFFFF;transform:rotate(-45deg);box-shadow:0 1px 3px rgba(0,0,0,0.4);"></div>' +
          '</div>',
        iconSize: [18, 18],
        iconAnchor: [9, 18],
      });
    }

    var bounds = [];
    var origin = ${originCoords ? JSON.stringify(originCoords) : 'null'};
    var destination = ${destinationCoords ? JSON.stringify(destinationCoords) : 'null'};
    var lastCheckpoint = ${lastCheckpoint ? JSON.stringify(lastCheckpoint) : 'null'};
    var destinations = ${destinations && destinations.length ? JSON.stringify(destinations) : 'null'};

    if (origin) {
      L.marker([origin.latitude, origin.longitude], { icon: dot('#0085F9'), interactive: false }).addTo(map);
      bounds.push([origin.latitude, origin.longitude]);
    }
    if (destination) {
      L.marker([destination.latitude, destination.longitude], { icon: dot('#E63946'), interactive: false }).addTo(map);
      bounds.push([destination.latitude, destination.longitude]);
    }
    if (lastCheckpoint) {
      L.marker([lastCheckpoint.latitude, lastCheckpoint.longitude], { icon: dot('#F4A825'), interactive: false }).addTo(map);
      bounds.push([lastCheckpoint.latitude, lastCheckpoint.longitude]);
    }
    if (destinations) {
      destinations.forEach(function (d) {
        var label = [d.label, d.distanceLabel].filter(Boolean).join(' · ');
        var color = d.delivered ? '#4c9f70' : '#E63946';
        L.marker([d.latitude, d.longitude], { icon: labeledPin(color, label), interactive: false }).addTo(map);
        bounds.push([d.latitude, d.longitude]);
      });
    }

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [36, 36] });
    }
  </script>
</body>
</html>`;
}

export default function StaticRouteMap({ originCoords, destinationCoords, lastCheckpoint, destinations, height = 180, style }) {
  return (
    <View style={[styles.container, { height }, style]}>
      <WebView
        source={{ html: buildHtml({ originCoords, destinationCoords, lastCheckpoint, destinations }) }}
        style={styles.webview}
        originWhitelist={['*']}
        scrollEnabled={false}
      />
    </View>
  );
}

StaticRouteMap.propTypes = {
  originCoords: PropTypes.shape({ latitude: PropTypes.number, longitude: PropTypes.number }),
  destinationCoords: PropTypes.shape({ latitude: PropTypes.number, longitude: PropTypes.number }),
  lastCheckpoint: PropTypes.shape({ latitude: PropTypes.number, longitude: PropTypes.number }),
  destinations: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      label: PropTypes.string,
      latitude: PropTypes.number,
      longitude: PropTypes.number,
      delivered: PropTypes.bool,
      distanceLabel: PropTypes.string,
    })
  ),
  height: PropTypes.number,
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.number, PropTypes.array]),
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: COLORS.background,
  },
  webview: { flex: 1 },
});
