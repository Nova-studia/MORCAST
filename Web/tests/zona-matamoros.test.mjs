import { test } from "node:test";
import assert from "node:assert/strict";
import { ZONA_MATAMOROS } from "../lib/zona-matamoros.mjs";
import { puntoEnZona } from "../lib/punto-en-zona.mjs";

const dentro = (p) => puntoEnZona(p, ZONA_MATAMOROS.zona);

test("el poligono es valido", () => {
  assert.ok(Array.isArray(ZONA_MATAMOROS.zona));
  assert.ok(ZONA_MATAMOROS.zona.length >= 3, "hacen falta al menos 3 vertices");
  for (const v of ZONA_MATAMOROS.zona) {
    assert.equal(v.length, 2, `vertice mal formado: ${JSON.stringify(v)}`);
    assert.ok(v[0] > 25 && v[0] < 26.5, `latitud fuera de Matamoros: ${v[0]}`);
    assert.ok(v[1] < -97 && v[1] > -98, `longitud fuera de Matamoros: ${v[1]}`);
  }
});

test("el centro de Matamoros esta cubierto", () => {
  // MATAMOROS_CENTRO de lib/rutas-datos.js
  assert.equal(dentro([25.869, -97.5027]), true);
});

test("cubre lo que cubrian las 3 zonas que sustituye", () => {
  // Un punto de cada banda: norte, centro e industrial.
  assert.equal(dentro([25.90, -97.55]), true, "banda norte");
  assert.equal(dentro([25.86, -97.50]), true, "banda centro");
  assert.equal(dentro([25.82, -97.45]), true, "banda industrial");
});

test("Reynosa NO esta cubierta", () => {
  // A 100 km. Si esto pasa, el verificador le dice "si te cubrimos" a
  // media frontera y Morcast recibe prospectos a los que no puede servir.
  assert.equal(dentro([26.0508, -98.2878]), false);
});

test("el Golfo NO esta cubierto", () => {
  assert.equal(dentro([25.87, -97.15]), false);
});
