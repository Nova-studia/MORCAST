import { test } from "node:test";
import assert from "node:assert/strict";
import { tieneUbicacion, direccionDe, enlaceComoLlegar, enlaceVerEnMapa } from "../lib/mapas.mjs";

test("con coordenadas, el enlace lleva al pin exacto", () => {
  const url = enlaceComoLlegar({ lat: 25.8697, lng: -97.5027, calle: "Uniones" });
  assert.equal(url, "https://www.google.com/maps/dir/?api=1&destination=25.8697%2C-97.5027&travelmode=driving");
});

test("sin coordenadas, cae a la dirección completa de Matamoros", () => {
  const url = enlaceComoLlegar({ calle: "Av. Uniones #1700", colonia: "Zona Industrial", cp: "87316" });
  assert.match(url, /destination=Av\.%20Uniones%20%231700%2C%20Zona%20Industrial%2C%20C\.P\.%2087316%2C%20Matamoros%2C%20Tamaulipas/);
});

test("0,0 o texto no cuentan como ubicación", () => {
  assert.equal(tieneUbicacion({ lat: 0, lng: 0 }), false);
  assert.equal(tieneUbicacion({ lat: "x", lng: 1 }), false);
  assert.equal(tieneUbicacion({ lat: "25.8", lng: "-97.5" }), true);
  assert.equal(tieneUbicacion(null), false);
});

test("la dirección se arma sin huecos", () => {
  assert.equal(direccionDe({ calle: " Sexta ", colonia: "" }), "Sexta, Matamoros, Tamaulipas");
});

test("ver en mapa usa la búsqueda", () => {
  assert.match(enlaceVerEnMapa({ lat: 25.8, lng: -97.5 }), /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=25\.8%2C-97\.5$/);
});
