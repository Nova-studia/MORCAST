import { test } from "node:test";
import assert from "node:assert/strict";
import { validarDatosCliente, mensajeCambioFiscal, CONFIRMAR_ELIMINAR, confirmaEliminar } from "../lib/cuenta-cliente.mjs";

test("datos de la empresa: contacto, teléfono (10 dígitos) y correo de avisos", () => {
  const r = validarDatosCliente({ contacto: "  Ana  Ruiz ", telefono: "+52 (868) 123-4567", correo: " Ana@Empresa.MX " });
  assert.deepEqual(r, { ok: true, limpio: { contacto: "Ana Ruiz", telefono: "8681234567", correo: "ana@empresa.mx" } });
});

test("el correo de avisos es obligatorio y válido; el teléfono, de 10 dígitos o vacío", () => {
  assert.equal(validarDatosCliente({ contacto: "A", correo: "" }).ok, false);
  assert.equal(validarDatosCliente({ contacto: "A", correo: "no-es" }).ok, false);
  assert.equal(validarDatosCliente({ contacto: "A", correo: "a@b.mx", telefono: "123" }).ok, false);
  assert.equal(validarDatosCliente({ contacto: "A", correo: "a@b.mx", telefono: "" }).limpio.telefono, null);
  assert.equal(validarDatosCliente({ contacto: "x".repeat(121), correo: "a@b.mx" }).ok, false);
});

test("la razón social y el RFC se PIDEN por WhatsApp con un mensaje ya escrito", () => {
  const m = mensajeCambioFiscal({ empresa: "Acme", folio: "MOR-2026-0001" });
  assert.match(m, /Acme/);
  assert.match(m, /MOR-2026-0001/);
  assert.match(m, /razón social|RFC/);
});

test("eliminar la cuenta pide escribir ELIMINAR (sin importar mayúsculas ni espacios)", () => {
  assert.equal(CONFIRMAR_ELIMINAR, "ELIMINAR");
  assert.equal(confirmaEliminar(" eliminar "), true);
  assert.equal(confirmaEliminar("borrar"), false);
});

test("tras eliminar la cuenta, el login lo dice claro", async () => {
  const { mensajeDeError, ERRORES_LOGIN } = await import("../lib/errores-login.mjs");
  assert.equal(ERRORES_LOGIN.cuentaEliminada, "cuenta_eliminada");
  assert.match(mensajeDeError("cuenta_eliminada"), /eliminó/);
});

test("el login regresa a donde ibas, pero SOLO dentro del portal", async () => {
  const { destinoTrasLogin } = await import("../lib/errores-login.mjs");
  assert.equal(destinoTrasLogin("/portal/historial"), "/portal/historial");
  assert.equal(destinoTrasLogin("/portal/agendar?x=1"), "/portal/agendar?x=1");
  for (const malo of ["//evil.com", "/admin", "https://evil.com", "/portal/login", "/portalX", "/portal/../admin", "", null, "/\evil.com"]) {
    assert.equal(destinoTrasLogin(malo), "/portal", String(malo));
  }
});
