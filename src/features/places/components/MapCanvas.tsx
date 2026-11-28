import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { GeoPoint, PlaceMapFeature } from '../../../shared/contracts/places';
import { colors, radii } from '../../../shared/theme/tokens';

const DEFAULT_CENTER: GeoPoint = { lat: 10.7769, lng: 106.7009 };

type MapMessage =
  | { type: 'markerPress'; placeId: string }
  | { type: 'boundsChange'; bbox: string }
  | { type: 'selectPoint'; lat: number; lng: number };

function buildLeafletHtml({
  center,
  markers,
  selectable,
  selectedPoint,
}: {
  center: GeoPoint;
  markers: PlaceMapFeature[];
  selectable: boolean;
  selectedPoint?: GeoPoint;
}) {
  const safeMarkers = JSON.stringify(
    markers.map(m => ({
      placeId: m.placeId,
      name: m.name,
      lat: m.location.lat,
      lng: m.location.lng,
    })),
  );
  const safeSelected = JSON.stringify(selectedPoint ?? null);

  return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #f7f8f3; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    (function() {
      var map = L.map('map').setView([${center.lat}, ${center.lng}], 14);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);
      function post(payload) {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
      }
      var markers = ${safeMarkers};
      markers.forEach(function(item) {
        var m = L.circleMarker([item.lat, item.lng], {
          radius: 9, color: '#285c49', fillColor: '#285c49', fillOpacity: 0.85, weight: 2
        }).addTo(map);
        m.bindTooltip(item.name);
        m.on('click', function() {
          post({ type: 'markerPress', placeId: item.placeId });
        });
      });
      var selected = ${safeSelected};
      var pin = null;
      if (selected) {
        pin = L.circleMarker([selected.lat, selected.lng], {
          radius: 10, color: '#a53636', fillColor: '#a53636', fillOpacity: 0.8, weight: 2
        }).addTo(map);
      }
      if (${selectable ? 'true' : 'false'}) {
        map.on('click', function(e) {
          var lat = Number(e.latlng.lat.toFixed(6));
          var lng = Number(e.latlng.lng.toFixed(6));
          if (pin) { pin.setLatLng([lat, lng]); }
          else {
            pin = L.circleMarker([lat, lng], {
              radius: 10, color: '#a53636', fillColor: '#a53636', fillOpacity: 0.8, weight: 2
            }).addTo(map);
          }
          post({ type: 'selectPoint', lat: lat, lng: lng });
        });
      }
      map.on('moveend', function() {
        var b = map.getBounds();
        var bbox = [
          b.getWest().toFixed(5),
          b.getSouth().toFixed(5),
          b.getEast().toFixed(5),
          b.getNorth().toFixed(5)
        ].join(',');
        post({ type: 'boundsChange', bbox: bbox });
      });
    })();
  </script>
</body>
</html>`;
}

// Mobile OSM map powered by react-native-webview + Leaflet (no API keys / billing).
export function MapCanvas({
  center = DEFAULT_CENTER,
  markers = [],
  selectable = false,
  selectedPoint,
  onMarkerPress,
  onBoundsChange,
  onSelectPoint,
  height = 320,
  testID = 'leaflet-webview',
}: {
  center?: GeoPoint;
  markers?: PlaceMapFeature[];
  selectable?: boolean;
  selectedPoint?: GeoPoint;
  onMarkerPress?: (placeId: string) => void;
  onBoundsChange?: (bbox: string) => void;
  onSelectPoint?: (point: GeoPoint) => void;
  height?: number;
  testID?: string;
}) {
  const html = useMemo(
    () => buildLeafletHtml({ center, markers, selectable, selectedPoint }),
    [center, markers, selectable, selectedPoint],
  );

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const parsed = JSON.parse(event.nativeEvent.data) as MapMessage;
      if (parsed.type === 'markerPress' && onMarkerPress) {
        onMarkerPress(parsed.placeId);
      } else if (parsed.type === 'boundsChange' && onBoundsChange) {
        onBoundsChange(parsed.bbox);
      } else if (parsed.type === 'selectPoint' && onSelectPoint) {
        onSelectPoint({ lat: parsed.lat, lng: parsed.lng });
      }
    } catch {
      // Ignore malformed webview messages
    }
  };

  return (
    <View style={[styles.frame, { height }]}>
      <WebView
        testID={testID}
        originWhitelist={['*']}
        source={{ html }}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  webview: { flex: 1 },
});
