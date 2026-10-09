import { test } from "node:test";
import assert from "node:assert/strict";
import { rangoPorOmision, limpiarBusqueda, filtroFechas, rangoPagina, filtroBusqueda, POR_PAGINA } from "../lib/consulta-recolecciones.mjs";

test("por omisión: desde hace 30 días, sin tope (lo futuro entra)", () => {
  assert.deepEqual(rangoPorOmision("2026-10-09"), { desde: "2026-09-09", hasta: "" });
});

test("la búsqueda se limpia de lo que rompe el filtro de PostgREST", () => {
  assert.equal(limpiarBusqueda("  Acme, S.A. (planta) * 100% "), "Acme SA planta 100");
  assert.equal(limpiarBusqueda("x".repeat(100)).length, 60);
  assert.equal(limpiarBusqueda(null), "");
});

test("fechas: por la fecha EFECTIVA (confirmada si hay, si no la pedida)", () => {
  assert.equal(
    filtroFechas({ desde: "2026-09-09", hasta: "" }),
    "and(fecha_confirmada.gte.2026-09-09),and(fecha_confirmada.is.null,fecha_pedida.gte.2026-09-09)"
  );
  assert.equal(
    filtroFechas({ desde: "2026-09-01", hasta: "2026-09-30" }),
    "and(fecha_confirmada.gte.2026-09-01,fecha_confirmada.lte.2026-09-30),and(fecha_confirmada.is.null,fecha_pedida.gte.2026-09-01,fecha_pedida.lte.2026-09-30)"
  );
  assert.equal(filtroFechas({ desde: "", hasta: "" }), null);
  assert.equal(filtroFechas({ desde: "2026-13-01", hasta: "" }), null, "fecha inválida no entra");
});

test("páginas de 50", () => {
  assert.equal(POR_PAGINA, 50);
  assert.deepEqual(rangoPagina(1), [0, 49]);
  assert.deepEqual(rangoPagina(3), [100, 149]);
  assert.deepEqual(rangoPagina(0), [0, 49]);
});

test("buscar por folio o por empresa (los ids de clientes que coinciden)", () => {
  assert.equal(filtroBusqueda("rec-2026", []), "folio.ilike.%rec-2026%");
  assert.equal(filtroBusqueda("acme", ["a1", "a2"]), "folio.ilike.%acme%,cliente_id.in.(a1,a2)");
  assert.equal(filtroBusqueda("", ["a1"]), null);
});
