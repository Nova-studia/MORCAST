// Paridad cliente/chofer (6-oct-2026): sello de ubicación de la evidencia,
// fechas de la recolección extra y el chofer correcto en el historial.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  lecturaParaGuardar, esConfiable, mejorLectura, selloFoto, textoUbicacionServicio,
  ubicacionParaGuardar, evidenciaDeParada, horaCorta, PRECISION_ACEPTABLE_M,
} from "../src/evidencia.js";
import {
  aISO, deISO, sumarDias, limitesExtra, fechaEnRango, revisarFechaExtra, semanasDelMes, fechaConDia,
} from "../src/calendario.js";
import { mezclarChoferes, elegirChofer } from "../src/chofer-servicio.js";

const aqui = dirname(fileURLToPath(import.meta.url));

/* ---------------- Sello de ubicación ---------------- */

test("la lectura se guarda con la forma de la web", () => {
  const l = lecturaParaGuardar({ coords: { latitude: 25.86930049, longitude: -97.50231234, accuracy: 12.6 }, timestamp: Date.UTC(2026, 9, 6, 15) });
  assert.deepEqual(l, { lat: 25.8693, lng: -97.502312, precision_m: 13, capturada: "2026-10-06T15:00:00.000Z" });
  assert.equal(lecturaParaGuardar(null), null);
  assert.equal(lecturaParaGuardar({ coords: { latitude: NaN, longitude: 1 } }), null);
  assert.equal(lecturaParaGuardar({ coords: { latitude: 200, longitude: 1 } }), null);
  // Ya armada (la del estado de la pantalla) pasa igual.
  assert.equal(lecturaParaGuardar(l).lat, 25.8693);
});

test("confiable hasta 100 m, como la web", () => {
  assert.equal(PRECISION_ACEPTABLE_M, 100);
  assert.equal(esConfiable({ lat: 1, lng: 1, precision_m: 100 }), true);
  assert.equal(esConfiable({ lat: 1, lng: 1, precision_m: 101 }), false);
  assert.equal(esConfiable({ lat: 1, lng: 1, precision_m: null }), false);
  assert.equal(esConfiable(null), false);
});

test("se queda la mejor lectura, pero una vieja no vale por buena", () => {
  const ahora = Date.parse("2026-10-06T15:10:00Z");
  const buena = { lat: 1, lng: 1, precision_m: 8, capturada: "2026-10-06T15:09:30Z" };
  const floja = { lat: 1, lng: 1, precision_m: 300, capturada: "2026-10-06T15:09:59Z" };
  assert.equal(mejorLectura(buena, floja, { ahora }), buena);
  assert.equal(mejorLectura(floja, buena, { ahora }), buena);
  const vieja = { ...buena, capturada: "2026-10-06T15:00:00Z" };
  assert.equal(mejorLectura(vieja, floja, { ahora }), floja);
  assert.equal(mejorLectura(null, floja), floja);
  assert.equal(mejorLectura(buena, null), buena);
});

test("el sello de cada foto dice las tres cosas", () => {
  assert.deepEqual(selloFoto({ lat: 1, lng: 1, precision_m: 9 }), { estado: "ok", texto: "±9 m" });
  assert.deepEqual(selloFoto({ lat: 1, lng: 1, precision_m: 340 }), { estado: "debil", texto: "Señal débil · ±340 m" });
  assert.deepEqual(selloFoto(null), { estado: "sin", texto: "Sin ubicación" });
});

test("la ubicación del servicio: manda el después; 'Sin ubicación registrada' solo si falta", () => {
  const antes = { lat: 25.1, lng: -97.1, precision_m: 20 };
  const despues = { lat: 25.869301, lng: -97.502301, precision_m: 7 };
  assert.equal(textoUbicacionServicio({ antes, despues }), "25.869301, -97.502301 · ±7 m");
  assert.equal(textoUbicacionServicio({ antes, despues: null }), "25.100000, -97.100000 · ±20 m");
  assert.equal(textoUbicacionServicio({ antes: null, despues: { lat: 25, lng: -97, precision_m: 500 } }), "25.000000, -97.000000 · ±500 m (señal débil)");
  assert.equal(textoUbicacionServicio(null), "Sin ubicación registrada");
  assert.equal(textoUbicacionServicio({ antes: null, despues: null }), "Sin ubicación registrada");
});

test("lo que va a la columna: null si no hay ninguna, no {}", () => {
  assert.equal(ubicacionParaGuardar(null, null), null);
  const r = ubicacionParaGuardar(null, { lat: 25.5, lng: -97.5, precision_m: 10, capturada: "2026-10-06T15:00:00.000Z" });
  assert.deepEqual(r, { antes: null, despues: { lat: 25.5, lng: -97.5, precision_m: 10, capturada: "2026-10-06T15:00:00.000Z" } });
});

test("la parada completada trae las RUTAS de sus fotos (antes no traía ninguna)", () => {
  assert.equal(evidenciaDeParada(null), null);
  const ev = evidenciaDeParada({
    id: "r1", qr: "MOR-C-0421", peso_kg: 1240,
    foto_antes: "sol-1/antes-1.jpg", foto_despues: "sol-1/despues-2.jpg",
    hora_antes: null, hora_despues: null, ubicacion: { antes: null, despues: { lat: 1, lng: 1, precision_m: 5 } },
  });
  assert.equal(ev.rutaAntes, "sol-1/antes-1.jpg");
  assert.equal(ev.rutaDespues, "sol-1/despues-2.jpg");
  assert.equal(ev.peso, "1240 kg");
  assert.equal(ev.antes, null);
  assert.equal(ev.ubicacion.despues.precision_m, 5);
  assert.equal(horaCorta("no es fecha"), "—");
  assert.match(horaCorta("2026-10-06T15:04:00Z"), /^\d{2}:\d{2}$/);
});

/* ---------------- Recolección extra ---------------- */

test("la extra va de hoy a 365 días (lo que acepta la base)", () => {
  assert.deepEqual(limitesExtra("2026-10-06"), { min: "2026-10-06", max: "2027-10-06" });
  // Año bisiesto: 365 días, no "un año" (la base lo rechazaría).
  assert.deepEqual(limitesExtra("2027-03-01"), { min: "2027-03-01", max: "2028-02-29" });
  assert.equal(revisarFechaExtra("2026-10-06", "2026-10-06"), null);
  assert.equal(revisarFechaExtra("2026-10-05", "2026-10-06"), "Elige un día de hoy en adelante.");
  assert.equal(revisarFechaExtra("2027-10-07", "2026-10-06"), "Solo se puede agendar hasta un año adelante.");
  assert.equal(revisarFechaExtra("", "2026-10-06"), "Elige el día de tu recolección.");
  assert.equal(revisarFechaExtra("2026-02-31", "2026-01-01"), "Esa fecha no existe.");
  assert.equal(fechaEnRango("2026-12-24", limitesExtra("2026-10-06")), true);
});

test("cuentas de calendario sin pasar por UTC", () => {
  assert.equal(aISO(new Date(2026, 9, 6, 23, 30)), "2026-10-06");
  assert.equal(deISO("2026-13-01"), null);
  assert.equal(sumarDias("2026-12-31", 1), "2027-01-01");
  assert.equal(fechaConDia("2026-10-07"), "miércoles 7 de octubre");
  const oct = semanasDelMes(2026, 9);
  assert.equal(oct[0].filter(Boolean)[0], "2026-10-01");
  assert.ok(oct.every((s) => s.length === 7));
  assert.equal(oct.flat().filter(Boolean).length, 31);
});

/* ---------------- El chofer del historial ---------------- */

test("el historial dice quién hizo la recolección, no el texto de la ruta", () => {
  const lista = [{ folio: "REC-1", estatus: "completado", operador: "Marco Antonio", evidencia: { despues: { firma: "Marco Antonio" } } }];
  const r = mezclarChoferes(lista, { "REC-1": elegirChofer({ estado: "completada", operador: "José Medina", textoRuta: "Marco Antonio" }) });
  assert.equal(r[0].operador, "José Medina");
  assert.equal(r[0].etiquetaOperador, "Chofer");
  assert.equal(r[0].evidencia.despues.firma, "José Medina");
  assert.equal(mezclarChoferes(lista, null)[0].operador, "—");
});

/* ---------------- Copias idénticas a la web y a la otra app ---------------- */

test("chofer-servicio es copia exacta de la web", (t) => {
  const web = join(aqui, "..", "..", "Web", "lib", "chofer-servicio.mjs");
  if (!existsSync(web)) return t.skip("no está la carpeta Web junto a la app");
  assert.equal(readFileSync(join(aqui, "..", "src", "chofer-servicio.js"), "utf8"), readFileSync(web, "utf8"));
});

test("evidencia y calendario son iguales en las dos apps", (t) => {
  const otra = join(aqui, "..", "..", "App IOS", "src");
  if (!existsSync(otra)) return t.skip("no está la otra app junto a esta");
  assert.equal(readFileSync(join(aqui, "..", "src", "evidencia.js"), "utf8"), readFileSync(join(otra, "evidencia.mjs"), "utf8"));
  assert.equal(readFileSync(join(aqui, "..", "src", "calendario.js"), "utf8"), readFileSync(join(otra, "calendario.mjs"), "utf8"));
});
