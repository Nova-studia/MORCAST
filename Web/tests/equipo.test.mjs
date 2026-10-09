import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ROLES_INVITABLES,
  validarInvitacion,
  puedeInvitar,
  puedeDarRol,
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

test("solo el dueño da acceso de administrador; el admin solo invita choferes", () => {
  assert.equal(puedeDarRol({ rol: "dueno" }, "admin"), true);
  assert.equal(puedeDarRol({ rol: "dueno" }, "operador"), true);
  assert.equal(puedeDarRol({ rol: "admin" }, "admin"), false);
  assert.equal(puedeDarRol({ rol: "admin" }, "operador"), true);
  assert.equal(puedeDarRol({ rol: "admin" }, "dueno"), false);
  assert.equal(puedeDarRol({ rol: "operador" }, "operador"), false);
  assert.equal(puedeDarRol(null, "operador"), false);
});

test("un admin no desactiva a otro admin; el dueño sí", () => {
  const admin = { id: "a", rol: "admin" };
  assert.equal(puedeCambiarActivo({ quien: admin, objetivo: { id: "x", rol: "admin" } }).puede, false);
  assert.equal(puedeCambiarActivo({ quien: { id: "d", rol: "dueno" }, objetivo: { id: "x", rol: "admin" } }).puede, true);
});

test("el dueño desactiva admins y el personal choferes, pero nadie a un cliente", () => {
  const dueno = { id: "d", rol: "dueno" };
  assert.equal(puedeCambiarActivo({ quien: dueno, objetivo: { id: "x", rol: "admin" } }).puede, true);
  assert.equal(puedeCambiarActivo({ quien: { id: "a", rol: "admin" }, objetivo: { id: "x", rol: "operador" } }).puede, true);
  // A los clientes se les da de baja desde Clientes, no desde aquí.
  assert.equal(puedeCambiarActivo({ quien: dueno, objetivo: { id: "c", rol: "cliente" } }).puede, false);
  // Un chofer no administra a nadie.
  assert.equal(puedeCambiarActivo({ quien: { id: "o", rol: "operador" }, objetivo: { id: "x", rol: "operador" } }).puede, false);
});

// ---- Entrega 2: editar, mandar enlace y eliminar (9-oct-2026) ----
import { puedeEditarUsuario, puedeMandarEnlace, puedeEliminarUsuario, validarEdicionUsuario } from "../lib/equipo.mjs";

const D = { id: "d", rol: "dueno" };
const A = { id: "a", rol: "admin" };
const A2 = { id: "a2", rol: "admin" };
const C = { id: "c", rol: "operador" };

test("editar: el dueño edita a admins y choferes; un admin solo a choferes; el rol solo lo cambia el dueño", () => {
  assert.equal(puedeEditarUsuario({ quien: D, objetivo: A2, cambios: { nombre: "x", rolId: "r" } }).puede, true);
  assert.equal(puedeEditarUsuario({ quien: A, objetivo: C, cambios: { nombre: "x" } }).puede, true);
  assert.equal(puedeEditarUsuario({ quien: A, objetivo: A2, cambios: { nombre: "x" } }).puede, false);
  assert.equal(puedeEditarUsuario({ quien: A, objetivo: C, cambios: { rolId: "r" } }).puede, false);
  assert.equal(puedeEditarUsuario({ quien: D, objetivo: D, cambios: { nombre: "x" } }).puede, false, "lo suyo va en Mi cuenta");
  assert.equal(puedeEditarUsuario({ quien: D, objetivo: { id: "k", rol: "cliente" }, cambios: { nombre: "x" } }).puede, false);
  assert.equal(puedeEditarUsuario({ quien: D, objetivo: C, cambios: { rolId: "r" } }).puede, false, "los choferes no llevan rol");
});

test("validarEdicionUsuario: nombre obligatorio, teléfono de 10 dígitos o vacío", () => {
  assert.equal(validarEdicionUsuario({ nombre: " " }).ok, false);
  assert.equal(validarEdicionUsuario({ nombre: "Ana", telefono: "123" }).ok, false);
  const r = validarEdicionUsuario({ nombre: " Ana  Ruiz ", telefono: "(868) 123-4567", rolId: "" });
  assert.deepEqual(r, { ok: true, limpio: { nombre: "Ana Ruiz", telefono: "8681234567", rolId: null } });
  assert.deepEqual(validarEdicionUsuario({ nombre: "Ana", telefono: "" }).limpio.telefono, null);
});

test("mandar enlace de contraseña: como editar (nunca al dueño desde aquí)", () => {
  assert.equal(puedeMandarEnlace({ quien: D, objetivo: A2 }).puede, true);
  assert.equal(puedeMandarEnlace({ quien: A, objetivo: C }).puede, true);
  assert.equal(puedeMandarEnlace({ quien: A, objetivo: A2 }).puede, false);
  assert.equal(puedeMandarEnlace({ quien: D, objetivo: D }).puede, false);
});

test("eliminar: solo el dueño, nunca a sí mismo ni a un cliente", () => {
  assert.equal(puedeEliminarUsuario({ quien: D, objetivo: A2 }).puede, true);
  assert.equal(puedeEliminarUsuario({ quien: D, objetivo: C }).puede, true);
  assert.equal(puedeEliminarUsuario({ quien: A, objetivo: C }).puede, false);
  assert.equal(puedeEliminarUsuario({ quien: D, objetivo: D }).puede, false);
  assert.equal(puedeEliminarUsuario({ quien: D, objetivo: { id: "k", rol: "cliente" } }).puede, false);
  assert.equal(puedeEliminarUsuario({ quien: D, objetivo: null }).puede, false);
});

test("revisión: un teléfono viejo con +52 o lada NO bloquea guardar (se quedan los últimos 10)", () => {
  assert.deepEqual(validarEdicionUsuario({ nombre: "Ana", telefono: "+52 868 123 4567" }).limpio.telefono, "8681234567");
  assert.deepEqual(validarEdicionUsuario({ nombre: "Ana", telefono: "+1 (956) 555-0101" }).limpio.telefono, "9565550101");
});
