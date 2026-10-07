import { test } from "node:test";
import assert from "node:assert/strict";
import { respuestaPrecios } from "../lib/precios-app.mjs";

const conceptos = [{ id: "c1", clave: "a", nombre: "A", unidad: "u", modalidad: "mensual" }, { id: "c2", clave: "b", nombre: "B", unidad: "u", modalidad: "semanal" }];
const renglones = [
  { concepto_id: "c1", cliente_id: null, precio: 100, quitado: false, vale_desde: "2026-01-01", creado: "2026-01-01" },
  { concepto_id: "c1", cliente_id: "A", precio: 80, quitado: false, vale_desde: "2026-01-02", creado: "2026-01-02" },
];

test("cliente con factura: especial + IVA; concepto sin precio en null", () => {
  const r = respuestaPrecios({ hold: false, requiereFactura: true, conceptos, renglones, clienteId: "A" });
  assert.equal(r.iva, 0.16);
  assert.deepEqual(r.conceptos[0], { clave: "a", nombre: "A", unidad: "u", modalidad: "mensual", precio: 80, precioConIva: 92.8, especial: true });
  assert.equal(r.conceptos[1].precio, null);
  assert.equal(r.conceptos[1].precioConIva, null);
});

test("cliente sin factura: precioConIva = precio", () => {
  const r = respuestaPrecios({ hold: false, requiereFactura: false, conceptos, renglones, clienteId: "B" });
  assert.equal(r.conceptos[0].precio, 100);
  assert.equal(r.conceptos[0].precioConIva, 100);
  assert.equal(r.conceptos[0].especial, false);
});

test("con Hold no sale ningún precio", () => {
  const r = respuestaPrecios({ hold: true, requiereFactura: true, conceptos, renglones, clienteId: "A" });
  assert.equal(r.hold, true);
  assert.ok(r.conceptos.every((k) => k.precio === null && k.precioConIva === null));
});
