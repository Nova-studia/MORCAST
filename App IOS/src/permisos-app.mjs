import { puede } from "./web/permisos.mjs";

/**
 * QUÉ PANTALLAS DE ADMINISTRACIÓN VE CADA QUIEN (9-oct-2026, apps al 100%).
 *
 * Roles por sección (db/029, lib/permisos.mjs de la web): un admin solo ve
 * las pantallas de las secciones de su rol; el dueño, todas. El servidor y la
 * base deciden de verdad; esto evita botones que solo contestan "Tu rol no
 * incluye…". Igual en las dos apps.
 *
 * Una lista = basta con una de esas secciones.
 */
export const SECCION_DE_PANTALLA = {
  Solicitudes: "solicitudes",
  Saldos: "saldos",
  Clientes: "clientes",
  FichaCliente: "clientes",
  Servicios: "servicios",
  ReportesAdmin: "reportes",
  Usuarios: "usuarios",
  Roles: "usuarios",
  AvisosAdmin: "avisos",
  BitacoraAdmin: "bitacora",
  Recolecciones: "recolecciones",
  NuevaRecoleccion: "recolecciones",
  Incidentes: "incidentes",
  Altas: "altas",
  Puntos: ["rutas", "clientes"],
  Rutas: "rutas",
  ZonasPedidas: "zonas",
  Unidades: "unidades",
};

/** `yo` = { rol, permisos } de `mis-permisos`; null mientras no llega. */
export function puedeVer(yo, pantalla) {
  const s = SECCION_DE_PANTALLA[pantalla];
  if (!s) return true; // Panel, Más, Mi cuenta…
  if (!yo) return false;
  return [].concat(s).some((x) => puede(yo, x));
}

export const pantallasVisibles = (yo, lista) => lista.filter((p) => puedeVer(yo, p));
