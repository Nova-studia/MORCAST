import { test } from "node:test";
import assert from "node:assert/strict";
import { mfaPanelActivo, necesitaVerificar } from "../lib/mfa.mjs";

test("dueño y admin con solo contraseña tienen que verificar", () => {
  assert.equal(necesitaVerificar({ rol: "dueno", aal: "aal1" }), true);
  assert.equal(necesitaVerificar({ rol: "admin", aal: "aal1" }), true);
  assert.equal(necesitaVerificar({ rol: "admin", aal: null }), true);
});

test("con el segundo paso hecho, entran", () => {
  assert.equal(necesitaVerificar({ rol: "dueno", aal: "aal2" }), false);
  assert.equal(necesitaVerificar({ rol: "admin", aal: "aal2" }), false);
});

test("clientes y choferes no pasan por aquí", () => {
  for (const rol of ["cliente", "operador", "pendiente", null]) {
    assert.equal(necesitaVerificar({ rol, aal: "aal1" }), false, String(rol));
  }
});

test("solo se apaga escribiendo 'apagado' a propósito", () => {
  assert.equal(mfaPanelActivo({}), true);
  assert.equal(mfaPanelActivo({ MFA_PANEL: "" }), true);
  assert.equal(mfaPanelActivo({ MFA_PANEL: "encendido" }), true);
  assert.equal(mfaPanelActivo({ MFA_PANEL: " Apagado " }), false);
});
