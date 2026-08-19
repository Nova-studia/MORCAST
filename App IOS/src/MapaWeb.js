import { useMemo, useRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { T } from "./tema";
import { MATAMOROS_CENTRO } from "./rutas-datos";

/**
 * Mapa de zonas dentro de un WebView.
 *
 * ¿Por qué un WebView y no `react-native-maps`? Porque en Android esa librería
 * usa Google Maps y exige una API key con tarjeta de crédito. Aquí corre el
 * mismo Leaflet de la web sobre teselas de OpenStreetMap: sin llave y sin costo.
 *
 * El HTML se arma completo y se inyecta con `source={{ html }}`. Leaflet se trae
 * de su CDN, así que el mapa necesita internet — igual que la web.
 *
 * Props:
 *   zonas  — [{id, nombre, poligono, color}]
 *   pin    — [lat, lng] | null
 *   onPin  — callback al tocar el mapa. Si no se pasa, no es tocable.
 *   puntos — [{lat, lng, titulo}] marcadores extra
 *   alto   — número, por defecto 320
 */
export default function MapaWeb({ zonas = [], pin = null, onPin = null, puntos = [], alto = 320 }) {
  const webview = useRef(null);

  // El HTML se rearma solo cuando cambian los datos, no en cada render: si se
  // recreara siempre, el WebView se recargaría entero y el mapa parpadearía.
  const html = useMemo(
    () => construirHtml({ zonas, pin, puntos, tocable: !!onPin }),
    [zonas, pin, puntos, onPin]
  );

  return (
    <View style={[s.caja, { height: alto }]}>
      <WebView
        ref={webview}
        source={{ html }}
        originWhitelist={["*"]}
        style={s.web}
        // Sin esto el mapa se ve blanco un instante en Android.
        androidLayerType="hardware"
        scrollEnabled={false}
        onMessage={(e) => {
          if (!onPin) return;
          try {
            const d = JSON.parse(e.nativeEvent.data);
            if (d.tipo === "pin") onPin([d.lat, d.lng]);
          } catch {
            // Mensaje que no es nuestro: se ignora en silencio.
          }
        }}
        renderError={() => (
          <View style={s.error}>
            <Text style={s.errorTxt}>No se pudo cargar el mapa. Revisa tu conexión.</Text>
          </View>
        )}
      />
    </View>
  );
}

function construirHtml({ zonas, pin, puntos, tocable }) {
  const datos = JSON.stringify({ zonas, pin, puntos, tocable, centro: MATAMOROS_CENTRO });

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
  html, body, #mapa { margin:0; padding:0; height:100%; width:100%; background:${T.panel}; }
  /* Las teselas de OSM son claras; se atenúan para que peguen con el tema oscuro. */
  .leaflet-tile-pane { filter: brightness(0.72) saturate(0.85) contrast(1.05); }
  .leaflet-control-attribution { background: rgba(13,21,20,.82); color:#93a5a1; font-size:9px; }
  .leaflet-control-attribution a { color:#7cc576; }
</style>
</head>
<body>
<div id="mapa"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var D = ${datos};
  var mapa = L.map('mapa').setView(D.centro, 12);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19
  }).addTo(mapa);

  var capas = [];

  D.zonas.forEach(function (z) {
    if (!z.poligono || z.poligono.length < 3) return;
    var capa = L.polygon(z.poligono, {
      color: z.color || '#4EB34A', weight: 2, fillOpacity: 0.18
    }).addTo(mapa);
    if (z.nombre) capa.bindTooltip(z.nombre);
    capas.push(capa);
  });

  D.puntos.forEach(function (p) {
    var m = L.circleMarker([p.lat, p.lng], {
      radius: 7, color: '#DB652D', fillColor: '#DB652D', fillOpacity: 0.9
    }).addTo(mapa);
    if (p.titulo) m.bindTooltip(p.titulo);
    capas.push(m);
  });

  var marcadorPin = null;
  function ponPin(lat, lng) {
    if (marcadorPin) marcadorPin.remove();
    marcadorPin = L.circleMarker([lat, lng], {
      radius: 10, color: '#144C4F', fillColor: '#7cc576', fillOpacity: 1, weight: 3
    }).addTo(mapa).bindTooltip('Tu domicilio');
  }

  if (D.pin) ponPin(D.pin[0], D.pin[1]);

  if (capas.length) {
    var limites = L.featureGroup(capas).getBounds();
    if (limites.isValid()) mapa.fitBounds(limites, { padding: [16, 16], maxZoom: 14 });
  }

  if (D.tocable) {
    mapa.on('click', function (e) {
      ponPin(e.latlng.lat, e.latlng.lng);
      // Se avisa a React Native para que recalcule la cobertura.
      window.ReactNativeWebView.postMessage(JSON.stringify({
        tipo: 'pin', lat: e.latlng.lat, lng: e.latlng.lng
      }));
    });
  }
</script>
</body>
</html>`;
}

const s = StyleSheet.create({
  caja: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: T.linea,
    backgroundColor: T.panel,
  },
  web: { flex: 1, backgroundColor: T.panel },
  error: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  errorTxt: { color: T.gris, fontSize: 13, textAlign: "center" },
});
