import { postApp } from "./api-web";
import { paseActual, olvidarPase } from "./segundo-paso";
import { pedirSegundoPaso } from "./candado-admin";

/**
 * Acciones de ADMINISTRACIÓN contra morcast.mx/api/app/* (6-oct-2026).
 *
 * Igual que `postApp`, pero manda el `pase` del segundo paso: el servidor
 * (entrarAppAdmin, Web/lib/app-ruta.js) lo exige como el panel web. Si
 * responde `segundoPaso: true`, se olvida el pase y se pide el código otra
 * vez (candado-admin.js: App.js pone la pantalla del código encima del panel);
 * la pantalla solo tiene que decir "confirma el código y vuelve a intentarlo".
 *
 * `nombre` es la ruta SIN el prefijo, p. ej. "recolecciones/confirmar". La
 * firma es la misma en las dos apps.
 */
export async function postAdmin(nombre, cuerpo = {}, opciones) {
  const pase = await paseActual();
  const r = await postApp(String(nombre).replace(/^\/+/, ""), { ...(cuerpo || {}), pase }, opciones);
  if (r?.segundoPaso) {
    await olvidarPase();
    pedirSegundoPaso();
  }
  return r;
}

// El equipo 1 escuchaba aquí; quedó un solo avisador (candado-admin.js).
export { alPedirSegundoPaso } from "./candado-admin";
