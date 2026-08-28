/**
 * A DONDE VA CADA QUIEN AL ENTRAR.
 *
 * Vive aparte, sin dependencias y en .mjs a proposito: asi la puede importar
 * tanto Next (como `lib/punto-en-zona.mjs`, que ya se usa igual) como
 * `node --test`, sin navegador y sin base de datos. La regla se escribe una
 * vez y la consultan los dos lugares que la necesitan: `proxy.js` en cada
 * peticion, y `/auth/callback` al volver de Google.
 *
 * REGLA DE ORO: aqui NO se supone nada. Quien no trae un rol conocido en
 * `app_metadata` NO entra. `proxy.js` hacia `?? "cliente"` y eso bautizaba
 * cliente a cualquier recien llegado sin sello.
 */

export const DESTINOS = {
  admin: "/admin",
  chofer: "/chofer",
  portal: "/portal",
  registro: "/portal/registro",
  pendiente: "/portal/pendiente",
};

/**
 * El area a la que pertenece un rol. No necesita la base, para que el
 * guardia del servidor no tenga que consultar nada en cada peticion.
 */
export function casaDe(rol) {
  if (rol === "dueno" || rol === "admin") return DESTINOS.admin;
  if (rol === "operador") return DESTINOS.chofer;
  if (rol === "cliente") return DESTINOS.portal;
  return DESTINOS.pendiente;
}

/**
 * Igual que `casaDe`, pero para quien SI puede consultar la base: al que no
 * tiene sello lo manda a capturar sus datos si todavia no lo hizo.
 */
export function decidirDestino({ rol, tieneSolicitud = false } = {}) {
  const casa = casaDe(rol);
  if (casa !== DESTINOS.pendiente) return casa;
  return tieneSolicitud ? DESTINOS.pendiente : DESTINOS.registro;
}
