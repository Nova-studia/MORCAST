import { puede } from "./web/permisos.mjs";

/**
 * HERRAMIENTAS DE ESCRITORIO: "ABRIR EN LA WEB" (apps al 100%, fase D).
 *
 * Hay pantallas que en un teléfono no caben (dibujar zonas, la tabla de
 * precios, los tickets del relleno). En vez de copiarlas a medias, la app
 * abre el panel web YA con la sesión iniciada: `puente-admin` devuelve un
 * enlace de un solo uso (2 minutos) a /admin/entrar, que entra y lleva a la
 * página pedida. Los destinos son la lista cerrada de la web
 * (DESTINOS_PANEL); cada botón sale solo si el rol tiene su sección.
 * Puro, con pruebas en tests/oficina-100.test.mjs.
 */
export const HERRAMIENTAS_WEB = [
  { id: "zonas", titulo: "Zonas y sectores", sub: "Dibujar zonas, sectores y pines", destino: "/admin/rutas", seccion: "rutas", icono: "map" },
  { id: "precios", titulo: "Precios", sub: "Lista y precios especiales por cliente", destino: "/admin/precios", seccion: "precios", icono: "dollar-sign" },
  { id: "empleo", titulo: "Trabaja con nosotros", sub: "Vacantes y currículums", destino: "/admin/empleo", seccion: "empleo", icono: "briefcase" },
  { id: "unidades", titulo: "Unidades (alta y edición)", sub: "Camiones, placas y documentos", destino: "/admin/unidades", seccion: "unidades", icono: "truck" },
  { id: "contenedores", titulo: "Contenedores", sub: "Inventario, QR y dónde está cada uno", destino: "/admin/contenedores", seccion: "contenedores", icono: "box" },
  { id: "viajes", titulo: "Peso real", sub: "Viajes al relleno y tickets de báscula", destino: "/admin/viajes", seccion: "recolecciones", icono: "bar-chart-2" },
  { id: "bitacora", titulo: "Bitácora completa", sub: "Búsqueda y filtros de todo el historial", destino: "/admin/bitacora", seccion: "bitacora", icono: "book-open" },
];

/** Las que puede abrir `yo` ({ rol, permisos }); nada mientras no se sepa. */
export const herramientasVisibles = (yo) => (yo ? HERRAMIENTAS_WEB.filter((h) => puede(yo, h.seccion)) : []);

/**
 * Qué hacer con la respuesta de `puente-admin`. Solo se abre un enlace
 * https: si no sale, se dice por qué (y si fue la señal) y NO se abre el
 * login de la web, que pediría otra vez correo, contraseña y código.
 */
export function resultadoPuenteAdmin(r) {
  if (r?.ok && typeof r.url === "string" && r.url.startsWith("https://")) return { abrir: r.url };
  if (r?.sinRed) return { sinRed: true, motivo: "Sin conexión. Revisa tu señal y vuelve a tocar el botón." };
  return { motivo: r && !r.ok && r.motivo ? r.motivo : "No se pudo abrir el panel web. Inténtalo otra vez." };
}
