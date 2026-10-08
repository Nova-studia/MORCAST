import { test } from "node:test";
import assert from "node:assert/strict";
import { esCuentaApple } from "../lib/cuenta-apple.mjs";

test("reconoce una cuenta de Apple por sus identidades o su app_metadata", () => {
  assert.equal(esCuentaApple({ identities: [{ provider: "apple" }] }), true);
  assert.equal(esCuentaApple({ app_metadata: { provider: "apple" } }), true);
  assert.equal(esCuentaApple({ app_metadata: { providers: ["email", "apple"] } }), true);
});

test("Google, correo o nada no son Apple", () => {
  assert.equal(esCuentaApple({ identities: [{ provider: "google" }], app_metadata: { provider: "google" } }), false);
  assert.equal(esCuentaApple({ app_metadata: { provider: "email" } }), false);
  assert.equal(esCuentaApple(null), false);
});

import { selloDeActivacion } from "../lib/cuenta-apple.mjs";

test("Apple: el sello lleva rol y empresa, y NUNCA contraseña", () => {
  const r = selloDeActivacion({ apple: true, password: "", clienteId: "c1" });
  assert.equal(r.ok, true);
  assert.deepEqual(r.cambios, { app_metadata: { rol: "cliente", cliente_id: "c1" } });
  assert.equal("password" in r.cambios, false);
  assert.equal(selloDeActivacion({ apple: true, password: "algo-largo-123", clienteId: "c1" }).cambios.password, undefined);
});

test("Google o correo: la contraseña sigue siendo obligatoria (8+)", () => {
  assert.equal(selloDeActivacion({ apple: false, password: "corta", clienteId: "c1" }).ok, false);
  const r = selloDeActivacion({ apple: false, password: "abcdefgh9", clienteId: "c1" });
  assert.deepEqual(r.cambios, { password: "abcdefgh9", app_metadata: { rol: "cliente", cliente_id: "c1" } });
});
