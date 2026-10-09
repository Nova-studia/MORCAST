import { postWeb } from "./api-web";
import { postAdmin } from "./api-admin";

/**
 * LAS ACCIONES NUEVAS DE LA WEB, CON LA MISMA FORMA EN LAS DOS APPS
 * (9-oct-2026, apps al 100%). Van a `POST /api/app/accion/<nombre>` (ver
 * Web/lib/app-acciones-mapa.mjs). Las de administración llevan el pase del
 * segundo paso (postAdmin); las demás, solo el token de la sesión.
 * Responden `{ ok, motivo?, ... }`; sin red: `{ ok:false, sinRed:true, motivo }`.
 */
export const accionAdmin = (nombre, datos = {}) => postAdmin(`accion/${nombre}`, datos);
export const accionApp = (nombre, datos = {}) => postWeb(`/api/app/accion/${nombre}`, datos);
