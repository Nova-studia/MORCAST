import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sectorDePunto,
  sectoresQueContienen,
  cambiosDeSector,
  agruparCambios,
  conteoPorSector,
  estadoUbicacion,
  filtrarPuntos,
  leerCoordenadas,
  dentroDeMatamoros,
  clavesDeSectores,
  ordenarSectores,
} from "../lib/sectores.mjs";

// Dos cuadros vecinos sobre Matamoros, más uno (C) que se encima con A.
const CUADRO_A = [[25.90, -97.52], [25.90, -97.48], [25.86, -97.48], [25.86, -97.52]];
const CUADRO_B = [[25.90, -97.48], [25.90, -97.44], [25.86, -97.44], [25.86, -97.48]];
const CUADRO_C = [[25.89, -97.51], [25.89, -97.47], [25.87, -97.47], [25.87, -97.51]];

// Llegan DESORDENADOS a propósito: la regla no puede depender del orden.
const SECTORES = [
  { id: "s-c", clave: "C", zona: CUADRO_C, activo: true },
  { id: "s-b", clave: "B", zona: CUADRO_B, activo: true },
  { id: "s-a", clave: "A", zona: CUADRO_A, activo: true },
  { id: "s-d", clave: "D", zona: [], activo: true },
];

test("un punto dentro de un sector cae en ese sector", () => {
  assert.equal(sectorDePunto({ lat: 25.88, lng: -97.46 }, SECTORES)?.clave, "B");
});

test("un punto fuera de todos no cae en ninguno", () => {
  assert.equal(sectorDePunto({ lat: 25.80, lng: -97.60 }, SECTORES), null);
});

test("si cae en dos sectores se queda con el primero por clave (A antes que C)", () => {
  const p = { lat: 25.88, lng: -97.50 };
  assert.deepEqual(sectoresQueContienen(p, SECTORES).map((s) => s.clave), ["A", "C"]);
  assert.equal(sectorDePunto(p, SECTORES)?.clave, "A");
});

test("sin ubicación no hay sector, y un sector sin polígono o inactivo no cuenta", () => {
  assert.equal(sectorDePunto({ lat: null, lng: null }, SECTORES), null);
  const inactivo = [{ id: "x", clave: "A", zona: CUADRO_A, activo: false }];
  assert.equal(sectorDePunto({ lat: 25.88, lng: -97.50 }, inactivo), null);
  assert.equal(sectorDePunto({ lat: 25.88, lng: -97.50 }, null), null);
});

test("ordenarSectores no altera el arreglo original", () => {
  const copia = [...SECTORES];
  assert.deepEqual(ordenarSectores(SECTORES).map((s) => s.clave), ["A", "B", "C", "D"]);
  assert.deepEqual(SECTORES, copia);
});

test("cambiosDeSector solo devuelve los puntos cuyo sector guardado está mal", () => {
  const puntos = [
    { id: "1", lat: 25.88, lng: -97.46, sectorId: "s-b" }, // ya bien
    { id: "2", lat: 25.88, lng: -97.46, sectorId: null },  // le falta
    { id: "3", lat: 25.80, lng: -97.60, sectorId: "s-a" }, // salió del sector
    { id: "4", lat: null, lng: null, sectorId: "s-a" },    // perdió el pin
    { id: "5", lat: null, lng: null, sectorId: null },     // sin nada, sin cambio
  ];
  assert.deepEqual(cambiosDeSector(puntos, SECTORES), [
    { id: "2", antes: null, despues: "s-b" },
    { id: "3", antes: "s-a", despues: null },
    { id: "4", antes: "s-a", despues: null },
  ]);
});

test("agruparCambios junta los puntos por sector destino", () => {
  const grupos = agruparCambios([
    { id: "1", despues: "s-a" },
    { id: "2", despues: null },
    { id: "3", despues: "s-a" },
  ]);
  assert.deepEqual(grupos, [
    { sectorId: "s-a", ids: ["1", "3"] },
    { sectorId: null, ids: ["2"] },
  ]);
});

test("conteoPorSector separa en sector, en ninguno, sin ubicación y encimados", () => {
  const c = conteoPorSector(
    [
      { lat: 25.88, lng: -97.50 }, // A (y C)
      { lat: 25.88, lng: -97.46 }, // B
      { lat: 25.80, lng: -97.60 }, // ninguno
      { lat: null, lng: null },
    ],
    SECTORES
  );
  assert.deepEqual(c, {
    porSector: { "s-c": 0, "s-b": 1, "s-a": 1, "s-d": 0 },
    ninguno: 1,
    sinUbicacion: 1,
    encimados: 1,
  });
});

test("estadoUbicacion distingue sin ubicación, chofer y oficina", () => {
  assert.equal(estadoUbicacion({}).id, "sin");
  assert.equal(estadoUbicacion({ lat: 25.8, lng: -97.5, origen: "chofer" }).id, "chofer");
  assert.equal(estadoUbicacion({ lat: 25.8, lng: -97.5, origen: "panel" }).id, "panel");
  // Coordenadas de la carga inicial, sin origen: las puso la oficina.
  assert.equal(estadoUbicacion({ lat: 25.8, lng: -97.5, origen: null }).id, "panel");
});

test("filtrarPuntos combina ubicación, sector y búsqueda sin acentos", () => {
  const puntos = [
    { id: "1", empresa: "Vidriera Matamoros", alias: "Planta", colonia: "Industrial", lat: 25.8, lng: -97.5, sectorId: "s-a" },
    { id: "2", empresa: "Ferretera del Golfo", alias: "Bodega", colonia: "Jardín", sectorId: null },
    { id: "3", empresa: "Maquilas TechNorte", alias: "Nave 2", calle: "Av. Uniones", lat: 25.8, lng: -97.5, origen: "chofer", sectorId: null },
  ];
  assert.deepEqual(filtrarPuntos(puntos, { ubicacion: "sin" }).map((p) => p.id), ["2"]);
  assert.deepEqual(filtrarPuntos(puntos, { sector: "s-a" }).map((p) => p.id), ["1"]);
  assert.deepEqual(filtrarPuntos(puntos, { sector: "ninguno" }).map((p) => p.id), ["2", "3"]);
  assert.deepEqual(filtrarPuntos(puntos, { texto: "JARDIN" }).map((p) => p.id), ["2"]);
  assert.deepEqual(filtrarPuntos(puntos, { texto: "uniones", ubicacion: "chofer" }).map((p) => p.id), ["3"]);
  assert.equal(filtrarPuntos(puntos).length, 3);
});

test("leerCoordenadas entiende lo que copia Google Maps", () => {
  assert.deepEqual(leerCoordenadas("25.87123, -97.50311"), [25.87123, -97.50311]);
  assert.deepEqual(leerCoordenadas("25.87123,-97.50311"), [25.87123, -97.50311]);
  assert.deepEqual(
    leerCoordenadas("https://www.google.com/maps/@25.8712,-97.5031,17z"),
    [25.8712, -97.5031]
  );
});

test("leerCoordenadas rechaza texto, coordenadas al revés y lugares fuera de Matamoros", () => {
  assert.equal(leerCoordenadas("portón azul"), null);
  assert.equal(leerCoordenadas("-97.50311, 25.87123"), null);
  assert.equal(leerCoordenadas("19.4326, -99.1332"), null); // CDMX
  assert.equal(leerCoordenadas(null), null);
});

test("dentroDeMatamoros usa la misma caja que la base (db/023)", () => {
  assert.equal(dentroDeMatamoros(25.87, -97.50), true);
  assert.equal(dentroDeMatamoros(26.3, -97.50), false);
  assert.equal(dentroDeMatamoros("x", -97.50), false);
});

test("clavesDeSectores devuelve las letras del cliente sin repetir y en orden", () => {
  assert.deepEqual(
    clavesDeSectores(["s-c", "s-a", "s-c", null, "no-existe"], SECTORES).map((s) => s.clave),
    ["A", "C"]
  );
  assert.deepEqual(clavesDeSectores([], SECTORES), []);
});
