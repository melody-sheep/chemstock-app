// src/components/common/StaticRouteMap.js
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import PropTypes from 'prop-types';
import { COLORS } from '../../constants/colors';
import { ICONS } from './Icon';

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
  lastCheckpointAvatar,
  destinationAvatar,
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

    function escapeAttr(text) {
      return String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    }

    // A person on the map: their profile photo (or initials) in a ring of the
    // role colour, with a small map-pin badge so it reads as a location.
    function avatarMarker(avatar, color, lines) {
      var base = lines || [];
      var tagLines = base.slice(0, 1).concat(avatar.statusLabel ? [avatar.statusLabel] : [], base.slice(1));
      var inner = avatar.photoUrl
        ? '<img src="' + escapeAttr(avatar.photoUrl) + '" alt="" style="width:100%;height:100%;object-fit:cover;" />'
        : '<span style="font:600 13px -apple-system,Roboto,sans-serif;color:#03045E;">' + escapeAttr(avatar.initials || '?') + '</span>';
      return L.divIcon({
        className: '',
        html: '<div style="position:relative;width:48px;height:48px;">' +
          (avatar.online === null || avatar.online === undefined ? '' : '<div style="position:absolute;top:0;right:0;width:12px;height:12px;border-radius:6px;border:2px solid #FFFFFF;z-index:2;background:' + (avatar.online ? '#4c9f70' : '#dc3545') + ';"></div>') +
          labelTagHtml(tagLines) +
          '<div style="position:absolute;top:0;left:0;width:44px;height:44px;border-radius:22px;border:3px solid ' + color + ';background:#E0E7FF;overflow:hidden;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3);">' + inner + '</div>' +
          '<div style="position:absolute;right:0;bottom:0;width:18px;height:18px;border-radius:9px;background:' + color + ';border:2px solid #FFFFFF;display:flex;align-items:center;justify-content:center;">' +
          '<svg width="10" height="10" viewBox="0 0 256 256"><path fill="#FFFFFF" d="' + PIN_PATH + '"/></svg></div>' +
          '</div>',
        iconSize: [48, 48],
        iconAnchor: [22, 22],
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

    window.mapCommand = function (command) {
      if (command === 'zoomIn') map.zoomIn();
      else if (command === 'zoomOut') map.zoomOut();
      else if (command === 'recenter' && bounds.length) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    };
    var PIN_PATH = ${JSON.stringify(ICONS.mapPinFill.svg)};
    var bounds = [];
    var origin = ${originCoords ? JSON.stringify(originCoords) : 'null'};
    var destination = ${destinationCoords ? JSON.stringify(destinationCoords) : 'null'};
    var lastCheckpoint = ${lastCheckpoint ? JSON.stringify(lastCheckpoint) : 'null'};
    var destinations = ${destinations && destinations.length ? JSON.stringify(destinations) : 'null'};
    var originLabel = ${originLabel ? JSON.stringify(originLabel) : 'null'};
    var destinationLabel = ${destinationLabel ? JSON.stringify(destinationLabel) : 'null'};
    var lastCheckpointLabel = ${lastCheckpointLabel ? JSON.stringify(lastCheckpointLabel) : 'null'};
    var lastCheckpointAvatar = ${lastCheckpointAvatar ? JSON.stringify(lastCheckpointAvatar) : 'null'};
    var destinationAvatar = ${destinationAvatar ? JSON.stringify(destinationAvatar) : 'null'};

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
      var destinationIcon = destinationAvatar
        ? avatarMarker(destinationAvatar, '#E63946', destinationLines)
        : destinationLines ? labeledDot('#E63946', destinationLines) : dot('#E63946');
      L.marker([destination.latitude, destination.longitude], { icon: destinationIcon, interactive: false }).addTo(map);
      bounds.push([destination.latitude, destination.longitude]);
    }
    if (lastCheckpoint) {
      var checkpointLines = [lastCheckpointLabel, lastCheckpoint.label, formatCoord(lastCheckpoint)].filter(Boolean);
      var checkpointIcon = lastCheckpointAvatar
        ? avatarMarker(lastCheckpointAvatar, '#F4A825', checkpointLines)
        : pulsingDot('#F4A825', checkpointLines);
      L.marker([lastCheckpoint.latitude, lastCheckpoint.longitude], {
        icon: checkpointIcon,
        interactive: false,
      }).addTo(map);
      bounds.push([lastCheckpoint.latitude, lastCheckpoint.longitude]);
    }
    if (destinations) {
      destinations.forEach(function (d) {
        var lines = [[d.label, d.distanceLabel].filter(Boolean).join(' · '), formatCoord(d)];
        var color = d.delivered ? '#4c9f70' : '#E63946';
        L.marker([d.latitude, d.longitude], { icon: d.avatar ? avatarMarker(d.avatar, color, lines) : labeledPin(color, lines), interactive: false }).addTo(map);
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
    // Dashed route made only of arrowheads. The colour blends from the
    // collector (orange) at the start of the route to the Sales Rep (red) at the end.
    function mixHex(a, b, t) {
      var pa = [1, 3, 5].map(function (i) { return parseInt(a.substr(i, 2), 16); });
      var pb = [1, 3, 5].map(function (i) { return parseInt(b.substr(i, 2), 16); });
      return '#' + pa.map(function (v, i) {
        return Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0');
      }).join('');
    }
    function arrowIcon(color, rotationDeg) {
      return L.divIcon({
        className: '',
        html: '<svg width="10" height="10" viewBox="0 0 10 10" style="transform:rotate(' + rotationDeg + 'deg);display:block;">' +
          '<path d="M5 0 L10 10 L5 7.5 L0 10 Z" fill="' + color + '"/></svg>',
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      });
    }
    function drawDashedRoute(points) {
      var stepsPerLeg = 30; // more steps = arrows closer together
      var legs = points.length - 1;
      for (var i = 0; i < legs; i++) {
        var a = points[i], b = points[i + 1];
        // Bearing from north, clockwise: the arrow is drawn pointing up, so this is its rotation.
        var bearing = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
        for (var k = 0; k < stepsPerLeg; k += 2) {
          // Arrows sit on the even steps, so they form the dashed line by themselves.
          var t0 = k / stepsPerLeg, t1 = (k + 1) / stepsPerLeg;
          var p0 = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0];
          var p1 = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1];
          var progress = (i + (t0 + t1) / 2) / legs;
          var color = mixHex('#F4A825', '#E63946', progress);
          var mid = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
          L.marker(mid, { icon: arrowIcon(color, bearing), interactive: false, zIndexOffset: -1000 }).addTo(map);
        }
      }
    }
    if (routePoints.length > 1) {
      drawDashedRoute(routePoints);
    }

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [48, 96] });
    }
  </script>
</body>
</html>`;
}

const StaticRouteMap = forwardRef(function StaticRouteMap({
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
  lastCheckpointAvatar,
  destinationAvatar,
}, ref) {
  const webViewRef = useRef(null);

  // Lets the screen drive the map (zoom buttons live in React Native, not in Leaflet).
  useImperativeHandle(ref, () => ({
    zoomIn: () => sendMapCommand('zoomIn'),
    zoomOut: () => sendMapCommand('zoomOut'),
    recenter: () => sendMapCommand('recenter'),
  }));

  const sendMapCommand = (command) => {
    webViewRef.current?.injectJavaScript(`window.mapCommand && window.mapCommand('${command}'); true;`);
  };

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
            lastCheckpointAvatar,
            destinationAvatar,
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
});

StaticRouteMap.propTypes = {
  originCoords: PropTypes.shape({ latitude: PropTypes.number, longitude: PropTypes.number }),
  destinationCoords: PropTypes.shape({ latitude: PropTypes.number, longitude: PropTypes.number }),
  lastCheckpoint: PropTypes.shape({ latitude: PropTypes.number, longitude: PropTypes.number }),
  destinations: PropTypes.arrayOf(
    PropTypes.shape({
      avatar: PropTypes.shape({ photoUrl: PropTypes.string, initials: PropTypes.string, online: PropTypes.bool, statusLabel: PropTypes.string }),
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
  // { photoUrl, initials } — draws the person's photo marker instead of a dot.
  lastCheckpointAvatar: PropTypes.shape({ photoUrl: PropTypes.string, initials: PropTypes.string, online: PropTypes.bool, statusLabel: PropTypes.string }),
  destinationAvatar: PropTypes.shape({ photoUrl: PropTypes.string, initials: PropTypes.string, online: PropTypes.bool, statusLabel: PropTypes.string }),
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

export default StaticRouteMap;
