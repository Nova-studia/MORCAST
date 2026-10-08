/**
 * PUENTE DE SESIÓN APP → WEB (8-oct-2026, Apple guía 4).
 *
 * Quien entró con Apple (o Google) en la app termina su alta en la web SIN
 * volver a iniciar sesión ni dar nombre, correo o contraseña: la app pide un
 * enlace de un solo uso para el correo de SU token, y /portal/entrar lo canjea.
 */
export const DESTINOS_PUENTE = ["registro", "portal"];

export function destinoPuente(a) {
  return DESTINOS_PUENTE.includes(a) ? a : "registro";
}

export function urlPuente({ sitio, hashedToken, destino }) {
  return `${String(sitio).replace(/\/+$/, "")}/portal/entrar?th=${encodeURIComponent(hashedToken)}&a=${destinoPuente(destino)}`;
}

/** El personal tiene su panel; el puente es para clientes y cuentas sin alta. */
export function puedeUsarPuente(rol) {
  return rol == null || rol === "pendiente" || rol === "cliente";
}
