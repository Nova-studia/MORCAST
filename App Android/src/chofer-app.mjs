import { estatusDeParada } from "./web/chofer-cierre.mjs";

/**
 * LO QUE DECIDE LA APP DEL CHOFER (apps al 100%, 9-oct-2026; las reglas son
 * las de la web del chofer, `src/web/chofer-cierre.mjs`). Puro, con pruebas
 * en tests/chofer-100.test.mjs.
 */

/**
 * El estatus de una parada para la lista del chofer. Sale del ESTADO de la
 * base: antes una completada sin evidencia legible (la cerró otro chofer y el
 * RLS no le deja leer sus fotos) se veía pendiente y se podía cerrar otra vez.
 */
export const estatusDeFila = (s) => estatusDeParada(s?.estado);

/**
 * Cerrar falló en el último paso (pasar a "completada"): si al releer la
 * parada YA está completada, es éxito. Pasa con un reintento tras perder la
 * señal: el primer intento sí llegó y el segundo encuentra la parada cerrada.
 */
export const cierreYaHecho = (estadoReleido) => estadoReleido === "completada";

/**
 * "El cliente ya fue avisado" SOLO si el servidor dijo `avisado: true`.
 * `false` = el servidor respondió que no le llegó nada (no tiene correo ni la
 * app); `undefined` = no se sabe (ya iba en camino, o es la demostración).
 */
export function avisadoDeRespuesta(r) {
  if (r?.avisado === true) return true;
  if (r?.ok && !r.demo && r.avisado === false) return false;
  return undefined;
}
