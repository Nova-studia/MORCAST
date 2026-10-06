import { postWeb } from "./api-web";
import { paseActual } from "./pase-admin";

/**
 * Acciones de ADMINISTRACIÓN contra morcast.mx/api/app/* (6-oct-2026).
 *
 * Igual que `postWeb`, pero manda el `pase` del segundo paso: el servidor
 * (entrarAppAdmin, Web/lib/app-ruta.js) lo exige como el panel web. Si
 * responde `segundoPaso: true`, la pantalla debe pedir el código otra vez.
 *
 * `nombre` es la ruta SIN el prefijo, p. ej. "recolecciones/confirmar". La
 * firma es la misma en las dos apps.
 */
export async function postAdmin(nombre, cuerpo = {}, opciones) {
  const pase = await paseActual();
  return postWeb(`/api/app/${String(nombre).replace(/^\/+/, "")}`, { ...(cuerpo || {}), pase }, opciones);
}
