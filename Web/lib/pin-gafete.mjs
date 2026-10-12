/**
 * EL PIN DE EMERGENCIA DE UN GAFETE (sin React ni Supabase).
 *
 * Cada gafete lleva impreso atrás un PIN de 6 dígitos que abre la ficha de
 * emergencia en `morcast.mx/g/<código>` (tipo de sangre, alergias, a quién
 * llamar). Diseño: docs/superpowers/specs/2026-10-09-gafetes-personal-design.md.
 *
 * Se guarda CIFRADO y no como huella, a propósito: el panel tiene que poder
 * enseñarlo para reimprimir la tarjeta. La llave (`PERSONAL_PIN_LLAVE`) vive
 * solo en el servidor; quien leyera la tabla `gafetes` sin ella no saca
 * ningún PIN. Sin la variable no se emiten gafetes: mejor eso que cifrar con
 * una llave que mañana cambia y dejar inservibles los PIN ya impresos.
 *
 * Solo usa Web Crypto, para que `node --test` lo importe directo.
 */

export const LARGO_PIN = 6;
const FORMA_PIN = new RegExp(`^\\d{${LARGO_PIN}}$`);
const VERSION = "v1";
const codificador = new TextEncoder();

/** La llave del servidor, o null si falta o es demasiado corta para servir. */
export function llaveDelPin(entorno = process.env) {
  const llave = String(entorno.PERSONAL_PIN_LLAVE || "").trim();
  return llave.length >= 32 ? llave : null;
}

/**
 * Un PIN nuevo, al azar. `azar` llena un Uint8Array (por defecto, el del
 * sistema). Se descartan los bytes de 250 para arriba: con `byte % 10` a
 * secas, del 0 al 5 saldrían más seguido.
 */
export function nuevoPin(azar = (bytes) => globalThis.crypto.getRandomValues(bytes)) {
  let pin = "";
  while (pin.length < LARGO_PIN) {
    for (const b of azar(new Uint8Array(LARGO_PIN * 2))) {
      if (b < 250 && pin.length < LARGO_PIN) pin += String(b % 10);
    }
  }
  return pin;
}

/**
 * Lo que alguien tecleó → los 6 dígitos, o null. Perdona espacios y guiones
 * ("482 913"), que es como va impreso.
 */
export function normalizarPin(texto) {
  const limpio = String(texto ?? "").replace(/[\s-]/g, "");
  return FORMA_PIN.test(limpio) ? limpio : null;
}

/** Como se imprime y se enseña: en dos grupos de tres, "482 913". */
export function pinLegible(pin) {
  const p = normalizarPin(pin);
  return p ? `${p.slice(0, 3)} ${p.slice(3)}` : "";
}

const aBase64 = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const deBase64 = (texto) =>
  Uint8Array.from(atob(String(texto).replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function llaveAes(llave) {
  const huella = await globalThis.crypto.subtle.digest("SHA-256", codificador.encode(llave));
  return globalThis.crypto.subtle.importKey("raw", huella, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/**
 * Cifra el PIN (AES-256-GCM). Lleva amarrado el `codigo` del gafete: un
 * `pin_cifrado` copiado al renglón de otro gafete no se descifra.
 */
export async function cifrarPin(pin, codigo, llave) {
  const p = normalizarPin(pin);
  if (!p || !codigo || !llave) throw new Error("Falta el PIN, el código o la llave para cifrar.");
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const cifrado = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: codificador.encode(codigo) },
    await llaveAes(llave),
    codificador.encode(p)
  );
  return `${VERSION}.${aBase64(iv)}.${aBase64(new Uint8Array(cifrado))}`;
}

/** El PIN en claro, o null si no se pudo (otra llave, otro gafete, texto roto). */
export async function descifrarPin(cifrado, codigo, llave) {
  try {
    const [version, iv, cuerpo] = String(cifrado ?? "").split(".");
    if (version !== VERSION || !iv || !cuerpo || !codigo || !llave) return null;
    const claro = await globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: deBase64(iv), additionalData: codificador.encode(codigo) },
      await llaveAes(llave),
      deBase64(cuerpo)
    );
    return normalizarPin(new TextDecoder().decode(claro));
  } catch {
    return null;
  }
}

/**
 * ¿El PIN tecleado es el del gafete? Compara sin atajos: recorre los seis
 * dígitos siempre, para que el tiempo de respuesta no diga cuántos van bien.
 */
export async function pinCorrecto(tecleado, cifrado, codigo, llave) {
  const dado = normalizarPin(tecleado);
  const real = await descifrarPin(cifrado, codigo, llave);
  if (!dado || !real) return false;
  let distinto = 0;
  for (let i = 0; i < LARGO_PIN; i++) distinto |= dado.charCodeAt(i) ^ real.charCodeAt(i);
  return distinto === 0;
}
