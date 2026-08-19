import { test } from "node:test";
import assert from "node:assert/strict";
import { puntoEnZona, rutasQueCubren } from "../lib/punto-en-zona.mjs";

// Cuadrado simple alrededor del centro de Matamoros.
const CUADRO = [
  [25.90, -97.52],
  [25.90, -97.48],
  [25.86, -97.48],
  [25.86, -97.52],
];

test("un punto adentro devuelve true", () => {
  assert.equal(puntoEnZona([25.88, -97.50], CUADRO), true);
});

test("un punto afuera devuelve false", () => {
  assert.equal(puntoEnZona([25.95, -97.50], CUADRO), false);
});

test("un poligono sin suficientes vertices devuelve false", () => {
  assert.equal(puntoEnZona([25.88, -97.50], [[25.9, -97.5]]), false);
});

test("una zona vacia o ausente no truena", () => {
  assert.equal(puntoEnZona([25.88, -97.50], []), false);
  assert.equal(puntoEnZona([25.88, -97.50], null), false);
});

test("rutasQueCubren solo devuelve rutas activas que contienen el punto", () => {
  const rutas = [
    { id: "A", activa: true, zona: CUADRO },
    { id: "B", activa: false, zona: CUADRO },
    { id: "C", activa: true, zona: [[26.1, -97.6], [26.1, -97.5], [26.0, -97.5], [26.0, -97.6]] },
  ];
  const encontradas = rutasQueCubren([25.88, -97.50], rutas);
  assert.deepEqual(encontradas.map((r) => r.id), ["A"]);
});

test("rutasQueCubren devuelve vacio cuando nada cubre", () => {
  assert.deepEqual(rutasQueCubren([0, 0], [{ id: "A", activa: true, zona: CUADRO }]), []);
});
