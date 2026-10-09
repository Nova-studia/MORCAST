import {
  POR_PAGINA,
  rangoPorOmision,
  limpiarBusqueda,
  filtroFechas,
  rangoPagina,
} from "./web/consulta-recolecciones.mjs";

/**
 * RECOLECCIONES DE LA OFICINA EN LA BASE (apps al 100%, 9-oct-2026).
 *
 * Antes la app traía las últimas 500 y filtraba en el teléfono: lo de hace
 * meses no aparecía nunca y una búsqueda por folio fallaba en silencio. Ahora
 * se busca en la base como `buscarSolicitudesPanel` de la web (folio o
 * empresa, Desde/Hasta y páginas de 50). Las reglas son las de la web
 * (`src/web/consulta-recolecciones.mjs`); aquí solo se juntan. Puro, con
 * pruebas en tests/oficina-100.test.mjs.
 */

/**
 * Lo que necesita la consulta. Sin `desde` explícito, desde hace 30 días (lo
 * pendiente y lo futuro siempre entra); `desde: ""` a propósito = sin tope.
 */
export function consultaRecolecciones({ hoy, q = "", desde, hasta = "", estado = "", pagina = 1 } = {}) {
  const d = desde === undefined ? rangoPorOmision(hoy).desde : desde;
  return {
    texto: limpiarBusqueda(q),
    desde: d,
    hasta,
    estado,
    fechas: filtroFechas({ desde: d, hasta }),
    rango: rangoPagina(pagina),
  };
}

export const totalPaginas = (total, porPagina = POR_PAGINA) => Math.max(1, Math.ceil((Number(total) || 0) / porPagina));

/** "Página 2 de 3 · 120 recolecciones". */
export function textoPaginacion({ pagina = 1, total = 0 } = {}) {
  if (!total) return "Ninguna recolección";
  const cuantas = `${total} ${total === 1 ? "recolección" : "recolecciones"}`;
  const n = totalPaginas(total);
  return n > 1 ? `Página ${pagina} de ${n} · ${cuantas}` : cuantas;
}
