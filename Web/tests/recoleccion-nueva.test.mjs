import { test } from "node:test";
import assert from "node:assert/strict";
import { validarRecoleccionOficina } from "../lib/recoleccion-nueva.mjs";

const TIPOS = ["RSU", "Cartón", "Otro"];
const U = "11111111-1111-4111-8111-111111111111";
const D = "22222222-2222-4222-8222-222222222222";
const CH = "33333333-3333-4333-8333-333333333333";
const base = { clienteId: U, domicilioId: D, fecha: "2026-10-10", tipoResiduo: "RSU", nota: "", origen: "extra" };
const op = { hoy: "2026-10-09", tipos: TIPOS };

test("una recolección de la oficina válida, sin confirmar, nace 'solicitada'", () => {
  const r = validarRecoleccionOficina(base, op);
  assert.equal(r.ok, true);
  assert.equal(r.limpio.confirmar, false);
  assert.equal(r.limpio.origen, "extra");
});

test("pide cliente, punto, fecha válida y tipo de residuo del catálogo", () => {
  assert.equal(validarRecoleccionOficina({ ...base, clienteId: "" }, op).ok, false);
  assert.equal(validarRecoleccionOficina({ ...base, domicilioId: "" }, op).ok, false);
  assert.equal(validarRecoleccionOficina({ ...base, fecha: "2026-13-01" }, op).ok, false);
  assert.equal(validarRecoleccionOficina({ ...base, tipoResiduo: "Uranio" }, op).ok, false);
});

test("no más de un día atrás ni más de un año adelante", () => {
  assert.equal(validarRecoleccionOficina({ ...base, fecha: "2026-10-07" }, op).ok, false);
  assert.equal(validarRecoleccionOficina({ ...base, fecha: "2026-10-08" }, op).ok, true);
  assert.equal(validarRecoleccionOficina({ ...base, fecha: "2027-10-10" }, op).ok, false);
});

test("'Otro' exige decir qué es en la nota", () => {
  assert.equal(validarRecoleccionOficina({ ...base, tipoResiduo: "Otro" }, op).ok, false);
  assert.equal(validarRecoleccionOficina({ ...base, tipoResiduo: "Otro", nota: "Llantas" }, op).ok, true);
});

test("confirmarla ya: con hora opcional y chofer opcional", () => {
  const r = validarRecoleccionOficina({ ...base, confirmar: true, hora: "09:30", choferId: CH }, op);
  assert.deepEqual([r.ok, r.limpio.confirmar, r.limpio.hora, r.limpio.choferId], [true, true, "09:30", CH]);
  assert.equal(validarRecoleccionOficina({ ...base, confirmar: true, hora: "25:00" }, op).ok, false);
  assert.equal(validarRecoleccionOficina({ ...base, confirmar: true, choferId: "x" }, op).ok, false);
  const sin = validarRecoleccionOficina({ ...base, confirmar: true }, op);
  assert.deepEqual([sin.limpio.hora, sin.limpio.choferId], [null, null]);
});
