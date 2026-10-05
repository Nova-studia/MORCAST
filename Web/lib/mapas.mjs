/**
 * ENLACES A GOOGLE MAPS para llegar a un punto de recolección.
 *
 * Pedido de los dueños (4-oct-2026): que el chofer llegue al punto exacto.
 * Se usa el formato universal de Google (`/maps/dir/?api=1`): no necesita
 * llave de API ni cuesta nada, y en el teléfono abre la app de Google Maps
 * (o la que la persona tenga) directo en modo navegación.
 *
 * Con coordenadas va al pin exacto. Sin ellas cae a la dirección escrita,
 * que en parques industriales suele quedar lejos de la puerta: por eso el
 * chofer puede guardar la ubicación en su primera visita (db/023).
 */

const CIUDAD = "Matamoros, Tamaulipas";

/** ¿Trae coordenadas utilizables? */
export function tieneUbicacion(punto) {
  const lat = Number(punto?.lat);
  const lng = Number(punto?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
}

/** La dirección escrita, completa, para buscarla si no hay pin. */
export function direccionDe(punto) {
  const partes = [punto?.calle, punto?.colonia, punto?.cp ? `C.P. ${punto.cp}` : null, CIUDAD]
    .map((p) => String(p || "").trim())
    .filter(Boolean);
  return partes.join(", ");
}

/** Enlace "Cómo llegar": navegación desde donde esté el teléfono. */
export function enlaceComoLlegar(punto) {
  const destino = tieneUbicacion(punto)
    ? `${Number(punto.lat)},${Number(punto.lng)}`
    : direccionDe(punto);
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}&travelmode=driving`;
}

/** Enlace para VER el punto en el mapa (sin navegar). */
export function enlaceVerEnMapa(punto) {
  const consulta = tieneUbicacion(punto)
    ? `${Number(punto.lat)},${Number(punto.lng)}`
    : direccionDe(punto);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}`;
}
