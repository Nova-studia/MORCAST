/**
 * EL NONCE DE GOOGLE IDENTITY SERVICES.
 *
 * Es la pieza que más se equivoca de toda la entrada con Google, y falla con un
 * mensaje inútil ("Passed nonce and nonce in id_token should either both exist
 * or not"), así que vive aparte y con prueba propia.
 *
 * LA REGLA, QUE ES CONTRAINTUITIVA:
 *   · A Google se le manda el nonce **cifrado** (SHA-256 en hexadecimal).
 *     Google lo copia tal cual dentro del token que devuelve.
 *   · A Supabase se le manda el nonce **crudo**. Supabase lo cifra él mismo y
 *     compara con lo que trae el token.
 *
 * Si se mandan al revés, o el mismo a los dos, la comparación falla y no entra
 * nadie. Por eso `nonceParaGoogle()` devuelve LOS DOS valores juntos: así no
 * hay forma de coger uno sin el otro.
 *
 * Va en .mjs para poder probarlo con `node --test`, igual que
 * `destino-sesion.mjs` y `punto-en-zona.mjs`.
 */

/** Texto aleatorio en hexadecimal. 32 bytes = 256 bits. */
export function nonceCrudo(bytes = 32) {
  const azar = new Uint8Array(bytes);
  crypto.getRandomValues(azar);
  return Array.from(azar, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** SHA-256 en hexadecimal. `crypto.subtle` existe en el navegador y en node 18+. */
export async function cifrar(texto) {
  const datos = new TextEncoder().encode(texto);
  const resumen = await crypto.subtle.digest("SHA-256", datos);
  return Array.from(new Uint8Array(resumen), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * El par que hace falta para una entrada con Google.
 *
 * Devuelve `{ paraGoogle, paraSupabase }` con los nombres puestos a propósito:
 * el que lea el código en la pantalla no tiene que acordarse de cuál va cifrado.
 */
export async function nonceParaGoogle() {
  const crudo = nonceCrudo();
  return { paraGoogle: await cifrar(crudo), paraSupabase: crudo };
}
