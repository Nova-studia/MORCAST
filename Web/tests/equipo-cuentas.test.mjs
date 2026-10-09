import { test } from "node:test";
import assert from "node:assert/strict";
import { editarUsuarioEquipoCon, mandarEnlaceEquipoCon, eliminarUsuarioEquipoCon, detalleEquipoCon } from "../lib/equipo-cuentas.mjs";

/** Supabase falso: `datos[tabla]` responde los select; anota todo en `ops`. */
function falso(datos = {}, { errBorrar = null } = {}) {
  const ops = [];
  const cadena = (tabla, op, valor) => ({
    _f: [],
    eq(c, v) { this._f.push(`${c}=${v}`); return this; },
    select() { return this; },
    maybeSingle() { this._uno = true; return this; },
    then(ok, mal) {
      ops.push(`${tabla}:${op}${this._f.length ? `[${this._f.join(",")}]` : ""}${valor ? ":" + JSON.stringify(valor) : ""}`);
      const filas = op === "select" ? (datos[tabla] || []) : [{ id: "x" }];
      return Promise.resolve({ data: this._uno ? (filas[0] ?? null) : filas, error: null, count: filas.length }).then(ok, mal);
    },
  });
  return {
    ops,
    from: (t) => ({ select: () => cadena(t, "select"), update: (v) => cadena(t, "update", v) }),
    auth: { admin: {
      getUserById: async (id) => ({ data: { user: { id, email: `${id}@m.mx` } }, error: null }),
      generateLink: async ({ email }) => { ops.push(`link:${email}`); return { data: { properties: { hashed_token: "tok" } }, error: null }; },
      updateUserById: async (id, c) => { ops.push(`auth:update:${id}:${JSON.stringify(c)}`); return { error: null }; },
      deleteUser: async (id) => { ops.push(`auth:delete:${id}`); return { error: errBorrar }; },
      listUsers: async () => ({ data: { users: [{ id: "c", email: "c@m.mx", last_sign_in_at: "2026-10-01T10:00:00Z" }] }, error: null }),
    } },
  };
}
const anotar = async () => {};
const D = { id: "d", rol: "dueno", nombre: "Dueño" };
const A = { id: "a", rol: "admin", nombre: "Ana" };

test("editar: guarda nombre y teléfono, y el nombre también en Auth", async () => {
  const sb = falso({ perfiles: [{ id: "c", rol: "operador", nombre: "Viejo" }] });
  const r = await editarUsuarioEquipoCon({ sb, quien: A, anotar }, { id: "c", nombre: "Nuevo", telefono: "8681234567" });
  assert.equal(r.ok, true);
  assert.ok(sb.ops.some((o) => o.startsWith("perfiles:update[id=c]") && o.includes('"nombre":"Nuevo"') && !o.includes("rol_id")));
  assert.ok(sb.ops.some((o) => o.startsWith("auth:update:c") && o.includes("Nuevo")));
});

test("editar: un admin NO cambia el rol de nadie; el dueño sí, y solo a un rol que existe", async () => {
  const sbA = falso({ perfiles: [{ id: "a2", rol: "admin", nombre: "B" }], roles: [{ id: "r1" }] });
  assert.equal((await editarUsuarioEquipoCon({ sb: sbA, quien: A, anotar }, { id: "a2", nombre: "B", rolId: "r1" })).ok, false);
  const sbD = falso({ perfiles: [{ id: "a2", rol: "admin", nombre: "B" }], roles: [] });
  assert.equal((await editarUsuarioEquipoCon({ sb: sbD, quien: D, anotar }, { id: "a2", nombre: "B", rolId: "r9" })).ok, false);
  const sbOk = falso({ perfiles: [{ id: "a2", rol: "admin", nombre: "B" }], roles: [{ id: "r1" }] });
  assert.equal((await editarUsuarioEquipoCon({ sb: sbOk, quien: D, anotar }, { id: "a2", nombre: "B", rolId: "r1" })).ok, true);
  assert.ok(sbOk.ops.some((o) => o.startsWith("perfiles:update") && o.includes('"rol_id":"r1"')));
});

test("mandar enlace: genera el de recuperación y lo manda por correo", async () => {
  const sb = falso({ perfiles: [{ id: "c", rol: "operador", nombre: "Pepe" }] });
  const enviados = [];
  const r = await mandarEnlaceEquipoCon(
    { sb, quien: A, anotar, origen: "https://morcast.mx", enviarCorreo: async (c) => enviados.push(c) }, { id: "c" });
  assert.equal(r.ok, true);
  assert.equal(enviados[0].correo, "c@m.mx");
  assert.equal(enviados[0].enlace, "https://morcast.mx/portal/nueva-clave?token=tok");
});

test("eliminar: solo el dueño; si Auth no deja (historial), lo dice y sugiere desactivar", async () => {
  const sb = falso({ perfiles: [{ id: "c", rol: "operador", nombre: "Pepe" }] });
  assert.equal((await eliminarUsuarioEquipoCon({ sb, quien: A, anotar }, { id: "c" })).ok, false);
  assert.equal((await eliminarUsuarioEquipoCon({ sb, quien: D, anotar }, { id: "c" })).ok, true);
  assert.ok(sb.ops.includes("auth:delete:c"));
  const sbMal = falso({ perfiles: [{ id: "c", rol: "operador", nombre: "Pepe" }] }, { errBorrar: { message: "violates foreign key" } });
  const r = await eliminarUsuarioEquipoCon({ sb: sbMal, quien: D, anotar }, { id: "c" });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /Desactív/);
});

test("detalle: correo y último acceso por id", async () => {
  const r = await detalleEquipoCon({ sb: falso() });
  assert.deepEqual(r, { ok: true, porId: { c: { correo: "c@m.mx", ultimoAcceso: "2026-10-01T10:00:00Z" } } });
});

// ---- Revisión final de la Entrega 2 ----
test("revisión: eliminar a alguien CON historial se niega (la base pondría null y se perdería quién hizo qué)", async () => {
  const sb = falso({ perfiles: [{ id: "c", rol: "operador", nombre: "Pepe" }], recolecciones: [{ id: 1 }] });
  const r = await eliminarUsuarioEquipoCon({ sb, quien: D, anotar }, { id: "c" });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /Desactív/);
  assert.ok(!sb.ops.includes("auth:delete:c"), "no debe borrar");
  assert.ok(sb.ops.some((o) => o.startsWith("recolecciones:select[operador_id=c]")));
});
