/**
 * EL MENSAJE QUE SE ENSEÑA EN EL LOGIN AL SACAR A ALGUIEN (9-oct-2026).
 *
 * Cuando la app cierra la sesión por su cuenta (la cuenta fue dada de baja,
 * o la sesión ya no vale en el servidor), quien llega al login tiene que
 * saber POR QUÉ; si no, cree que la app se descompuso. App.js lo deja aquí
 * y el login lo toma una sola vez al montarse.
 */
let pendiente = null;

export function dejarAvisoSalida(texto) {
  pendiente = texto || null;
}

/** Lo devuelve y lo borra: el mensaje sale una vez. */
export function tomarAvisoSalida() {
  const t = pendiente;
  pendiente = null;
  return t;
}
