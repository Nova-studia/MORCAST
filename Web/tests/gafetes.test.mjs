import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALFABETO_CODIGO,
  LARGO_CODIGO,
  nuevoCodigo,
  normalizarCodigo,
  enlaceGafete,
  codigoDeEnlace,
} from "../lib/gafetes.mjs";

test("el alfabeto no trae los símbolos que se confunden", () => {
  for (const malo of "01OIL") assert.ok(!ALFABETO_CODIGO.includes(malo), `sobra ${malo}`);
  assert.equal(new Set(ALFABETO_CODIGO).size, ALFABETO_CODIGO.length);
});

test("un código nuevo tiene 10 símbolos del alfabeto y no se repite", () => {
  const vistos = new Set();
  for (let i = 0; i < 500; i++) {
    const c = nuevoCodigo();
    assert.equal(c.length, LARGO_CODIGO);
    assert.ok([...c].every((s) => ALFABETO_CODIGO.includes(s)), c);
    assert.equal(normalizarCodigo(c), c);
    vistos.add(c);
  }
  assert.equal(vistos.size, 500);
});

test("nuevoCodigo descarta los bytes que sesgarían el sorteo", () => {
  // 248 es el primer byte fuera del último múltiplo de 31: si se usara
  // `% 31` a secas daría "2" y los primeros símbolos saldrían de más.
  let vuelta = 0;
  const azar = (bytes) => bytes.fill(vuelta++ === 0 ? 248 : 0);
  assert.equal(nuevoCodigo(azar), "2".repeat(LARGO_CODIGO));
  assert.equal(vuelta, 2);
});

test("normalizarCodigo perdona cómo se teclea, no lo que se leyó mal", () => {
  assert.equal(normalizarCodigo("K7M2X9FDQ4"), "K7M2X9FDQ4");
  assert.equal(normalizarCodigo("  k7m2 x9fd-q4 "), "K7M2X9FDQ4");
  assert.equal(normalizarCodigo("K7M2X9FDQ"), null); // corto
  assert.equal(normalizarCodigo("K7M2X9FDQ44"), null); // largo
  assert.equal(normalizarCodigo("K7M2X9FDQ0"), null); // el cero no existe
  assert.equal(normalizarCodigo("K7M2X9FDQO"), null); // ni la O
  assert.equal(normalizarCodigo(""), null);
  assert.equal(normalizarCodigo(null), null);
});

test("el enlace del gafete es siempre el mismo para un código", () => {
  assert.equal(enlaceGafete("K7M2X9FDQ4"), "https://morcast.mx/g/K7M2X9FDQ4");
  assert.equal(enlaceGafete("k7m2x9fdq4"), "https://morcast.mx/g/K7M2X9FDQ4");
  assert.equal(enlaceGafete("nada"), null);
});

test("codigoDeEnlace lee el QR, lo impreso y el código solo", () => {
  assert.equal(codigoDeEnlace("https://morcast.mx/g/K7M2X9FDQ4"), "K7M2X9FDQ4");
  assert.equal(codigoDeEnlace("http://www.morcast.mx/g/k7m2x9fdq4/"), "K7M2X9FDQ4");
  assert.equal(codigoDeEnlace("morcast.mx/g/K7M2X9FDQ4"), "K7M2X9FDQ4");
  assert.equal(codigoDeEnlace("https://morcast.mx/g/K7M2X9FDQ4?x=1"), "K7M2X9FDQ4");
  assert.equal(codigoDeEnlace(" K7M2X9FDQ4 "), "K7M2X9FDQ4");
});

test("codigoDeEnlace no acepta enlaces que no son de un gafete", () => {
  assert.equal(codigoDeEnlace("https://ejemplo.com/g/K7M2X9FDQ4"), null);
  assert.equal(codigoDeEnlace("https://morcast.mx.ejemplo.com/g/K7M2X9FDQ4"), null);
  assert.equal(codigoDeEnlace("https://morcast.mx/empleo"), null);
  assert.equal(codigoDeEnlace("https://morcast.mx/g/K7M2X9FDQ4/otra"), null);
  assert.equal(codigoDeEnlace("https://morcast.mx/g/CORTO"), null);
  assert.equal(codigoDeEnlace("MOR-C-0421"), null); // el QR de un contenedor
  assert.equal(codigoDeEnlace(""), null);
});
