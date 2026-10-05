/**
 * LECTURAS DE GPS — la parte pura (sin expo-location), para probarla sola.
 *
 * El hook que de verdad pide la ubicación vive en `useUbicacion.js`.
 */

/**
 * Hasta cuántos metros de error se acepta una lectura para GUARDAR la
 * ubicación de un punto. Mismo tope que la web (`lib/ubicacion.js`): con más
 * de 100 m de error, el pin que van a usar TODOS los choferes podría quedar
 * en la nave de al lado.
 */
export const PRECISION_ACEPTABLE_M = 100;

/** ¿Esta lectura respalda que el chofer está AHÍ, o solo por la zona? */
export function esConfiable(lectura) {
  return Boolean(
    lectura &&
      typeof lectura.precision_m === "number" &&
      lectura.precision_m <= PRECISION_ACEPTABLE_M
  );
}

/**
 * Lo que entrega expo-location → la forma que guarda la base
 * (`{lat, lng, precision_m, capturada}`, igual que la web). `null` si la
 * lectura no trae coordenadas.
 */
export function lecturaDe(posicion) {
  const c = posicion?.coords;
  if (!c || !Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) return null;
  const precision = Number(c.accuracy);
  return {
    lat: c.latitude,
    lng: c.longitude,
    precision_m: Number.isFinite(precision) ? Math.round(precision) : null,
    capturada: new Date(Number.isFinite(posicion.timestamp) ? posicion.timestamp : Date.now()).toISOString(),
  };
}

/**
 * ¿Sirve esta lectura para GUARDAR la ubicación de un punto?
 *
 * Se pide ≤100 m porque la ubicación se queda para siempre y la van a usar
 * todos los choferes que vengan después: una lectura de 400 m (dentro de la
 * nave, con el cielo tapado) mandaría al siguiente a otra calle. Mejor pedir
 * que se salga a la entrada y vuelva a intentar.
 *
 * Los límites de Matamoros son los mismos que revisa la base
 * (`fijar_ubicacion_punto`, db/023): así el chofer se entera aquí, en
 * español, y no con el error del servidor. (Mismos textos que la app de
 * iPhone.)
 */
export function revisarLectura(lectura) {
  const lat = Number(lectura?.lat);
  const lng = Number(lectura?.lng);
  if (lectura?.lat == null || lectura?.lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, motivo: "No se pudo leer el GPS. Inténtalo otra vez." };
  }
  if (lat < 25.5 || lat > 26.2 || lng < -98.0 || lng > -97.0) {
    return { ok: false, motivo: "Esa ubicación no está en Matamoros. Revisa que el GPS esté encendido." };
  }
  const precision = Number(lectura?.precision_m);
  if (lectura?.precision_m == null || !Number.isFinite(precision) || precision > PRECISION_ACEPTABLE_M) {
    const m = lectura?.precision_m != null && Number.isFinite(precision) ? ` (±${Math.round(precision)} m)` : "";
    return {
      ok: false,
      motivo: `La señal del GPS es muy imprecisa${m}. Sal a la entrada del punto, al aire libre, y vuelve a intentarlo.`,
    };
  }
  return { ok: true, lat, lng, precision_m: Math.round(precision) };
}
