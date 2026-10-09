// Apps al 100% (9-oct-2026): Mi cuenta (de todos), el equipo y los roles.
import { test } from "node:test";
import assert from "node:assert/strict";
import { tieneContrasena, validarMisDatos } from "../src/mi-cuenta-app.mjs";
import {
  textoPermiso,
  alternarPermisoRol,
  etiquetaRolDe,
  puedoTocarUsuario,
  datosEdicionUsuario,
  personasConRol,
  rolInicialInvitado,
} from "../src/equipo-app.mjs";
import { ROL_COMPLETO } from "../src/web/permisos.mjs";

test("quien entra solo con Google o Apple no tiene contraseña que cambiar", () => {
  assert.equal(tieneContrasena({ app_metadata: { providers: ["email"] } }), true);
  assert.equal(tieneContrasena({ app_metadata: { providers: ["google"] } }), false);
  assert.equal(tieneContrasena({ app_metadata: { providers: ["apple", "email"] } }), true);
  assert.equal(tieneContrasena({ app_metadata: { provider: "apple" } }), false);
  assert.equal(tieneContrasena({ app_metadata: {} }), true, "sin datos: como la web, se ofrece");
  assert.equal(tieneContrasena(null), true);
});

test("mis datos: nombre obligatorio y teléfono de 10 dígitos (como la web)", () => {
  assert.deepEqual(validarMisDatos({ nombre: "  Ana   López ", telefono: "+52 (868) 123-4567" }), {
    ok: true,
    limpio: { nombre: "Ana López", telefono: "8681234567", rolId: null },
  });
  assert.equal(validarMisDatos({ nombre: "", telefono: "" }).ok, false);
  assert.equal(validarMisDatos({ nombre: "Ana", telefono: "12345" }).motivo, "El teléfono debe tener 10 dígitos.");
  assert.deepEqual(validarMisDatos({ nombre: "Ana", telefono: "" }).limpio.telefono, null);
});

test("las casillas de un rol se prenden y se apagan sin repetir", () => {
  assert.deepEqual(alternarPermisoRol(["saldos"], "clientes"), ["saldos", "clientes"]);
  assert.deepEqual(alternarPermisoRol(["saldos", "clientes"], "saldos"), ["clientes"]);
  assert.deepEqual(alternarPermisoRol(undefined, "saldos"), ["saldos"]);
  assert.equal(textoPermiso("saldos"), "Saldos de clientes");
  assert.equal(textoPermiso("eliminar_clientes"), "Eliminar clientes definitivamente");
  assert.equal(textoPermiso("raro"), "raro");
});

test("la etiqueta del rol de cada persona", () => {
  const roles = [{ id: "r1", nombre: "Caja" }];
  assert.equal(etiquetaRolDe({ rol: "admin", rolId: "r1" }, roles), "Caja");
  assert.equal(etiquetaRolDe({ rol: "admin", rolId: null }, roles), "Sin rol (solo el Panel)");
  assert.equal(etiquetaRolDe({ rol: "dueno" }, roles), "Dueño");
  assert.equal(etiquetaRolDe({ rol: "operador" }, roles), "Chofer / Operador");
  assert.equal(personasConRol([{ rolId: "r1" }, { rolId: "r1" }, { rolId: null }], "r1"), 2);
});

test("a quién puede tocar cada quien (lo mismo que el servidor)", () => {
  const dueno = { id: "d", rol: "dueno" };
  const admin = { id: "a", rol: "admin" };
  assert.equal(puedoTocarUsuario(dueno, { id: "a", rol: "admin" }), true);
  assert.equal(puedoTocarUsuario(dueno, { id: "d", rol: "dueno" }), false, "a sí mismo no");
  assert.equal(puedoTocarUsuario(admin, { id: "c", rol: "operador" }), true);
  assert.equal(puedoTocarUsuario(admin, { id: "b", rol: "admin" }), false);
  assert.equal(puedoTocarUsuario(admin, { id: "a", rol: "admin" }), false);
  assert.equal(puedoTocarUsuario(null, { id: "c", rol: "operador" }), false);
});

test("al guardar a alguien, el rol solo viaja si lo manda el dueño y es admin ('' = sin rol)", () => {
  const u = { id: "a", rol: "admin" };
  assert.deepEqual(datosEdicionUsuario({ u, nombre: "Ana", telefono: "8681234567", rolId: "r1", soyDueno: true }),
    { id: "a", nombre: "Ana", telefono: "8681234567", rolId: "r1" });
  assert.deepEqual(datosEdicionUsuario({ u, nombre: "Ana", telefono: "", rolId: "", soyDueno: true }),
    { id: "a", nombre: "Ana", telefono: "", rolId: "" });
  assert.deepEqual(datosEdicionUsuario({ u, nombre: "Ana", telefono: "", rolId: "r1", soyDueno: false }),
    { id: "a", nombre: "Ana", telefono: "" });
  assert.deepEqual(datosEdicionUsuario({ u: { id: "c", rol: "operador" }, nombre: "Beto", telefono: "", rolId: "r1", soyDueno: true }),
    { id: "c", nombre: "Beto", telefono: "" });
});

test("al invitar un admin, el rol de entrada es el completo (como el servidor)", () => {
  const roles = [{ id: "r1", nombre: "Caja" }, { id: "r9", nombre: ROL_COMPLETO }];
  assert.equal(rolInicialInvitado(roles), "r9");
  assert.equal(rolInicialInvitado([]), "");
});
