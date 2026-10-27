// src/components/common/StaticRouteMap.js
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import PropTypes from 'prop-types';
import { COLORS } from '../../constants/colors';
import { ICONS } from './Icon';
import { LEAFLET_JS, LEAFLET_CSS } from '../../vendor/leafletBundle';

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
  originAvatar,
  showRoute = true,
  fill = false,
  fitBottom = 120,
  fitTop = 200,
}) {
  const extraPoints = (destinations || []).map((d) => ({ latitude: d.latitude, longitude: d.longitude }));
  const points = [originCoords, destinationCoords, lastCheckpoint, ...extraPoints].filter(Boolean);
  const center = points[0] || FALLBACK_CENTER;

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>${LEAFLET_CSS}</style>
  <style>
    html, body, #map { position: absolute; top: 0; left: 0; right: 0; bottom: 0; margin: 0; padding: 0; }
    .leaflet-control-zoom { ${showZoomControl ? 'right: 8px !important; top: 8px !important;' : 'display: none;'} }
    /* Overlapping people: only the picked one keeps its name tag, the rest dim. */
    .rm-hide .rm-tag { display: none !important; }
    .rm-dim { opacity: 0.5; }
    /* Two markers a little apart: the left tag leans left and the right one leans right. */
    .rm-tl .rm-tag { left: auto !important; right: 50% !important; transform: none !important; margin-right: -14px; }
    .rm-tr .rm-tag { left: 50% !important; transform: none !important; margin-left: -14px; }
    .rm-tl .rm-tag > div:last-child, .rm-tr .rm-tag > div:last-child { display: none; }
    .leaflet-control-scale { ${showScale ? 'margin-bottom: 8px !important; margin-left: 8px !important;' : 'display: none;'} }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>${LEAFLET_JS}</script>
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
      // "Name (Role) · note": the name in bold, the role as a small coloured chip, the note below.
      var first = String(clean[0]);
      var open = first.indexOf('('), close = first.lastIndexOf(')');
      var name = first, role = '', extra = '';
      if (open > 0 && close > open) {
        name = first.slice(0, open).trim();
        role = first.slice(open + 1, close).trim();
        extra = first.slice(close + 1).trim();
        while (extra.charAt(0) === '\u00b7' || extra.charAt(0) === ' ') extra = extra.slice(1);
      }
      var roleColor = role === 'You' ? '#E63946' : role === 'Collector' ? '#C97A00' : '#0085F9';
      var chip = role
        ? '<span style="margin-left:6px;padding:1px 7px;border-radius:9px;font-size:10px;font-weight:700;white-space:nowrap;color:' + roleColor + ';background:' + roleColor + '1F;">' + role + '</span>'
        : '';
      var head = '<div style="display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#272632;line-height:1.3;">' +
        '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:150px;">' + name + '</span>' + chip + '</div>';
      var rest = clean.slice(1);
      if (extra) rest.unshift(extra);
      var body = rest.map(function (line) {
        var isCoord = String(line).indexOf('\u00b0') > -1;
        var style = isCoord
          ? 'font-size:10px;font-weight:500;color:#9AA0A6;margin-top:3px;'
          : 'font-size:11px;font-weight:500;color:#555353;margin-top:2px;';
        // A long line (e.g. a checkpoint note) wraps to two lines at most inside a capped width.
        return '<div style="' + style + 'line-height:1.3;text-align:center;overflow-wrap:anywhere;' +
          'display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;-webkit-line-clamp:2;">' + line + '</div>';
      }).join('');
      return '<div class="rm-tag" style="position:absolute;bottom:100%;left:50%;transform:translateX(-50%);margin-bottom:10px;' +
        'width:max-content;max-width:230px;background:#FFFFFF;padding:7px 11px;border-radius:10px;border:1px solid #E5E7EB;' +
        'box-shadow:0 3px 10px rgba(0,0,0,0.18);display:flex;flex-direction:column;align-items:center;">' +
        head + body +
        '<div style="position:absolute;left:50%;bottom:-5px;width:8px;height:8px;background:#FFFFFF;border-right:1px solid #E5E7EB;border-bottom:1px solid #E5E7EB;transform:translateX(-50%) rotate(45deg);"></div>' +
        '</div>';
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
      else if (command === 'recenter' && bounds.length) map.fitBounds(bounds, { paddingTopLeft: [48, ${fitTop}], paddingBottomRight: [80, ${fitBottom}], maxZoom: 16 });
      else if (command.indexOf('select:') === 0) {
        // A person picked from a list outside the map: highlight their marker, dim the rest.
        selectedId = command.slice(7) || null;
        applyClasses();
      }
      else if (command.indexOf('focusOn:') === 0) {
        var parts = command.slice(8).split(',');
        var lat = parseFloat(parts[0]);
        var lng = parseFloat(parts[1]);
        var zoom = parseFloat(parts[2]);
        if (!isNaN(lat) && !isNaN(lng)) {
          map.setView([lat, lng], isNaN(zoom) ? 16 : zoom, { animate: true });
        }
      }
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
    var originAvatar = ${originAvatar ? JSON.stringify(originAvatar) : 'null'};

    // Every marker is registered here so people standing on the same spot can be fanned out and
    // picked one at a time. The route arrows keep using the true coordinates.
    var OVERLAP_PX = 44, SPREAD_PX = 54, TAG_WIDTH_PX = 230;
    var entries = [];
    var selectedId = null;
    function addEntry(id, lat, lng, icon) {
      var marker = L.marker([lat, lng], { icon: icon, interactive: true, keyboard: false }).addTo(map);
      var entry = { id: id, lat: lat, lng: lng, marker: marker, clusterSize: 1 };
      marker.on('click', function (ev) {
        L.DomEvent.stopPropagation(ev);
        selectedId = selectedId === id ? null : id;
        applyClasses();
      });
      entries.push(entry);
      return marker;
    }
    function toggleClass(el, name, on) {
      if (on) L.DomUtil.addClass(el, name); else L.DomUtil.removeClass(el, name);
    }
    function applyClasses() {
      entries.forEach(function (e) {
        var el = e.marker.getElement();
        if (!el) return;
        var overlapped = e.clusterSize > 1;
        toggleClass(el, 'rm-hide', (overlapped || e.tagSide === 'hide') && selectedId !== e.id);
        toggleClass(el, 'rm-tl', e.tagSide === 'l');
        toggleClass(el, 'rm-tr', e.tagSide === 'r');
        toggleClass(el, 'rm-dim', !!selectedId && selectedId !== e.id);
        e.marker.setZIndexOffset(selectedId === e.id ? 2000 : 0);
      });
    }
    function layout() {
      var pts = entries.map(function (e) { return map.latLngToContainerPoint([e.lat, e.lng]); });
      var taken = {};
      entries.forEach(function (e, i) {
        if (taken[i]) return;
        var group = [i];
        taken[i] = true;
        for (var j = i + 1; j < entries.length; j++) {
          if (!taken[j] && pts[i].distanceTo(pts[j]) < OVERLAP_PX) { group.push(j); taken[j] = true; }
        }
        var cx = 0, cy = 0;
        group.forEach(function (idx) { cx += pts[idx].x; cy += pts[idx].y; });
        cx /= group.length; cy /= group.length;
        group.forEach(function (idx, k) {
          var item = entries[idx];
          item.clusterSize = group.length;
          if (group.length === 1) {
            item.marker.setLatLng([item.lat, item.lng]);
          } else {
            item.marker.setLatLng(map.containerPointToLatLng(L.point(cx + (k - (group.length - 1) / 2) * SPREAD_PX, cy)));
          }
        });
      });
      // Single markers whose tags would run into each other: lean the tags apart.
      var singles = entries.filter(function (e) { return e.clusterSize === 1; }).map(function (e) {
        return { e: e, p: map.latLngToContainerPoint(e.marker.getLatLng()) };
      }).sort(function (a, b) { return a.p.x - b.p.x; });
      entries.forEach(function (e) { e.tagSide = ''; });
      singles.forEach(function (item, i) {
        var prev = singles[i - 1], next = singles[i + 1];
        var hasLeft = prev && item.p.x - prev.p.x < TAG_WIDTH_PX && Math.abs(item.p.y - prev.p.y) < 70;
        var hasRight = next && next.p.x - item.p.x < TAG_WIDTH_PX && Math.abs(next.p.y - item.p.y) < 70;
        item.e.tagSide = hasRight && !hasLeft ? 'l' : hasLeft && !hasRight ? 'r' : hasLeft && hasRight ? 'hide' : '';
      });
      applyClasses();
    }
    map.on('zoomend', layout);
    map.on('click', function () {
      if (selectedId) { selectedId = null; applyClasses(); }
    });

    if (origin) {
      var originLines = originLabel ? [originLabel, formatCoord(origin)] : null;
      addEntry('origin', origin.latitude, origin.longitude, originAvatar
        ? avatarMarker(originAvatar, '#0085F9', originLines)
        : originLines ? labeledDot('#0085F9', originLines) : dot('#0085F9'));
      bounds.push([origin.latitude, origin.longitude]);
    }
    if (destination) {
      var destinationLines = destinationLabel ? [destinationLabel, formatCoord(destination)] : null;
      var destinationIcon = destinationAvatar
        ? avatarMarker(destinationAvatar, '#E63946', destinationLines)
        : destinationLines ? labeledDot('#E63946', destinationLines) : dot('#E63946');
      addEntry('destination', destination.latitude, destination.longitude, destinationIcon);
      bounds.push([destination.latitude, destination.longitude]);
    }
    if (lastCheckpoint) {
      var checkpointLines = [lastCheckpointLabel, lastCheckpoint.label, formatCoord(lastCheckpoint)].filter(Boolean);
      var checkpointIcon = lastCheckpointAvatar
        ? avatarMarker(lastCheckpointAvatar, '#F4A825', checkpointLines)
        : pulsingDot('#F4A825', checkpointLines);
      addEntry('checkpoint', lastCheckpoint.latitude, lastCheckpoint.longitude, checkpointIcon);
      bounds.push([lastCheckpoint.latitude, lastCheckpoint.longitude]);
    }
    if (destinations) {
      destinations.forEach(function (d, di) {
        var lines = [[d.label, d.distanceLabel].filter(Boolean).join(' · '), formatCoord(d)];
        var color = d.color || (d.delivered ? '#4c9f70' : '#E63946');
        addEntry(d.id || ('stop-' + di), d.latitude, d.longitude, d.avatar ? avatarMarker(d.avatar, color, lines) : labeledPin(color, lines));
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
    // Dashed route made only of arrowheads. The part still to travel is coloured by how far
    // it is: green up to 200 m, orange up to 1 km, red beyond. The part already travelled
    // (start -> the latest checkpoint) is grey.
    var ROUTE_GREEN = '#2E9E5B', ROUTE_ORANGE = '#F59E0B', ROUTE_RED = '#E63946', ROUTE_DONE = '#9AA0A6';
    function tierColor(meters) {
      if (meters <= 200) return ROUTE_GREEN;
      if (meters <= 1000) return ROUTE_ORANGE;
      return ROUTE_RED;
    }
    var travelledLegs = (origin && lastCheckpoint) ? 1 : 0;
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
        var legColor = i < travelledLegs ? ROUTE_DONE : tierColor(L.latLng(a[0], a[1]).distanceTo(L.latLng(b[0], b[1])));
        for (var k = 0; k < stepsPerLeg; k += 2) {
          // Arrows sit on the even steps, so they form the dashed line by themselves.
          var t0 = k / stepsPerLeg, t1 = (k + 1) / stepsPerLeg;
          var p0 = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0];
          var p1 = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1];
          var color = legColor;
          var mid = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
          L.marker(mid, { icon: arrowIcon(color, bearing), interactive: false, zIndexOffset: -1000 }).addTo(map);
        }
      }
    }
    // showRoute false (e.g. the Manager's team map): just the markers.
    if (${showRoute ? 'true' : 'false'} && routePoints.length > 1) {
      drawDashedRoute(routePoints);
    }

    if (bounds.length > 1) {
      // Keep markers (and the name tag above each) clear of the legend /
      // Online / Cancel pills on the top-left and the zoom buttons on the right.
      map.fitBounds(bounds, { paddingTopLeft: [48, ${fitTop}], paddingBottomRight: [80, ${fitBottom}] });
    } else if (bounds.length === 1 && ${fill ? 'true' : 'false'}) {
      // One point only (e.g. the trip start): lift it so a bottom sheet doesn't cover it.
      map.panBy([0, 90], { animate: false });
    }
    layout();
    [400, 1100].forEach(function (delay) { setTimeout(layout, delay); });
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
  originAvatar,
  showRoute = true,
  fitBottom = 120,
  fitTop = 200,
}, ref) {
  const webViewRef = useRef(null);

  // Lets the screen drive the map (zoom buttons live in React Native, not in Leaflet).
  useImperativeHandle(ref, () => ({
    zoomIn: () => sendMapCommand('zoomIn'),
    zoomOut: () => sendMapCommand('zoomOut'),
    recenter: () => sendMapCommand('recenter'),
    // Pans/zooms straight to a single point — e.g. TeamMapScreen jumping to
    // the person whose name card was just tapped, rather than the
    // fit-everything-in-view behavior `recenter` does.
    focusOn: (latitude, longitude, zoom = 16) => sendMapCommand(`focusOn:${latitude},${longitude},${zoom}`),
    // Highlights one marker by its id (null clears it).
    selectMarker: (id) => sendMapCommand(`select:${id || ''}`),
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
            originAvatar,
            showRoute,
            fill,
            fitBottom,
            fitTop,
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
  // Room kept under the markers (px) when the map frames them, for a bottom sheet.
  fitBottom: PropTypes.number,
  // Same for the top, so the name tags above the markers stay in view.
  fitTop: PropTypes.number,
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
