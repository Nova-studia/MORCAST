import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MOTIVO_CANCELADA, puedeCancelar, puedeReagendar, validarReagenda, motivoCancelacion, estadoParaMostrar,
} from "../lib/solicitud-cliente.mjs";

test("cancelar: solicitada o confirmada; nunca en ruta ni ya cerrada", () => {
  assert.equal(puedeCancelar("solicitada"), true);
  assert.equal(puedeCancelar("confirmada"), true);
  for (const e of ["en-ruta", "completada", "rechazada", "no-procedio"]) assert.equal(puedeCancelar(e), false, e);
});

test("reagendar: solo mientras sigue solicitada", () => {
  assert.equal(puedeReagendar("solicitada"), true);
  assert.equal(puedeReagendar("confirmada"), false);
});

test("la fecha nueva: de hoy a un año, válida y distinta", () => {
  const hoy = "2026-10-09";
  assert.equal(validarReagenda({ fecha: "2026-10-08", hoy }).ok, false);
  assert.equal(validarReagenda({ fecha: "2026-10-09", hoy }).ok, true);
  assert.equal(validarReagenda({ fecha: "2027-10-10", hoy }).ok, false);
  assert.equal(validarReagenda({ fecha: "2026-02-30", hoy }).ok, false);
  assert.equal(validarReagenda({ fecha: "2026-10-20", hoy, actual: "2026-10-20" }).ok, false);
});

test("el motivo de una cancelación del cliente se distingue de un rechazo de la oficina", () => {
  assert.equal(motivoCancelacion(""), MOTIVO_CANCELADA);
  assert.equal(motivoCancelacion("  ya no hay residuo "), `${MOTIVO_CANCELADA}: ya no hay residuo`);
  assert.equal(motivoCancelacion("x".repeat(500)).length <= MOTIVO_CANCELADA.length + 2 + 200, true);
  assert.equal(estadoParaMostrar({ estado: "rechazada", motivoRechazo: motivoCancelacion("x") }), "cancelada");
  assert.equal(estadoParaMostrar({ estado: "rechazada", motivo_rechazo: "Sin cupo" }), "rechazada");
  assert.equal(estadoParaMostrar({ estado: "confirmada" }), "confirmada");
});
