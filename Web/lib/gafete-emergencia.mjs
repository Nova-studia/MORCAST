import { normalizarCodigo } from "./gafetes.mjs";
import { normalizarPin, pinCorrecto } from "./pin-gafete.mjs";
import { fichaEmergencia } from "./personal.mjs";

/**
 * NIVEL 2 DEL GAFETE — la decisión de abrir la ficha de emergencia.
 *
 * Quien pregunta no tiene sesión: es un guardia o un paramédico con la
 * tarjeta en la mano, o alguien probando PIN. Aquí está el orden de los
 * candados, sin base ni red, para poder probarlo (tests/gafete-emergencia.test.mjs);
 * la acción del servidor (app/g/[codigo]/acciones.js) solo le pasa las piezas
 * de verdad.
 *
 *   1. Freno por IP: 20 intentos por hora, cuenten para el gafete que sea.
 *   2. Si el código o el PIN no tienen la forma, "PIN incorrecto" sin tocar
 *      el freno del gafete (no hay gafete que cuidar).
 *   3. Freno por gafete: 5 intentos cada 15 minutos, acierten o no.
 *   4. La respuesta de un PIN malo es SIEMPRE la misma, exista o no el
 *      gafete, esté vigente o no, haya firmado permiso la persona o no.
 */

export const TOPE_POR_IP = { maximo: 20, minutos: 60 };
export const TOPE_POR_GAFETE = { maximo: 5, minutos: 15 };

export const PIN_INCORRECTO = Object.freeze({
  ok: false,
  motivo: "PIN incorrecto. Revisa los 6 dígitos impresos atrás del gafete.",
});
export const ESPERA = Object.freeze({
  ok: false,
  espera: true,
  motivo: "Demasiados intentos. Espera 15 minutos o llama a Morcast.",
});
export const SIN_RESPUESTA = Object.freeze({
  ok: false,
  motivo: "No se pudo consultar en este momento. Inténtalo de nuevo o llama a Morcast.",
});

/**
 * @param {object} p
 * @param {string} p.codigo  el del enlace
 * @param {string} p.pin     lo que tecleó
 * @param {string} p.ip      de quién viene la petición
 * @param {(clave: string, tope: {maximo: number, minutos: number}) => Promise<boolean>} p.cabe
 *        anota el intento y dice si cabe; si no puede saberlo, debe decir que NO
 * @param {(codigo: string) => Promise<{gafete: object|null, empleado: object|null}>} p.buscar
 * @param {string|null} p.llave  la del PIN (PERSONAL_PIN_LLAVE)
 * @returns `{ ok: true, ficha, gafeteId }`, `PIN_INCORRECTO`, `ESPERA` o `SIN_RESPUESTA`
 */
export async function resolverEmergencia({ codigo, pin, ip, cabe, buscar, llave }) {
  if (!(await cabe(`gafete-pin-ip:${ip || "desconocida"}`, TOPE_POR_IP))) return ESPERA;

  const c = normalizarCodigo(codigo);
  const p = normalizarPin(pin);
  if (!c || !p) return PIN_INCORRECTO;
  if (!(await cabe(`gafete-pin:${c}`, TOPE_POR_GAFETE))) return ESPERA;

  let encontrado;
  try {
    encontrado = await buscar(c);
  } catch {
    return SIN_RESPUESTA;
  }
  const ficha = fichaEmergencia(encontrado);
  if (!ficha || !llave) return PIN_INCORRECTO;
  if (!(await pinCorrecto(p, encontrado.gafete.pin_cifrado, c, llave))) return PIN_INCORRECTO;
  return { ok: true, ficha, gafeteId: encontrado.gafete.id };
}
