/**
 * ENLACES A GOOGLE MAPS para llegar a un punto de recolección.
 *
 * ESPEJO de `Web/lib/mapas.mjs` (pedido de los dueños, 4-oct-2026: que el
 * chofer llegue al punto exacto). Al tocar uno, tocar el otro.
 *
 * Se usa el formato universal de Google (`/maps/dir/?api=1`): no necesita
 * llave de API ni cuesta nada, y en el iPhone `Linking.openURL` lo abre en la
 * app de Google Maps si está instalada, o en Safari si no.
 *
 * Con coordenadas va al pin exacto. Sin ellas cae a la dirección escrita,
 * que en parques industriales suele quedar lejos de la puerta: por eso el
 * chofer puede guardar la ubicación en su primera visita (db/023).
 */

const CIUDAD = "Matamoros, Tamaulipas";

/** ¿Trae coordenadas utilizables? */
export function tieneUbicacion(punto) {
  // `Number(null)` es 0 y `Number("")` también: sin este cuidado un punto
  // sin pin se leería como (0,0), en medio del océano.
  if (punto?.lat == null || punto?.lng == null || punto.lat === "" || punto.lng === "") return false;
  const lat = Number(punto.lat);
  const lng = Number(punto.lng);
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

/**
 * ¿La lectura del GPS sirve para fijar el punto?
 *
 * Se pide ≤100 m porque la ubicación se queda para siempre y la van a usar
 * todos los choferes que vengan después: una lectura de 400 m (dentro de la
 * nave, con el cielo tapado) mandaría al siguiente a otra calle. Mejor pedir
 * que se salga a la entrada y vuelva a intentar.
 *
 * Los límites de Matamoros son los mismos que revisa la base
 * (`fijar_ubicacion_punto`, db/023): así el chofer se entera aquí, en
 * español, y no con el error del servidor.
 */
export const PRECISION_MAXIMA_M = 100;

export function revisarLectura(lectura) {
  const lat = Number(lectura?.lat);
  const lng = Number(lectura?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, motivo: "No se pudo leer el GPS. Inténtalo otra vez." };
  }
  if (lat < 25.5 || lat > 26.2 || lng < -98.0 || lng > -97.0) {
    return { ok: false, motivo: "Esa ubicación no está en Matamoros. Revisa que el GPS esté encendido." };
  }
  const precision = Number(lectura?.precision_m);
  if (!Number.isFinite(precision) || precision > PRECISION_MAXIMA_M) {
    const m = Number.isFinite(precision) ? ` (±${Math.round(precision)} m)` : "";
    return {
      ok: false,
      motivo: `La señal del GPS es muy imprecisa${m}. Sal a la entrada del punto, al aire libre, y vuelve a intentarlo.`,
    };
  }
  return { ok: true, lat, lng, precision_m: Math.round(precision) };
}
