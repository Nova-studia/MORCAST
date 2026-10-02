import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ROLES_INVITABLES,
  validarInvitacion,
  puedeInvitar,
  puedeCambiarActivo,
} from "../lib/equipo.mjs";

test("solo se invita a los roles que existen en la base: admin y operador", () => {
  assert.deepEqual(Object.keys(ROLES_INVITABLES).sort(), ["admin", "operador"]);
});

test("una invitación válida sale limpia y con el correo en minúsculas", () => {
  const r = validarInvitacion({ nombre: "  Juan Pérez ", correo: " Juan@Morcast.MX ", rol: "operador" });
  assert.equal(r.ok, true);
  assert.deepEqual(r.limpio, { nombre: "Juan Pérez", correo: "juan@morcast.mx", rol: "operador" });
});

test("sin nombre, con correo malo o con un rol inventado no pasa", () => {
  assert.equal(validarInvitacion({ nombre: "", correo: "a@b.mx", rol: "admin" }).ok, false);
  assert.equal(validarInvitacion({ nombre: "Ana", correo: "no-es-correo", rol: "admin" }).ok, false);
  // Los roles viejos de la pantalla nunca existieron en la base.
  for (const rol of ["Facturación", "Operaciones", "Auxiliar de administrador", "dueno", "cliente", "pendiente"]) {
    assert.equal(validarInvitacion({ nombre: "Ana", correo: "a@b.mx", rol }).ok, false, rol);
  }
});

test("invitan el dueño y los administradores; nadie más", () => {
  assert.equal(puedeInvitar({ rol: "dueno" }), true);
  assert.equal(puedeInvitar({ rol: "admin" }), true);
  assert.equal(puedeInvitar({ rol: "operador" }), false);
  assert.equal(puedeInvitar({ rol: "cliente" }), false);
  assert.equal(puedeInvitar(null), false);
});

test("nadie desactiva al dueño ni a sí mismo", () => {
  const dueno = { id: "d", rol: "dueno" };
  const admin = { id: "a", rol: "admin" };
  assert.equal(puedeCambiarActivo({ quien: admin, objetivo: dueno }).puede, false);
  assert.equal(puedeCambiarActivo({ quien: dueno, objetivo: dueno }).puede, false);
  assert.equal(puedeCambiarActivo({ quien: admin, objetivo: admin }).puede, false);
});

test("el personal puede desactivar a otro admin o a un chofer, pero no a un cliente", () => {
  const dueno = { id: "d", rol: "dueno" };
  assert.equal(puedeCambiarActivo({ quien: dueno, objetivo: { id: "x", rol: "admin" } }).puede, true);
  assert.equal(puedeCambiarActivo({ quien: { id: "a", rol: "admin" }, objetivo: { id: "x", rol: "operador" } }).puede, true);
  // A los clientes se les da de baja desde Clientes, no desde aquí.
  assert.equal(puedeCambiarActivo({ quien: dueno, objetivo: { id: "c", rol: "cliente" } }).puede, false);
  // Un chofer no administra a nadie.
  assert.equal(puedeCambiarActivo({ quien: { id: "o", rol: "operador" }, objetivo: { id: "x", rol: "operador" } }).puede, false);
});
