import { test } from "node:test";
import assert from "node:assert/strict";
import { IVA_FACTURA, leerMonto, validarConcepto, claveDe, precioVigente, cotizar, redondear } from "../lib/precios.mjs";

test("el IVA es 16 %", () => assert.equal(IVA_FACTURA, 0.16));

test("leerMonto acepta pesos escritos como la gente los escribe", () => {
  assert.deepEqual(leerMonto("$1,250.50"), { ok: true, valor: 1250.5 });
  assert.deepEqual(leerMonto(" 800 "), { ok: true, valor: 800 });
  assert.deepEqual(leerMonto("0"), { ok: true, valor: 0 });
});

test("leerMonto rechaza lo que no es un precio", () => {
  for (const malo of ["", "abc", "-5", "1.234", "1,2,3.4.5", "99999999999"]) {
    assert.equal(leerMonto(malo).ok, false, malo);
  }
});

test("validarConcepto limpia y arma la clave", () => {
  const r = validarConcepto({ nombre: "  Contenedor 3 m³ ", unidad: " por recolección ", modalidad: "por-recoleccion" });
  assert.equal(r.ok, true);
  assert.deepEqual(r.limpio, { clave: "contenedor-3-m3", nombre: "Contenedor 3 m³", unidad: "por recolección", modalidad: "por-recoleccion" });
  assert.equal(validarConcepto({ nombre: "X", unidad: "u", modalidad: "diaria" }).ok, false);
});

test("claveDe quita acentos y símbolos", () => {
  assert.equal(claveDe("Renta mensual de contenedor ñ"), "renta-mensual-de-contenedor-n");
});

const R = [
  { concepto_id: "c1", cliente_id: null, precio: 1000, quitado: false, vale_desde: "2026-10-01T00:00:00Z", creado: "2026-10-01T00:00:00Z" },
  { concepto_id: "c1", cliente_id: "A", precio: 800, quitado: false, vale_desde: "2026-10-02T00:00:00Z", creado: "2026-10-02T00:00:00Z" },
  { concepto_id: "c1", cliente_id: "A", precio: null, quitado: true, vale_desde: "2026-10-05T00:00:00Z", creado: "2026-10-05T00:00:00Z" },
  { concepto_id: "c1", cliente_id: null, precio: 1100, quitado: false, vale_desde: "2026-10-06T00:00:00Z", creado: "2026-10-06T00:00:00Z" },
];

test("precioVigente: especial, quitado y lista según la fecha", () => {
  assert.equal(precioVigente(R, { clienteId: "A", conceptoId: "c1", en: new Date("2026-10-03") }), 800);
  assert.equal(precioVigente(R, { clienteId: "A", conceptoId: "c1", en: new Date("2026-10-05T12:00Z") }), 1000);
  assert.equal(precioVigente(R, { clienteId: "A", conceptoId: "c1", en: new Date("2026-10-07") }), 1100);
  assert.equal(precioVigente(R, { clienteId: "B", conceptoId: "c1", en: new Date("2026-10-03") }), 1000);
  assert.equal(precioVigente(R, { clienteId: "B", conceptoId: "c9" }), null);
});

test("cotizar suma IVA solo si requiere factura", () => {
  const lineas = [
    { conceptoId: "c1", nombre: "Cont", unidad: "u", precio: 1000, cantidad: 2 },
    { conceptoId: "c2", nombre: "Renta", unidad: "mes", precio: 333.33, cantidad: 1 },
  ];
  const conFactura = cotizar(lineas, { requiereFactura: true });
  assert.equal(conFactura.subtotal, 2333.33);
  assert.equal(conFactura.iva, 373.33);
  assert.equal(conFactura.total, 2706.66);
  const sinFactura = cotizar(lineas, { requiereFactura: false });
  assert.equal(sinFactura.iva, 0);
  assert.equal(sinFactura.total, 2333.33);
});

test("cotizar no suma conceptos sin precio y los reporta", () => {
  const r = cotizar([{ conceptoId: "c3", nombre: "Tonelada", unidad: "t", precio: null, cantidad: 3 }], { requiereFactura: true });
  assert.equal(r.total, 0);
  assert.deepEqual(r.sinPrecio, ["Tonelada"]);
  assert.equal(r.lineas.length, 0);
});

test("redondear a centavos", () => {
  assert.equal(redondear(0.125), 0.13);
  assert.equal(redondear(373.3328), 373.33);
});

import { lineasDeCotizador } from "../lib/precios.mjs";
test("lineasDeCotizador cruza cantidades con el catálogo y deja fuera lo que vale 0", () => {
  const catalogo = [{ id: "c1", nombre: "A", unidad: "u", precio: 10 }, { id: "c2", nombre: "B", unidad: "u", precio: null }];
  assert.deepEqual(lineasDeCotizador(catalogo, { c1: 2, c2: 1, c9: 5 }), [
    { conceptoId: "c1", nombre: "A", unidad: "u", precio: 10, cantidad: 2 },
    { conceptoId: "c2", nombre: "B", unidad: "u", precio: null, cantidad: 1 },
  ]);
});
