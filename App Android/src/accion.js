import { postApp } from "./api-web";
import { postAdmin } from "./api-admin";

/**
 * LAS ACCIONES NUEVAS DE LA WEB, CON LA MISMA FORMA EN LAS DOS APPS
 * (9-oct-2026, apps al 100%). Van a `POST /api/app/accion/<nombre>` (ver
 * Web/lib/app-acciones-mapa.mjs). Las de administración llevan el pase del
 * segundo paso (postAdmin); las demás, solo el token de la sesión.
 * Responden `{ ok, motivo?, ... }`. Sin red, Android responde `red: true`;
 * aquí se agrega `sinRed` para que las pantallas nuevas pregunten lo mismo
 * en las dos apps.
 */
const conSinRed = (r) => (r && r.red && !r.sinRed ? { ...r, sinRed: true } : r);
export const accionAdmin = async (nombre, datos = {}) => conSinRed(await postAdmin(`accion/${nombre}`, datos));
export const accionApp = async (nombre, datos = {}) => conSinRed(await postApp(`accion/${nombre}`, datos));
