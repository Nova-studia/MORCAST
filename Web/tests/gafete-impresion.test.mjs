import { test } from "node:test";
import assert from "node:assert/strict";
import { encode } from "uqr";
import {
  TARJETA,
  SANGRIA,
  MARGEN,
  RANURA,
  LADO_QR,
  medidasDePagina,
  marcasDeCorte,
  fondoDeCara,
  guilloche,
  qrDeGafete,
  paginasDeImpresion,
} from "../lib/gafete-impresion.mjs";

test("la tarjeta es CR80 y la página le suma sangría y margen", () => {
  assert.deepEqual(TARJETA, { ancho: 54, alto: 85.6, radio: 3.18 });
  assert.equal(SANGRIA, 2);
  const p = medidasDePagina();
  assert.equal(p.ancho, 70);
  assert.equal(p.alto, 101.6);
  assert.deepEqual(p.tarjeta, { x: 8, y: 8, ancho: 54, alto: 85.6 });
  assert.deepEqual(p.sangria, { x: 6, y: 6, ancho: 58, alto: 89.6 });
  // La tarjeta queda centrada en la página.
  assert.equal(p.tarjeta.x * 2 + p.tarjeta.ancho, p.ancho);
  assert.equal(Math.round((p.tarjeta.y * 2 + p.tarjeta.alto) * 10) / 10, p.alto);
});

test("las marcas de corte: dos por esquina, sobre el corte y fuera de la sangría", () => {
  const { ancho, alto, tarjeta, sangria } = medidasDePagina();
  const marcas = marcasDeCorte();
  assert.equal(marcas.length, 8);
  const dentro = (x, y) => x > sangria.x && x < sangria.x + sangria.ancho && y > sangria.y && y < sangria.y + sangria.alto;
  for (const m of marcas) {
    const horizontal = m.y1 === m.y2;
    assert.ok(horizontal || m.x1 === m.x2, "cada marca es recta");
    if (horizontal) assert.ok([tarjeta.y, 93.6].includes(m.y1), `la horizontal va sobre el corte (${m.y1})`);
    else assert.ok([tarjeta.x, tarjeta.x + tarjeta.ancho].includes(m.x1), `la vertical va sobre el corte (${m.x1})`);
    for (const [x, y] of [[m.x1, m.y1], [m.x2, m.y2]]) {
      assert.ok(x >= 0 && x <= ancho && y >= 0 && y <= alto, "cabe en la página");
      assert.ok(!dentro(x, y), "no pisa la sangría");
    }
    assert.ok(Math.abs(m.x2 - m.x1) + Math.abs(m.y2 - m.y1) >= 4, "se alcanza a ver");
    // Dejan 1 mm de aire contra el fondo: no lo manchan si el corte se mueve.
    const cerca = horizontal ? Math.min(Math.abs(m.x2 - sangria.x), Math.abs(m.x1 - (sangria.x + sangria.ancho)))
      : Math.min(Math.abs(m.y2 - sangria.y), Math.abs(m.y1 - (sangria.y + sangria.alto)));
    assert.equal(cerca, 1);
  }
  assert.equal(MARGEN, 6);
});

const puntos = (texto) => texto.split(" ").map((p) => p.split(",").map(Number));

test("el fondo cubre toda la sangría y las franjas no se quiebran en el corte", () => {
  for (const cara of ["frente", "vuelta"]) {
    const { caja, franjas } = fondoDeCara(cara);
    assert.equal(caja, "-2 -2 58 89.6");
    const primera = puntos(franjas[0].puntos);
    const ultima = puntos(franjas.at(-1).puntos);
    assert.deepEqual(primera.slice(0, 2), [[-2, -2], [56, -2]], "arriba llega al borde de la sangría");
    assert.deepEqual(ultima.slice(2), [[56, 87.6], [-2, 87.6]], "abajo también");
    for (const f of franjas) {
      const [a0, a1, b1, b0] = puntos(f.puntos);
      assert.deepEqual([a0[0], a1[0], b1[0], b0[0]], [-2, 56, 56, -2], "de lado a lado de la sangría");
      assert.ok(b0[1] > a0[1] && b1[1] > a1[1], "con algo de alto");
    }
  }
  // La franja naranja del frente baja 6 mm en los 54 de la tarjeta; alargada
  // 2 mm a cada lado sigue la misma inclinación: pasa por (0, 25) y (54, 19).
  const [izq, der] = puntos(fondoDeCara("frente").franjas[1].puntos);
  const pendiente = (der[1] - izq[1]) / (der[0] - izq[0]);
  assert.ok(Math.abs(pendiente - -6 / 54) < 0.001);
  assert.ok(Math.abs(izq[1] + pendiente * 2 - 25) < 0.02, "en x = 0 pasa por 25");
  assert.ok(Math.abs(izq[1] + pendiente * 56 - 19) < 0.02, "en x = 54 pasa por 19");
});

test("las dos caras cierran igual abajo (el mismo remate)", () => {
  const abajo = (cara) => fondoDeCara(cara).franjas.slice(-2).map((f) => f.puntos);
  assert.deepEqual(abajo("frente"), abajo("vuelta"));
});

test("la ranura del cordón cae en la franja de arriba, lejos del texto", () => {
  // La franja teal del frente llega, en su punto más alto, a 19 mm.
  assert.ok(RANURA.arriba + RANURA.alto < 7.4, "termina antes de donde empieza el logo");
  assert.ok(RANURA.ancho < TARJETA.ancho / 2);
});

test("el guilloche es un trazo de ondas dentro de su zona", () => {
  const d = guilloche();
  assert.match(d, /^M-2\.00 /);
  const ys = [...d.matchAll(/[ML]-?[\d.]+ (-?[\d.]+)/g)].map((m) => Number(m[1]));
  assert.ok(ys.length > 5000, "son muchas líneas finas");
  assert.ok(Math.min(...ys) > 30 && Math.max(...ys) < 83, "no se sale de entre las franjas");
  assert.equal((d.match(/M/g) || []).length, 2 * 25, "dos familias de 25 ondas");
});

test("el QR lleva el enlace del gafete, en versión 3 y con corrección Q", () => {
  const qr = qrDeGafete("K7M2X9FDQ4");
  assert.equal(qr.enlace, "https://morcast.mx/g/K7M2X9FDQ4");
  assert.equal(qr.version, 3);
  assert.equal(qr.tam, 29);
  assert.equal(LADO_QR, 24);
  assert.ok(qr.modulo >= 0.8, `cada módulo mide ${qr.modulo} mm`);
  // El trazo es EXACTAMENTE la matriz del enlace: ni corrido ni volteado.
  const matriz = encode("https://morcast.mx/g/K7M2X9FDQ4", { ecc: "Q", border: 0 }).data;
  const dibujados = new Set([...qr.d.matchAll(/M(\d+) (\d+)h1v1h-1z/g)].map((m) => `${m[1]},${m[2]}`));
  let negros = 0;
  matriz.forEach((fila, y) => fila.forEach((negro, x) => {
    if (negro) negros++;
    assert.equal(dibujados.has(`${x},${y}`), Boolean(negro), `módulo ${x},${y}`);
  }));
  assert.equal(dibujados.size, negros);
  assert.equal(qrDeGafete("no es un código"), null);
});

test("cualquier código cabe en la misma versión del QR", () => {
  for (const codigo of ["2222222222", "ZZZZZZZZZZ", "ABCDEFGH23", "W9X8Y7Z6V5"]) assert.equal(qrDeGafete(codigo).version, 3);
});

test("las páginas: frente y vuelta de cada tarjeta, o todas las caras juntas", () => {
  const a = { codigo: "A" }, b = { codigo: "B" };
  assert.deepEqual(paginasDeImpresion([a, b]).map((p) => `${p.gafete.codigo}-${p.cara}`), ["A-frente", "A-vuelta", "B-frente", "B-vuelta"]);
  assert.deepEqual(paginasDeImpresion([a, b], "caras").map((p) => `${p.gafete.codigo}-${p.cara}`), ["A-frente", "B-frente", "A-vuelta", "B-vuelta"]);
  assert.deepEqual(paginasDeImpresion(null), []);
});
