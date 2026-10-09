import { test } from "node:test";
import assert from "node:assert/strict";
import { eliminarCuenta, tokenDeCabecera, decidir, MENSAJES } from "../lib/eliminar-cuenta.mjs";

/**
 * Un Supabase de mentira: sólo lo que usa `eliminarCuenta`, y anota cada
 * llamada para poder preguntar después "¿se borró o no?". Nunca toca la base.
 */
function sbFalso({ usuarios = {}, perfiles = {}, fallaBorrado = null, fallaGetUser = false } = {}) {
  const hechos = { borrados: [], perfilesBorrados: [], bitacora: [] };
  const sb = {
    hechos,
    auth: {
      async getUser(token) {
        if (fallaGetUser) throw new Error("red caída");
        const u = usuarios[token];
        return u ? { data: { user: u }, error: null } : { data: { user: null }, error: { message: "invalid JWT" } };
      },
      admin: {
        async deleteUser(id) {
          if (fallaBorrado) return { data: null, error: { message: fallaBorrado } };
          hechos.borrados.push(id);
          delete perfiles[id]; // la cascada de db/001
          return { data: {}, error: null };
        },
      },
    },
    from(tabla) {
      const q = {
        _filtro: null,
        select() { return q; },
        eq(_col, v) { q._filtro = v; return q; },
        async maybeSingle() {
          return { data: tabla === "perfiles" ? perfiles[q._filtro] ?? null : null, error: null };
        },
        delete() {
          return {
            async eq(_col, v) {
              if (tabla === "perfiles") hechos.perfilesBorrados.push(v);
              return { error: null };
            },
          };
        },
        async insert(fila) {
          if (tabla === "bitacora") hechos.bitacora.push(fila);
          return { error: null };
        },
      };
      return q;
    },
  };
  return sb;
}

const callado = { error() {} };

const cliente = { id: "u-cli", email: "compras@empresa.mx", app_metadata: { rol: "cliente", cliente_id: "c-1" } };
const muestra = { id: "u-demo", email: "revision.apple@morcast.mx", app_metadata: { rol: "cliente", demo: true } };
const chofer = { id: "u-cho", email: "chofer@morcast.mx", app_metadata: { rol: "operador" } };
const admin = { id: "u-adm", email: "admin@morcast.mx", app_metadata: { rol: "admin" } };

test("tokenDeCabecera: sólo 'Bearer <token>'", () => {
  assert.equal(tokenDeCabecera("Bearer abc.def"), "abc.def");
  assert.equal(tokenDeCabecera("bearer   abc"), "abc");
  assert.equal(tokenDeCabecera(null), null);
  assert.equal(tokenDeCabecera(""), null);
  assert.equal(tokenDeCabecera("Basic abc"), null);
  assert.equal(tokenDeCabecera("Bearer"), null);
  assert.equal(tokenDeCabecera("Bearer a b"), null);
});

test("decidir: el rol sale de app_metadata, nunca de user_metadata", () => {
  assert.equal(decidir(cliente), "borrar");
  assert.equal(decidir(muestra), "simular");
  assert.equal(decidir(chofer), "rechazar");
  assert.equal(decidir(admin), "rechazar");
  assert.equal(decidir({ app_metadata: { rol: "dueno" } }), "rechazar");
  // Un usuario que se pone "cliente" en user_metadata no cuenta.
  assert.equal(decidir({ user_metadata: { rol: "cliente" }, app_metadata: {} }), "rechazar");
  // "demo" en user_metadata tampoco lo salva de nada (ni lo protege).
  assert.equal(decidir({ user_metadata: { demo: true }, app_metadata: { rol: "cliente" } }), "borrar");
  assert.equal(decidir(null), "rechazar");
});

test("sin token: 401 y no se borra nada", async () => {
  const sb = sbFalso({ usuarios: { t: cliente } });
  const r = await eliminarCuenta({ token: null, sb, log: callado });
  assert.equal(r.status, 401);
  assert.equal(r.cuerpo.ok, false);
  assert.deepEqual(sb.hechos.borrados, []);
});

test("token que Auth no reconoce: 401 y no se borra nada", async () => {
  const sb = sbFalso({ usuarios: { bueno: cliente } });
  const r = await eliminarCuenta({ token: "inventado", sb, log: callado });
  assert.equal(r.status, 401);
  assert.equal(r.cuerpo.mensaje, MENSAJES.sinSesion);
  assert.deepEqual(sb.hechos.borrados, []);
});

test("si Auth no contesta: 401, no revienta", async () => {
  const sb = sbFalso({ fallaGetUser: true });
  const r = await eliminarCuenta({ token: "t", sb, log: callado });
  assert.equal(r.status, 401);
  assert.deepEqual(sb.hechos.borrados, []);
});

test("cliente: se borra DE VERDAD el usuario de Auth y su perfil", async () => {
  const perfiles = { "u-cli": { cliente_id: "c-1" } };
  const sb = sbFalso({ usuarios: { t: cliente }, perfiles });
  const r = await eliminarCuenta({ token: "t", sb, log: callado });
  assert.equal(r.status, 200);
  assert.deepEqual(r.cuerpo, { ok: true });
  assert.deepEqual(sb.hechos.borrados, ["u-cli"]);
  assert.deepEqual(sb.hechos.perfilesBorrados, ["u-cli"]);
  assert.equal(perfiles["u-cli"], undefined);
  // Queda constancia, sin actor_id (el perfil ya no existe) y con la empresa.
  assert.equal(sb.hechos.bitacora.length, 1);
  assert.equal(sb.hechos.bitacora[0].accion, "eliminar_cuenta");
  assert.equal(sb.hechos.bitacora[0].actor_id, null);
  assert.equal(sb.hechos.bitacora[0].detalle.cliente_id, "c-1");
});

test("cuenta de muestra del revisor: NO se borra, pero contesta que sí", async () => {
  const perfiles = { "u-demo": { cliente_id: "c-demo" } };
  const sb = sbFalso({ usuarios: { t: muestra }, perfiles });
  const r = await eliminarCuenta({ token: "t", sb, log: callado });
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.ok, true);
  assert.equal(r.cuerpo.simulado, true);
  assert.deepEqual(sb.hechos.borrados, []);
  assert.deepEqual(sb.hechos.perfilesBorrados, []);
  assert.ok(perfiles["u-demo"], "el perfil de la cuenta de muestra sigue ahí");
  assert.equal(sb.hechos.bitacora[0].accion, "eliminar_cuenta_simulada");
});

test("chofer y admin: 403, su cuenta la da de baja Morcast", async () => {
  for (const u of [chofer, admin]) {
    const sb = sbFalso({ usuarios: { t: u } });
    const r = await eliminarCuenta({ token: "t", sb, log: callado });
    assert.equal(r.status, 403, u.app_metadata.rol);
    assert.equal(r.cuerpo.mensaje, MENSAJES.noCliente);
    assert.deepEqual(sb.hechos.borrados, []);
  }
});

test("si Auth no deja borrar: 500 con mensaje claro, sin tocar el perfil", async () => {
  const perfiles = { "u-cli": { cliente_id: "c-1" } };
  const sb = sbFalso({ usuarios: { t: cliente }, perfiles, fallaBorrado: "Database error deleting user" });
  const r = await eliminarCuenta({ token: "t", sb, log: callado });
  assert.equal(r.status, 500);
  assert.equal(r.cuerpo.ok, false);
  assert.equal(r.cuerpo.mensaje, MENSAJES.fallo);
  assert.deepEqual(sb.hechos.perfilesBorrados, []);
  assert.ok(perfiles["u-cli"], "si el usuario no se borró, el perfil tampoco");
  assert.equal(sb.hechos.bitacora.length, 0);
});

test("desde el portal web: la bitácora dice origen 'web' (la app sigue diciendo 'app')", async () => {
  const sbWeb = sbFalso({ usuarios: { t: cliente }, perfiles: { "u-cli": { cliente_id: "c-1" } } });
  await eliminarCuenta({ token: "t", sb: sbWeb, log: callado, origen: "web" });
  assert.equal(sbWeb.hechos.bitacora[0].detalle.origen, "web");
  const sbApp = sbFalso({ usuarios: { t: cliente }, perfiles: { "u-cli": { cliente_id: "c-1" } } });
  await eliminarCuenta({ token: "t", sb: sbApp, log: callado });
  assert.equal(sbApp.hechos.bitacora[0].detalle.origen, "app");
});
