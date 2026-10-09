import { test } from "node:test";
import assert from "node:assert/strict";
import { validarCambioContrasena, cambiarContrasenaCon } from "../lib/mi-cuenta.mjs";

test("contraseña nueva: 8+, distinta de la actual y repetida igual", () => {
  assert.equal(validarCambioContrasena({ actual: "", nueva: "12345678", repetir: "12345678" }).ok, false);
  assert.equal(validarCambioContrasena({ actual: "vieja123", nueva: "corta", repetir: "corta" }).ok, false);
  assert.equal(validarCambioContrasena({ actual: "vieja123", nueva: "vieja123", repetir: "vieja123" }).ok, false);
  assert.equal(validarCambioContrasena({ actual: "vieja123", nueva: "nueva1234", repetir: "nueva12345" }).ok, false);
  assert.equal(validarCambioContrasena({ actual: "vieja123", nueva: "nueva1234", repetir: "nueva1234" }).ok, true);
});

test("cambiar: si la actual no es, NO guarda nada", async () => {
  const hechos = [];
  const r = await cambiarContrasenaCon(
    { comprobar: async () => false, guardar: async () => hechos.push("guardar"), avisar: async () => hechos.push("avisar") },
    { correo: "a@m.mx", uid: "u", actual: "mala1234", nueva: "nueva1234", repetir: "nueva1234" });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /actual/);
  assert.deepEqual(hechos, []);
});

test("cambiar: con la actual correcta guarda y avisa por correo", async () => {
  const hechos = [];
  const r = await cambiarContrasenaCon(
    { comprobar: async (c, p) => c === "a@m.mx" && p === "vieja123",
      guardar: async (uid, p) => hechos.push(`guardar:${uid}:${p}`), avisar: async () => hechos.push("avisar") },
    { correo: "a@m.mx", uid: "u", actual: "vieja123", nueva: "nueva1234", repetir: "nueva1234" });
  assert.equal(r.ok, true);
  assert.deepEqual(hechos, ["guardar:u:nueva1234", "avisar"]);
});

test("cambiar: si guardar falla, lo dice y no avisa", async () => {
  const hechos = [];
  const r = await cambiarContrasenaCon(
    { comprobar: async () => true, guardar: async () => { throw new Error("débil"); }, avisar: async () => hechos.push("avisar") },
    { correo: "a@m.mx", uid: "u", actual: "vieja123", nueva: "nueva1234", repetir: "nueva1234" });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /débil/);
  assert.deepEqual(hechos, []);
});
