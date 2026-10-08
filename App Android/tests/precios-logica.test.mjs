import { test } from "node:test";
import assert from "node:assert/strict";
import { decidirHold, catalogoDe, cotizar, lineasDeCotizador, TEXTO_IVA, IVA_FACTURA } from "../src/precios-logica.js";

test("sin respuesta del servidor, manda el Hold local", () => {
  assert.equal(decidirHold({ respuesta: null, holdLocal: true, esMuestra: false }), true);
});
test("con respuesta, manda el servidor", () => {
  assert.equal(decidirHold({ respuesta: { hold: false }, holdLocal: true, esMuestra: false }), false);
  assert.equal(decidirHold({ respuesta: { hold: true }, holdLocal: false, esMuestra: false }), true);
});
test("la cuenta de revisión nunca está en Hold", () => {
  assert.equal(decidirHold({ respuesta: { hold: true }, holdLocal: true, esMuestra: true }), false);
});
test("catalogoDe usa el del servidor; la muestra usa el suyo; sin datos, vacío", () => {
  const respuesta = { requiereFactura: false, conceptos: [{ clave: "a", nombre: "A", unidad: "u", precio: 10 }] };
  assert.deepEqual(catalogoDe({ respuesta, esMuestra: false, catalogoMuestra: [] }),
    { requiereFactura: false, conceptos: [{ id: "a", nombre: "A", unidad: "u", precio: 10 }] });
  const muestra = catalogoDe({ respuesta: null, esMuestra: true, catalogoMuestra: [{ id: "x", servicio: "X", unidad: "u", precio: 5 }] });
  assert.equal(muestra.requiereFactura, true);
  assert.deepEqual(muestra.conceptos, [{ id: "x", nombre: "X", unidad: "u", precio: 5 }]);
  assert.deepEqual(catalogoDe({ respuesta: null, esMuestra: false, catalogoMuestra: [] }), { conceptos: [], requiereFactura: false });
});
test("cotizar: IVA solo con factura y los sin precio no suman", () => {
  const cat = [{ id: "a", nombre: "A", unidad: "u", precio: 100 }, { id: "b", nombre: "B", unidad: "u", precio: null }];
  const r = cotizar(lineasDeCotizador(cat, { a: 2, b: 1 }), { requiereFactura: true });
  assert.equal(r.subtotal, 200); assert.equal(r.iva, 32); assert.equal(r.total, 232);
  assert.deepEqual(r.sinPrecio, ["B"]);
  assert.equal(cotizar(lineasDeCotizador(cat, { a: 1 }), { requiereFactura: false }).iva, 0);
});
test("espejo de la web: IVA, texto de condiciones y cotizar dan lo mismo", async (t) => {
  let web;
  try { web = await import("../../Web/lib/precios.mjs"); } catch { t.skip("sin Web/ al lado"); return; }
  assert.equal(IVA_FACTURA, web.IVA_FACTURA);
  const lineas = [{ conceptoId: "a", nombre: "A", unidad: "u", precio: 333.33, cantidad: 3 }];
  assert.deepEqual(cotizar(lineas, { requiereFactura: true }), web.cotizar(lineas, { requiereFactura: true }));
  const { CONDICIONES_COMERCIALES } = await import("../../Web/lib/cotizacion-datos.js");
  assert.ok(CONDICIONES_COMERCIALES.lista.includes(TEXTO_IVA));
});
