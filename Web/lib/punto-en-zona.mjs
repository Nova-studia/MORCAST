/**
 * Cobertura por zona: decide si un domicilio cae dentro del polígono de una ruta.
 *
 * Algoritmo de ray casting: se lanza un rayo horizontal desde el punto hacia el
 * infinito y se cuentan los lados del polígono que cruza. Impar = adentro.
 * No necesita librerías ni servicios externos.
 */

/**
 * @param {[number, number]} punto     [lat, lng]
 * @param {Array<[number, number]>} poligono
 * @returns {boolean}
 */
export function puntoEnZona(punto, poligono) {
  if (!Array.isArray(punto) || punto.length !== 2) return false;
  if (!Array.isArray(poligono) || poligono.length < 3) return false;

  const [lat, lng] = punto;
  let dentro = false;

  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const [latI, lngI] = poligono[i];
    const [latJ, lngJ] = poligono[j];

    // ¿El lado cruza la horizontal que pasa por el punto?
    const cruza = latI > lat !== latJ > lat;
    if (!cruza) continue;

    // Longitud del lado a la altura del punto.
    const lngCorte = ((lngJ - lngI) * (lat - latI)) / (latJ - latI) + lngI;
    if (lng < lngCorte) dentro = !dentro;
  }

  return dentro;
}

/**
 * Rutas activas cuya zona contiene al punto.
 * @param {[number, number]} punto
 * @param {Array<object>} rutas
 * @returns {Array<object>}
 */
export function rutasQueCubren(punto, rutas) {
  if (!Array.isArray(rutas)) return [];
  return rutas.filter((r) => r.activa && puntoEnZona(punto, r.zona));
}
