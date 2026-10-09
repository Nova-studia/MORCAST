/**
 * LA CONSULTA DE RECOLECCIONES DEL PANEL (Entrega 3, 9-oct-2026).
 *
 * Antes se traía TODO y PostgREST lo cortaba en silencio a las 1,000 filas.
 * Ahora se busca en la base: folio o empresa, un rango de fechas (por la
 * fecha efectiva: la confirmada si la hay) y páginas de 50 con el total.
 * Sin dependencias, con pruebas (tests/consulta-recolecciones.test.mjs).
 */
export const POR_PAGINA = 50;

const FECHA_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const valida = (f) => typeof f === "string" && FECHA_RE.test(f);

/** Desde hace 30 días y sin tope: lo pendiente y lo futuro siempre se ve. */
export function rangoPorOmision(hoy) {
  const [a, m, d] = hoy.split("-").map(Number);
  const f = new Date(Date.UTC(a, m - 1, d - 30));
  return { desde: f.toISOString().slice(0, 10), hasta: "" };
}

/** Sin comas, paréntesis, comodines ni puntos: rompen el filtro `or` de PostgREST. */
export function limpiarBusqueda(q) {
  return String(q ?? "")
    .replace(/[,()*%\.:"']/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

/** El `or` de fechas sobre la fecha efectiva, o null si no hay rango válido. */
export function filtroFechas({ desde, hasta } = {}) {
  const d = valida(desde) ? desde : null;
  const h = valida(hasta) ? hasta : null;
  if (!d && !h) return null;
  const por = (col) => [d && `${col}.gte.${d}`, h && `${col}.lte.${h}`].filter(Boolean).join(",");
  return `and(${por("fecha_confirmada")}),and(fecha_confirmada.is.null,${por("fecha_pedida")})`;
}

export function rangoPagina(pagina, porPagina = POR_PAGINA) {
  const p = Math.max(1, Number(pagina) || 1);
  return [(p - 1) * porPagina, p * porPagina - 1];
}

/** `q` ya limpia; `clienteIds` = las empresas cuyo nombre o folio coincide. */
export function filtroBusqueda(q, clienteIds = []) {
  if (!q) return null;
  const partes = [`folio.ilike.%${q}%`];
  if (clienteIds.length) partes.push(`cliente_id.in.(${clienteIds.join(",")})`);
  return partes.join(",");
}
