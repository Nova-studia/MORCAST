/**
 * LA PALETA DE LAS GRÁFICAS — fuente única.
 *
 * DE DÓNDE SALE
 * Hasta el 7-sep-2026 los colores de las gráficas estaban escritos a mano en
 * seis archivos distintos (`portal/page.js`, `admin/rutas/page.js`,
 * `datos-reportes.js`, `portal-datos.js`, `MapaZonas.js` y la palomita de
 * `agregar-saldo`), cada uno con su propia lista y todos con el verde viejo
 * `#4eb34a` que la web dejó de usar el 3-sep. Este archivo los reemplaza.
 *
 * POR QUÉ ESTOS TONOS Y NO OTROS
 * No se eligieron a ojo. Se generaron en OKLCH dentro de la banda de
 * luminosidad que pide una paleta categórica sobre fondo oscuro (L 0.48–0.67,
 * chroma ≥ 0.10) y se pasaron por el validador de la guía de visualización,
 * que mide cinco cosas: banda de luminosidad, piso de saturación, separación
 * para daltonismo (protan/deutan/tritan), separación para visión normal y
 * contraste contra la superficie.
 *
 * 🔑 EL ORDEN NO ES DECORATIVO. El validador compara PARES ADYACENTES, y con
 * estos cinco tonos casi todos los órdenes fallan: verde junto a ámbar se
 * confunden con visión normal (ΔE 14), y cian junto a rosa se confunden con
 * deuteranopia (ΔE 4.6). Este orden es de los pocos que pasa las cinco.
 * **Si se reordena o se mete un color en medio, hay que volver a validar.**
 *
 *   node scripts/validate_palette.js "#479B57,#348DCF,#C36286,#B07A00,#009DA0" --mode dark
 *   → las 5 en PASS, tanto en oscuro como en claro (los PDF van sobre blanco).
 *
 * 🔴 REGLA: el color sigue a la ENTIDAD, nunca a su lugar en la tabla.
 * `datos-reportes.js` hacía justo lo contrario — ordenaba los tipos de residuo
 * por volumen y les daba el color según la posición, así que "Manejo Especial"
 * cambiaba de color en cuanto subía o bajaba de renglón, y dos informes de
 * meses distintos ya no se podían comparar de un vistazo. Por eso existe
 * `colorDe()`: amarra el color al nombre del tipo, no a su ranking.
 */

/** Los cinco tonos, EN ESTE ORDEN. Ver la nota de arriba antes de tocarlo. */
export const SERIES = [
  "#479B57", // 1 · verde
  "#348DCF", // 2 · azul
  "#C36286", // 3 · rosa
  "#B07A00", // 4 · ámbar
  "#009DA0", // 5 · cian
];

/**
 * Color de una serie por su posición.
 * A partir de la sexta serie repetiría color, y una gráfica con seis rebanadas
 * ya no se lee: si llegas aquí, junta la cola en "Otros" en vez de seguir.
 */
export function serie(i) {
  return SERIES[i % SERIES.length];
}

/**
 * Colores fijos por tipo de residuo. Amarrados al NOMBRE para que un tipo
 * conserve su color entre pantallas y entre periodos.
 */
export const POR_TIPO = {
  "Residuos Sólidos Urbanos": SERIES[0],
  "Manejo Especial": SERIES[1],
  "Aguas Oleosas": SERIES[2],
  "Aguas Residuales": SERIES[3],
  Reciclaje: SERIES[4],
  // Los de `datos-reportes.js`, que nombra los tipos por la unidad usada.
  "Recolección manual": SERIES[0],
  "Industrial (Roll Off)": SERIES[1],
  "Compactador trasero": SERIES[2],
  "Sin clasificar": "#7E908D", // gris a propósito: "no sabemos" no es una categoría más
};

/**
 * Color de un tipo con nombre. Cae a la posición sólo si el nombre no está
 * en la tabla, para que un tipo nuevo se vea igual y no reviente la gráfica.
 */
export function colorDe(nombre, i = 0) {
  return POR_TIPO[nombre] || serie(i);
}

/** Color por defecto de una zona en el mapa cuando la zona no trae el suyo. */
export const ZONA = SERIES[0];
