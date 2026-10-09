import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SECCIONES,
  PERMISOS_DE_ROL,
  seccionDeRuta,
  puede,
  validarRol,
  permisosEfectivos,
} from "../lib/permisos.mjs";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("la lista de la base (029) es la misma que la de aquí", () => {
  const sql = fs.readFileSync(path.join(WEB, "db", "029-roles.sql"), "utf8");
  const bloque = sql.match(/roles_permisos_validos check \(permisos <@ array\[([\s\S]*?)\]/)[1];
  const enBase = [...bloque.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(enBase, [...PERMISOS_DE_ROL].sort());
});

test("cada página del panel cae en su sección", () => {
  assert.equal(seccionDeRuta("/admin/rutas"), "rutas");
  assert.equal(seccionDeRuta("/admin/sectores/abc"), "rutas");
  assert.equal(seccionDeRuta("/admin/viajes"), "recolecciones");
  assert.equal(seccionDeRuta("/admin/zonas-pedidas"), "zonas");
  assert.equal(seccionDeRuta("/admin/clientes/123"), "clientes");
  assert.equal(seccionDeRuta("/admin/usuarios"), "usuarios");
});

test("el Panel, Mi cuenta y la verificación son de todo el personal", () => {
  assert.equal(seccionDeRuta("/admin"), null);
  assert.equal(seccionDeRuta("/admin/cuenta"), null);
  assert.equal(seccionDeRuta("/admin/verificacion"), null);
});

test("una ruta parecida NO se cuela en otra sección", () => {
  assert.equal(seccionDeRuta("/admin/rutasX"), null);
  assert.equal(seccionDeRuta("/admin/clientes-falsos"), null);
});

test("puede: el dueño todo; el admin solo lo suyo; nadie más", () => {
  assert.equal(puede({ rol: "dueno", permisos: [] }, "saldos"), true);
  assert.equal(puede({ rol: "admin", permisos: ["rutas"] }, "rutas"), true);
  assert.equal(puede({ rol: "admin", permisos: ["rutas"] }, "saldos"), false);
  assert.equal(puede({ rol: "operador", permisos: ["rutas"] }, "rutas"), false);
  assert.equal(puede(null, "rutas"), false);
  assert.equal(puede({ rol: "admin", permisos: [] }, null), true, "sin sección (Panel) siempre");
});

test("permisos efectivos = los del rol + los sueltos, sin repetir", () => {
  assert.deepEqual(permisosEfectivos(["precios"], ["rutas", "precios"]).sort(), ["precios", "rutas"]);
  assert.deepEqual(permisosEfectivos(null, undefined), []);
});

test("validarRol: nombre obligatorio y solo secciones que existen", () => {
  assert.equal(validarRol({ nombre: "  ", permisos: ["rutas"] }).ok, false);
  assert.equal(validarRol({ nombre: "X".repeat(61), permisos: [] }).ok, false);
  assert.equal(validarRol({ nombre: "Caja", permisos: ["saldos", "todo"] }).ok, false);
  const r = validarRol({ nombre: "  Caja ", descripcion: " cobra ", permisos: ["saldos", "saldos", "clientes"] });
  assert.equal(r.ok, true);
  assert.deepEqual(r.limpio, { nombre: "Caja", descripcion: "cobra", permisos: ["saldos", "clientes"] });
});

test("cada sección tiene texto para las casillas", () => {
  for (const s of SECCIONES) assert.ok(s.id && s.texto, s.id);
});

test("leerPermisos: junta el rol y los sueltos (y avisa del nombre del rol)", async () => {
  const { leerPermisos } = await import("../lib/permisos.mjs");
  const sb = { from: () => ({ select() { return this; }, eq() { return this; },
    maybeSingle: async () => ({ data: { rol: "admin", permisos: ["precios"], rol_id: "r1", roles: { nombre: "Caja", permisos: ["saldos"] } } }) }) };
  const p = await leerPermisos(sb, "u1");
  assert.equal(p.rol, "admin");
  assert.equal(p.rolNombre, "Caja");
  assert.deepEqual(p.permisos.sort(), ["precios", "saldos"]);
});

test("leerPermisos: sin perfil o con error, nada", async () => {
  const { leerPermisos } = await import("../lib/permisos.mjs");
  const sb = { from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: null, error: { message: "x" } }) }) };
  assert.deepEqual(await leerPermisos(sb, "u1"), { rol: null, rolId: null, rolNombre: null, permisos: [] });
});

test("rolDeInvitado: un admin nuevo entra con el rol elegido, o con el completo si no se eligió", async () => {
  const { rolDeInvitado } = await import("../lib/permisos.mjs");
  const roles = [{ id: "r1", nombre: "Administrador completo" }, { id: "r2", nombre: "Caja" }];
  assert.deepEqual(rolDeInvitado({ rol: "operador", rolId: "r2", roles }), { ok: true, rolId: null });
  assert.deepEqual(rolDeInvitado({ rol: "admin", rolId: "r2", roles }), { ok: true, rolId: "r2" });
  assert.deepEqual(rolDeInvitado({ rol: "admin", rolId: "", roles }), { ok: true, rolId: "r1" });
  assert.equal(rolDeInvitado({ rol: "admin", rolId: "zz", roles }).ok, false);
  assert.deepEqual(rolDeInvitado({ rol: "admin", rolId: null, roles: [] }), { ok: true, rolId: null });
});
