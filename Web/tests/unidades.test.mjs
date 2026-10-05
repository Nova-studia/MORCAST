import { test } from "node:test";
import assert from "node:assert/strict";
import {
  estadoVencimiento,
  textoVencimiento,
  alertasDeFlota,
  validarUnidad,
  esFechaValida,
  diasHasta,
  etiquetaUnidad,
  sugerirUnidad,
  hoyLocal,
} from "../lib/unidades.mjs";

const HOY = "2026-10-05";

test("vencimiento: ya pasó, pronto, lejos y sin fecha", () => {
  assert.deepEqual(estadoVencimiento("2026-10-02", HOY), { nivel: "vencido", dias: -3 });
  assert.deepEqual(estadoVencimiento("2026-10-05", HOY), { nivel: "pronto", dias: 0 });
  assert.deepEqual(estadoVencimiento("2026-11-04", HOY), { nivel: "pronto", dias: 30 });
  assert.deepEqual(estadoVencimiento("2026-11-05", HOY), { nivel: "ok", dias: 31 });
  assert.deepEqual(estadoVencimiento(null, HOY), { nivel: "sin-fecha", dias: null });
  assert.deepEqual(estadoVencimiento("2026-02-30", HOY), { nivel: "sin-fecha", dias: null });
});

test("los días cruzan meses y años sin perder uno", () => {
  assert.equal(diasHasta("2027-01-01", "2026-12-31"), 1);
  assert.equal(diasHasta("2026-03-01", "2026-02-28"), 1);
  assert.equal(diasHasta("2026-11-02", "2026-10-31"), 2);
});

test("el aviso se dice en palabras", () => {
  assert.equal(textoVencimiento({ nivel: "vencido", dias: -1 }), "Venció ayer");
  assert.equal(textoVencimiento({ nivel: "vencido", dias: -3 }), "Venció hace 3 días");
  assert.equal(textoVencimiento({ nivel: "pronto", dias: 0 }), "Vence hoy");
  assert.equal(textoVencimiento({ nivel: "pronto", dias: 1 }), "Vence mañana");
  assert.equal(textoVencimiento({ nivel: "pronto", dias: 12 }), "Vence en 12 días");
  assert.equal(textoVencimiento({ nivel: "sin-fecha", dias: null }), "Sin fecha");
});

test("las alertas de la flota: la más urgente primero y sin las de baja", () => {
  const flota = [
    { id: "a", numero_economico: "U-01", estado: "activa", vence_seguro: "2026-10-20", vence_verificacion: "2027-06-01" },
    { id: "b", numero_economico: "U-02", estado: "taller", vence_seguro: "2026-09-30", vence_verificacion: "2026-10-06" },
    { id: "c", numero_economico: "U-03", estado: "baja", vence_seguro: "2020-01-01", vence_verificacion: null },
    { id: "d", numero_economico: "U-04", estado: "activa", vence_seguro: null, vence_verificacion: null },
  ];
  const al = alertasDeFlota(flota, HOY);
  assert.deepEqual(al.map((a) => `${a.numero} ${a.que} ${a.dias}`), [
    "U-02 Seguro -5",
    "U-02 Verificación 1",
    "U-01 Seguro 15",
  ]);
});

test("validar normaliza número y placas", () => {
  const v = validarUnidad({ numero_economico: " u-04 ", placas: "xy-12 345", tipo: "roll-off", anio: "2019", vence_seguro: "2027-01-31" }, HOY);
  assert.equal(v.ok, true);
  assert.equal(v.datos.numero_economico, "U-04");
  assert.equal(v.datos.placas, "XY12345");
  assert.equal(v.datos.anio, 2019);
  assert.equal(v.datos.estado, "activa");
  assert.equal(v.datos.vence_verificacion, null);
});

test("validar rechaza lo que la base rechazaría", () => {
  const v = validarUnidad({ numero_economico: "", tipo: "tractor", estado: "vendida", anio: "1975", vence_seguro: "31/01/2027", placas: "AB#1" }, HOY);
  assert.equal(v.ok, false);
  for (const campo of ["numero_economico", "tipo", "estado", "anio", "vence_seguro", "placas"]) {
    assert.ok(v.errores[campo], `falta el error de ${campo}`);
  }
  assert.equal(validarUnidad({ numero_economico: "U-1", anio: "2027" }, HOY).ok, true);
  assert.equal(validarUnidad({ numero_economico: "U-1", anio: "2028" }, HOY).ok, false);
});

test("fechas válidas", () => {
  assert.equal(esFechaValida("2028-02-29"), true);
  assert.equal(esFechaValida("2027-02-29"), false);
  assert.equal(esFechaValida("2027-1-5"), false);
  assert.match(hoyLocal(new Date(2026, 0, 9, 23, 30)), /^2026-01-09$/);
});

test("la etiqueta lleva el número primero", () => {
  assert.equal(etiquetaUnidad({ numero_economico: "U-04", marca_modelo: "International 4300", tipo: "roll-off" }), "U-04 · International 4300");
  assert.equal(etiquetaUnidad({ numero_economico: "U-05", tipo: "compactador" }), "U-05 · Compactador");
});

test("la sugerencia para el texto viejo solo sale si hay una candidata", () => {
  const flota = [
    { id: "1", numero_economico: "04", marca_modelo: "Roll Off International", tipo: "roll-off", estado: "activa" },
    { id: "2", numero_economico: "05", marca_modelo: "Roll Off Mack", tipo: "roll-off", estado: "activa" },
    { id: "3", numero_economico: "07", marca_modelo: "Freightliner M2", tipo: "compactador", estado: "activa" },
    { id: "4", numero_economico: "09", marca_modelo: "Chevrolet Kodiak", tipo: "manual", estado: "baja" },
  ];
  assert.equal(sugerirUnidad("Roll Off International", flota).id, "1");
  assert.equal(sugerirUnidad("Roll off 05", flota).id, "2");
  assert.equal(sugerirUnidad("Compactador", flota).id, "3");
  assert.equal(sugerirUnidad("Roll Off", flota), null);           // dos candidatas
  assert.equal(sugerirUnidad("Camión Chevrolet Kodiak", flota), null); // la única está de baja
  assert.equal(sugerirUnidad("", flota), null);
});
