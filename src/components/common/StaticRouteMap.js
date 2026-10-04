// src/components/common/StaticRouteMap.js
import React, { useRef } from 'react';
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
function buildHtml({
  originCoords,
  destinationCoords,
  lastCheckpoint,
  destinations,
  showZoomControl,
  showScale,
  originLabel,
  destinationLabel,
  lastCheckpointLabel,
}) {
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
    .leaflet-control-zoom { ${showZoomControl ? 'right: 8px !important; top: 8px !important;' : 'display: none;'} }
    .leaflet-control-scale { ${showScale ? 'margin-bottom: 8px !important; margin-left: 8px !important;' : 'display: none;'} }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', {
      zoomControl: false,
      dragging: true,
      touchZoom: true,
      doubleClickZoom: true,
      scrollWheelZoom: true,
      tap: true,
      zoomSnap: 0.5,
    }).setView([${center.latitude}, ${center.longitude}], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
    ${showZoomControl ? "L.control.zoom({ position: 'topright' }).addTo(map);" : ''}
    ${showScale ? "L.control.scale({ position: 'bottomleft', imperial: false, maxWidth: 100 }).addTo(map);" : ''}

    // Full-screen map screens size this WebView via flex (fill prop), which
    // settles into its final pixel size a beat after Leaflet first reads the
    // container — without this, Leaflet caches the wrong (often 0-height)
    // tile grid and renders blank/grey until some unrelated interaction
    // forces a relayout. Re-measuring a few times after mount, plus on any
    // window resize, covers both the fast and slow-layout cases.
    window.addEventListener('resize', function () { map.invalidateSize(); });
    [100, 300, 600, 1000].forEach(function (delay) {
      setTimeout(function () { map.invalidateSize(); }, delay);
    });

    function formatCoord(point) {
      if (!point) return '';
      var lat = point.latitude, lng = point.longitude;
      var latDir = lat >= 0 ? 'N' : 'S';
      var lngDir = lng >= 0 ? 'E' : 'W';
      return Math.abs(lat).toFixed(4) + '°' + latDir + ', ' + Math.abs(lng).toFixed(4) + '°' + lngDir;
    }

    function labelTagHtml(lines) {
      var clean = (lines || []).filter(Boolean);
      if (!clean.length) return '';
      var rows = clean.map(function (line, i) {
        var style = i === 0
          ? 'font-size:12px;font-weight:700;color:#FFFFFF;'
          : 'font-size:10px;font-weight:500;color:rgba(255,255,255,0.8);margin-top:2px;';
        return '<div style="' + style + 'white-space:nowrap;line-height:1.3;">' + line + '</div>';
      }).join('');
      return '<div style="position:absolute;bottom:100%;left:50%;transform:translateX(-50%);margin-bottom:8px;' +
        'white-space:nowrap;background:#272632;padding:6px 10px;border-radius:8px;display:flex;flex-direction:column;align-items:center;">' +
        rows + '</div>';
    }

    function dot(color) {
      return L.divIcon({
        className: '',
        html: '<div style="width:20px;height:20px;border-radius:10px;background:' + color + ';border:3px solid #FFFFFF;box-shadow:0 2px 4px rgba(0,0,0,0.4);"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
    }

    function labeledDot(color, lines) {
      return L.divIcon({
        className: '',
        html: '<div style="position:relative;width:20px;height:20px;">' +
          labelTagHtml(lines) +
          '<div style="width:20px;height:20px;border-radius:10px;background:' + color + ';border:3px solid #FFFFFF;box-shadow:0 2px 4px rgba(0,0,0,0.4);"></div>' +
          '</div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
    }

    function labeledPin(color, lines) {
      return L.divIcon({
        className: '',
        html:
          '<div style="position:relative;width:26px;height:26px;">' +
          labelTagHtml(lines) +
          '<div style="width:26px;height:26px;border-radius:13px 13px 13px 0;background:' + color + ';border:3px solid #FFFFFF;transform:rotate(-45deg);box-shadow:0 2px 4px rgba(0,0,0,0.4);"></div>' +
          '</div>',
        iconSize: [26, 26],
        iconAnchor: [13, 26],
      });
    }

    function pulsingDot(color, lines) {
      return L.divIcon({
        className: '',
        html: '<div style="position:relative;width:32px;height:32px;">' +
          labelTagHtml(lines) +
          '<div style="position:absolute;top:0;left:0;width:32px;height:32px;border-radius:16px;background:' + color + '40;"></div>' +
          '<div style="position:absolute;top:6px;left:6px;width:20px;height:20px;border-radius:10px;background:' + color + ';border:3px solid #FFFFFF;box-shadow:0 2px 4px rgba(0,0,0,0.4);"></div>' +
          '</div>',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
    }

    var bounds = [];
    var origin = ${originCoords ? JSON.stringify(originCoords) : 'null'};
    var destination = ${destinationCoords ? JSON.stringify(destinationCoords) : 'null'};
    var lastCheckpoint = ${lastCheckpoint ? JSON.stringify(lastCheckpoint) : 'null'};
    var destinations = ${destinations && destinations.length ? JSON.stringify(destinations) : 'null'};
    var originLabel = ${originLabel ? JSON.stringify(originLabel) : 'null'};
    var destinationLabel = ${destinationLabel ? JSON.stringify(destinationLabel) : 'null'};
    var lastCheckpointLabel = ${lastCheckpointLabel ? JSON.stringify(lastCheckpointLabel) : 'null'};

    if (origin) {
      var originLines = originLabel ? [originLabel, formatCoord(origin)] : null;
      L.marker([origin.latitude, origin.longitude], {
        icon: originLines ? labeledDot('#0085F9', originLines) : dot('#0085F9'),
        interactive: false,
      }).addTo(map);
      bounds.push([origin.latitude, origin.longitude]);
    }
    if (destination) {
      var destinationLines = destinationLabel ? [destinationLabel, formatCoord(destination)] : null;
      L.marker([destination.latitude, destination.longitude], {
        icon: destinationLines ? labeledDot('#E63946', destinationLines) : dot('#E63946'),
        interactive: false,
      }).addTo(map);
      bounds.push([destination.latitude, destination.longitude]);
    }
    if (lastCheckpoint) {
      var checkpointLines = [lastCheckpointLabel, lastCheckpoint.label, formatCoord(lastCheckpoint)].filter(Boolean);
      L.marker([lastCheckpoint.latitude, lastCheckpoint.longitude], {
        icon: pulsingDot('#F4A825', checkpointLines),
        interactive: false,
      }).addTo(map);
      bounds.push([lastCheckpoint.latitude, lastCheckpoint.longitude]);
    }
    if (destinations) {
      destinations.forEach(function (d) {
        var lines = [[d.label, d.distanceLabel].filter(Boolean).join(' · '), formatCoord(d)];
        var color = d.delivered ? '#4c9f70' : '#E63946';
        L.marker([d.latitude, d.longitude], { icon: labeledPin(color, lines), interactive: false }).addTo(map);
        bounds.push([d.latitude, d.longitude]);
      });
    }

    var routePoints = [];
    if (origin) routePoints.push([origin.latitude, origin.longitude]);
    if (lastCheckpoint) routePoints.push([lastCheckpoint.latitude, lastCheckpoint.longitude]);
    if (destinations) {
      destinations.forEach(function (d) { routePoints.push([d.latitude, d.longitude]); });
    } else if (destination) {
      routePoints.push([destination.latitude, destination.longitude]);
    }
    if (routePoints.length > 1) {
      L.polyline(routePoints, {
        color: '#0085F9',
        weight: 3,
        opacity: 0.55,
        dashArray: '1, 10',
        lineCap: 'round',
      }).addTo(map);
    }

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [36, 36] });
    }
  </script>
</body>
</html>`;
}

export default function StaticRouteMap({
  originCoords,
  destinationCoords,
  lastCheckpoint,
  destinations,
  height = 180,
  style,
  showZoomControl = false,
  showScale = false,
  fill = false,
  originLabel,
  destinationLabel,
  lastCheckpointLabel,
}) {
  const webViewRef = useRef(null);

  // Belt-and-suspenders for the Leaflet-in-WebView blank-tile bug: the
  // in-page timers in buildHtml cover most cases, but a `fill` map whose
  // container is resized by a sibling (an animating bottom sheet, a layout
  // that settles late) needs invalidateSize() called again right when RN
  // itself reports a new size — timers alone can't know about that.
  const handleLayout = () => {
    webViewRef.current?.injectJavaScript(
      'if (window.map) { window.map.invalidateSize(); } true;'
    );
  };

  return (
    <View style={[styles.container, fill ? styles.fill : { height }, style]} onLayout={handleLayout}>
      <WebView
        ref={webViewRef}
        source={{
          html: buildHtml({
            originCoords,
            destinationCoords,
            lastCheckpoint,
            destinations,
            showZoomControl,
            showScale,
            originLabel,
            destinationLabel,
            lastCheckpointLabel,
          }),
        }}
        onLayout={handleLayout}
        style={styles.webview}
        originWhitelist={['*']}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
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
  showZoomControl: PropTypes.bool,
  showScale: PropTypes.bool,
  fill: PropTypes.bool,
  originLabel: PropTypes.string,
  destinationLabel: PropTypes.string,
  lastCheckpointLabel: PropTypes.string,
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: COLORS.background,
  },
  fill: { flex: 1 },
  webview: { flex: 1 },
});
