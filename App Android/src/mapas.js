/**
 * ENLACES A GOOGLE MAPS para llegar a un punto de recolección.
 *
 * ⚠️ ESPEJO de `Web/lib/mapas.mjs` (ahí está la historia completa). Aquí va
 * con extensión .js porque Metro trata los módulos como ESM; las pruebas lo
 * importan igual desde `tests/`.
 *
 * Pedido de los dueños (4-oct-2026): que el chofer llegue al punto exacto.
 * El formato universal de Google (`/maps/dir/?api=1`) no necesita llave ni
 * cuesta nada, y en Android abre directo la app de Google Maps navegando.
 * Con coordenadas va al pin exacto; sin ellas, a la dirección escrita, que en
 * un parque industrial suele quedar lejos del portón (por eso el chofer puede
 * guardar la ubicación en su primera visita, db/023).
 */

const CIUDAD = "Matamoros, Tamaulipas";

/** ¿Trae coordenadas utilizables? (0,0 es el "no hay" de algunas capturas.) */
export function tieneUbicacion(punto) {
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
