import { test } from "node:test";
import assert from "node:assert/strict";
import { HOLD, enHold } from "../lib/estado-sistema.js";

test("enHold refleja el interruptor", () => {
  assert.equal(enHold(), HOLD.activo === true);
});

// Un Hold encendido sin motivo es una trampa para el que lo encuentre
// dentro de tres meses: sabe que algo esta apagado y no por que.
test("el Hold nunca se enciende sin decir por que", () => {
  if (HOLD.activo) {
    assert.ok(HOLD.motivo && HOLD.motivo.trim().length > 20,
      "HOLD.activo es true pero HOLD.motivo esta vacio o es demasiado corto");
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(HOLD.desde),
      "HOLD.desde debe ser una fecha AAAA-MM-DD");
  }
});
