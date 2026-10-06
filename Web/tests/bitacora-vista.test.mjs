import { test } from "node:test";
import assert from "node:assert/strict";
import {
  rangoDelDia, diaEnMatamoros, moverDia, fechaValida, nombreDelDia, diaPedido, resumenBitacora,
} from "../lib/bitacora-vista.mjs";

test("un día de invierno va de medianoche a medianoche de Matamoros (UTC-6)", () => {
  assert.deepEqual(rangoDelDia("2026-01-15"), {
    desde: "2026-01-15T06:00:00.000Z",
    hasta: "2026-01-16T06:00:00.000Z",
  });
});

test("un día de verano es UTC-5", () => {
  assert.deepEqual(rangoDelDia("2026-07-04"), {
    desde: "2026-07-04T05:00:00.000Z",
    hasta: "2026-07-05T05:00:00.000Z",
  });
});

test("los días del cambio de horario duran 23 y 25 horas", () => {
  // Matamoros sigue el horario de EE. UU.: 8-mar-2026 y 1-nov-2026.
  const primavera = rangoDelDia("2026-03-08");
  assert.equal(primavera.desde, "2026-03-08T06:00:00.000Z");
  assert.equal(primavera.hasta, "2026-03-09T05:00:00.000Z");
  const otono = rangoDelDia("2026-11-01");
  assert.equal(otono.desde, "2026-11-01T05:00:00.000Z");
  assert.equal(otono.hasta, "2026-11-02T06:00:00.000Z");
});

test("a las 7 de la tarde de Matamoros sigue siendo el mismo día (no el de UTC)", () => {
  const tarde = new Date("2026-10-07T00:30:00Z"); // 6-oct, 19:30 en Matamoros
  assert.equal(diaEnMatamoros(tarde), "2026-10-06");
  const r = rangoDelDia("2026-10-06");
  assert.ok(tarde.toISOString() >= r.desde && tarde.toISOString() < r.hasta);
});

test("fechas inválidas no dan rango", () => {
  assert.equal(rangoDelDia("2026-02-30"), null);
  assert.equal(rangoDelDia("hoy"), null);
  assert.equal(rangoDelDia(""), null);
  assert.equal(fechaValida("2026-02-28"), true);
});

test("moverDia cruza meses y años", () => {
  assert.equal(moverDia("2026-03-01", -1), "2026-02-28");
  assert.equal(moverDia("2026-12-31", 1), "2027-01-01");
});

test("nombre del día y día pedido", () => {
  assert.equal(nombreDelDia("2026-10-06", "2026-10-06"), "Hoy");
  assert.equal(nombreDelDia("2026-10-05", "2026-10-06"), "Ayer");
  assert.equal(nombreDelDia("2026-10-04", "2026-10-06"), "dom 4 oct 2026");
  assert.equal(diaPedido("2026-10-09", "2026-10-06"), "2026-10-06"); // futuro → hoy
  assert.equal(diaPedido("basura", "2026-10-06"), "2026-10-06");
  assert.equal(diaPedido("2026-09-30", "2026-10-06"), "2026-09-30");
});

test("el detalle se lee en palabras", () => {
  const r = resumenBitacora({ detalle: { folio: "DEP-1", monto: 1500, notas: "ok", origen: "app" } });
  assert.match(r, /^DEP-1 · \$1,500\.00 · «ok» · desde la app$/);
  assert.equal(resumenBitacora({ detalle: null }), "—");
});
