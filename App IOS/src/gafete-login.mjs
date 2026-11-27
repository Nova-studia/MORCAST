/**
 * ENTRAR CON EL GAFETE — la parte pura de la app (sin React Native).
 * Diseño: docs/superpowers/specs/2026-11-27-entrar-con-gafete-design.md
 *
 * ⚠️ Este archivo es IGUAL en App Android y App IOS. `TEXTOS_GAFETE` y el
 * tope son copia de Web/lib/gafete-acceso.mjs: tests/gafete-login.test.mjs
 * truena si alguien cambia uno sin el otro.
 */

export const MAX_FALLOS_TELEFONO = 4;

export const TEXTOS_GAFETE = {
  noEntra: "Este gafete no puede entrar en este teléfono.",
  usaCorreo: "Demasiados intentos con el gafete. Entra con tu correo.",
  sinCuenta: "Este gafete no está ligado a tu cuenta. Pídele a un administrador que lo ligue.",
  serieOtra: "Este no es el chip de tu gafete.",
};

/**
 * Dónde vive la identidad de ESTE teléfono (`{ dispositivoId, secreto }`).
 * NO se borra al cerrar sesión: es lo que deja volver a entrar con el gafete.
 */
export const LLAVE_TELEFONO = "morcast_gafete_telefono";
/** Marca local de "este teléfono ya pidió correo" (el servidor es el que manda). */
export const LLAVE_BLOQUEO = "morcast_gafete_bloqueado";

// Prefijos de los registros URI de NFC (NFC Forum, RTD URI). Los gafetes se
// graban con 0x04 ("https://"); los demás por si un chip se grabó distinto.
const PREFIJOS_URI = { 0: "", 1: "http://www.", 2: "https://www.", 3: "http://", 4: "https://" };
const FORMA_CODIGO = /^[2-9A-HJKMNP-Z]{10}$/;

function textoUri(registro) {
  const tipo = Array.isArray(registro?.type) ? registro.type : [];
  if (registro?.tnf !== 1 || tipo.length !== 1 || tipo[0] !== 0x55) return null;
  const bytes = Array.isArray(registro.payload) ? registro.payload : [];
  if (!bytes.length || !(bytes[0] in PREFIJOS_URI)) return null;
  // El enlace del gafete es ASCII puro: byte por byte basta (Hermes no
  // garantiza TextDecoder) y un byte fuera de ASCII hace que no sea gafete.
  const resto = bytes.slice(1);
  if (resto.some((b) => typeof b !== "number" || b < 0x20 || b > 0x7e)) return null;
  return PREFIJOS_URI[bytes[0]] + String.fromCharCode(...resto);
}

/** Mismo criterio que `codigoDeEnlace` de la web: solo morcast.mx/g/<código>. */
function codigoDe(url) {
  const m = String(url || "").trim().match(/^(?:https?:\/\/)?(?:www\.)?morcast\.mx\/g\/([^/?#\s]+)\/?(?:[?#].*)?$/i);
  if (!m) return null;
  const c = m[1].toUpperCase().replace(/[\s-]/g, "");
  return FORMA_CODIGO.test(c) ? c : null;
}

/** La serie del chip ("04:a1:…") → "04A1…", o null. Igual que en la web. */
export function normalizarSerie(texto) {
  if (texto == null) return null;
  const limpio = String(texto).toUpperCase().replace(/[\s:-]/g, "");
  return /^[0-9A-F]{8,20}$/.test(limpio) ? limpio : null;
}

/** De lo que entrega `NfcManager.getTag()`: `{ codigo, serie }`, o null si no es un gafete. */
export function datosDelTag(tag) {
  for (const registro of tag?.ndefMessage || []) {
    const codigo = codigoDe(textoUri(registro));
    if (codigo) return { codigo, serie: normalizarSerie(tag.id) };
  }
  return null;
}

/** Qué enseña la pantalla de inicio: "oculta" | "enciende" | "usaCorreo" | "lista". */
export function opcionGafete({ hayNfc, nfcEncendido, bloqueadoLocal } = {}) {
  if (!hayNfc) return "oculta";
  if (!nfcEncendido) return "enciende";
  if (bloqueadoLocal) return "usaCorreo";
  return "lista";
}

/** 32 bytes al azar → base64url sin relleno (43 caracteres). */
export function nuevoSecreto(bytes) {
  const tabla = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let bits = 0;
  let valor = 0;
  let salida = "";
  for (const b of bytes) {
    valor = (valor << 8) | b;
    bits += 8;
    while (bits >= 6) {
      bits -= 6;
      salida += tabla[(valor >> bits) & 63];
    }
  }
  if (bits > 0) salida += tabla[(valor << (6 - bits)) & 63];
  return salida;
}
