import { pantallasVisibles } from "./permisos-app.mjs";

/**
 * LAS PESTAÑAS DE ABAJO DEL ADMIN SEGÚN SU ROL (apps al 100%, 9-oct-2026).
 * Panel y Más son de todo el personal; Solicitudes y Saldos, de quien tenga
 * esa sección. Antes una cajera veía "Solicitudes" y al tocarla solo leía
 * errores de permiso. Puro, con pruebas en tests/oficina-100.test.mjs.
 */
export const PESTANAS_ADMIN = ["Panel", "Solicitudes", "Saldos", "MasA"];

export const pestanasAdmin = (yo) => pantallasVisibles(yo, PESTANAS_ADMIN);
