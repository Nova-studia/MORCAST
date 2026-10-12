/**
 * GAFETES DE EMPLEADO — el código y su enlace (sin React ni Supabase).
 *
 * El QR y el chip NFC de un gafete no llevan datos: llevan un enlace,
 * `https://morcast.mx/g/<código>`. Aquí vive el formato de ese código, y es
 * la única definición: lo usan quien lo crea, quien graba el chip y la
 * página pública que lo recibe. Diseño completo en
 * docs/superpowers/specs/2026-10-09-gafetes-personal-design.md.
 *
 * Va en .mjs y sin dependencias para que `node --test` lo importe directo
 * (tests/gafetes.test.mjs).
 */

/**
 * Sin 0/O, 1/I/L: el código va impreso bajo el QR y alguien lo va a teclear
 * con la tarjeta en la mano. 31 símbolos a la 10 son ~8 × 10^14 códigos:
 * nadie los recorre uno por uno.
 */
export const ALFABETO_CODIGO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const LARGO_CODIGO = 10;

/** El dominio que va impreso y grabado. Con https y sin www, siempre igual. */
export const ORIGEN_GAFETE = "https://morcast.mx";

const FORMA = new RegExp(`^[${ALFABETO_CODIGO}]{${LARGO_CODIGO}}$`);

/**
 * Un código nuevo, al azar. `azar` llena un Uint8Array (por defecto, el del
 * sistema); se puede pasar otro para probar.
 */
export function nuevoCodigo(azar = (bytes) => globalThis.crypto.getRandomValues(bytes)) {
  // Se descartan los bytes que caen fuera del último múltiplo de 31: si se
  // usara `byte % 31` a secas, los primeros símbolos saldrían más seguido.
  const tope = 256 - (256 % ALFABETO_CODIGO.length);
  let codigo = "";
  while (codigo.length < LARGO_CODIGO) {
    const bytes = azar(new Uint8Array(LARGO_CODIGO * 2));
    for (const b of bytes) {
      if (b < tope && codigo.length < LARGO_CODIGO) codigo += ALFABETO_CODIGO[b % ALFABETO_CODIGO.length];
    }
  }
  return codigo;
}

/**
 * Lo que alguien tecleó → el código, o null si no tiene la forma. Perdona
 * minúsculas, espacios y guiones ("k7m2 x9fd-q4"), que es como se copia a
 * mano; no "corrige" un 0 por una O: un código mal leído no se adivina.
 */
export function normalizarCodigo(texto) {
  const limpio = String(texto ?? "").toUpperCase().replace(/[\s-]/g, "");
  return FORMA.test(limpio) ? limpio : null;
}

/** El enlace que se imprime en el QR y se graba en el chip. */
export function enlaceGafete(codigo) {
  const c = normalizarCodigo(codigo);
  return c ? `${ORIGEN_GAFETE}/g/${c}` : null;
}

/**
 * El código que trae un enlace de gafete, o null si el texto no es uno. Lee
 * lo que sale de un QR o de un chip ("https://morcast.mx/g/…"), lo que va
 * impreso ("morcast.mx/g/…") y el código solo. Un enlace a otro sitio, o a
 * otra página de morcast.mx, NO es un gafete.
 */
export function codigoDeEnlace(texto) {
  const t = String(texto ?? "").trim();
  const m = t.match(/^(?:https?:\/\/)?(?:www\.)?morcast\.mx\/g\/([^/?#\s]+)\/?(?:[?#].*)?$/i);
  return normalizarCodigo(m ? m[1] : t);
}
