import { postWeb } from "./api-web";
import { paseActual, olvidarPase } from "./pase-admin";

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
  const r = await postWeb(`/api/app/${String(nombre).replace(/^\/+/, "")}`, { ...(cuerpo || {}), pase }, opciones);
  await siPideSegundoPaso(r);
  return r;
}

/* equipo 1 (6-oct-2026): volver a pedir el código cuando el servidor lo pide.
 *
 * Si el pase ya no sirve (venció, se cerró la sesión en otro lado), el
 * servidor contesta `segundoPaso: true`. En vez de que cada pantalla sepa
 * qué hacer con eso, aquí se olvida el pase y se avisa a quien escuche: la
 * puerta de la administración (App.js) vuelve a enseñar la pantalla del
 * código. La pantalla que llamó solo enseña el motivo. */
const escuchasSegundoPaso = new Set();

/** `fn` se llama cuando el servidor pide el código otra vez. Devuelve cómo dejar de escuchar. */
export function alPedirSegundoPaso(fn) {
  escuchasSegundoPaso.add(fn);
  return () => escuchasSegundoPaso.delete(fn);
}

async function siPideSegundoPaso(r) {
  if (!r || r.segundoPaso !== true) return;
  try { await olvidarPase(); } catch { /* sin pase guardado igual se pide */ }
  for (const fn of escuchasSegundoPaso) {
    try { fn(); } catch { /* una pantalla que falla no detiene a las demás */ }
  }
}
