import { test } from "node:test";
import assert from "node:assert/strict";
import { sinCuentasDePrueba, idsDePrueba } from "../src/cuentas-prueba.js";

test("se quitan las filas de cuentas de revisión", () => {
  const filas = [{ id: 1, cliente: { es_prueba: false } }, { id: 2, cliente: { es_prueba: true } }, { id: 3, cliente: null }];
  assert.deepEqual(sinCuentasDePrueba(filas).map((f) => f.id), [1, 3]);
});

test("idsDePrueba arma el conjunto", () => {
  assert.deepEqual([...idsDePrueba([{ id: "a", es_prueba: true }, { id: "b", es_prueba: false }])], ["a"]);
});

import { sinPruebasEnConsulta } from "../src/cuentas-prueba.js";

test("sinPruebasEnConsulta agrega el filtro NOT IN con los ids de prueba", () => {
  const llamadas = [];
  const consulta = { not(...a) { llamadas.push(a); return this; } };
  const r = sinPruebasEnConsulta(consulta, new Set(["a", "b"]));
  assert.equal(r, consulta);
  assert.deepEqual(llamadas, [["cliente_id", "in", "(a,b)"]]);
});

test("sinPruebasEnConsulta no toca la consulta si no hay cuentas de prueba", () => {
  const llamadas = [];
  const consulta = { not(...a) { llamadas.push(a); return this; } };
  sinPruebasEnConsulta(consulta, new Set(), "cliente_id");
  assert.equal(llamadas.length, 0);
});

test("sinPruebasEnConsulta acepta otro nombre de columna", () => {
  const llamadas = [];
  const consulta = { not(...a) { llamadas.push(a); return this; } };
  sinPruebasEnConsulta(consulta, new Set(["x"]), "id");
  assert.deepEqual(llamadas, [["id", "in", "(x)"]]);
});

test("espejo de la web: mismas entradas, mismas salidas", async (t) => {
  let web;
  try { web = await import("../../Web/lib/cuentas-prueba.mjs"); } catch { t.skip("sin Web/ al lado"); return; }
  const app = await import("../src/cuentas-prueba.js");
  const filas = [{ id: 1, cliente: { es_prueba: true } }, { id: 2, cliente: { es_prueba: false } }];
  assert.deepEqual(app.sinCuentasDePrueba(filas), web.sinCuentasDePrueba(filas));
  const cl = [{ id: "a", es_prueba: true }, { id: "b" }];
  assert.deepEqual([...app.idsDePrueba(cl)], [...web.idsDePrueba(cl)]);
  const llamadas = [[], []];
  const q = (i) => ({ not(...x) { llamadas[i].push(x); return this; } });
  app.sinPruebasEnConsulta(q(0), new Set(["a"])); web.sinPruebasEnConsulta(q(1), new Set(["a"]));
  assert.deepEqual(llamadas[0], llamadas[1]);
});
