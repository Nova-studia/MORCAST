import { test } from "node:test";
import assert from "node:assert/strict";
import { autenticarApp, anotarBitacora, esUuid, ROLES_PERSONAL, MENSAJES_APP } from "../lib/app-auth.mjs";

const callado = { error() {} };

/** Un JWT de mentira con `session_id`, como los de Supabase (sin firma real). */
function tokenCon(sessionId) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256" })}.${b64({ sub: "x", session_id: sessionId })}.firma`;
}

function sbFalso({ usuarios = {}, perfiles = {}, fallaPerfil = false } = {}) {
  const bitacora = [];
  return {
    bitacora,
    auth: {
      async getUser(token) {
        const u = usuarios[token];
        return u ? { data: { user: u }, error: null } : { data: { user: null }, error: { message: "invalid JWT" } };
      },
    },
    from(tabla) {
      const q = {
        _id: null,
        select() { return q; },
        eq(_c, v) { q._id = v; return q; },
        async maybeSingle() {
          if (fallaPerfil) return { data: null, error: { message: "base caída" } };
          return { data: perfiles[q._id] ?? null, error: null };
        },
        async insert(fila) {
          if (tabla === "bitacora") bitacora.push(fila);
          return { error: null };
        },
      };
      return q;
    },
  };
}

const TOKEN_ADMIN = tokenCon("ses-1");
const usuarios = {
  [TOKEN_ADMIN]: { id: "u-adm", email: "a@m.mx", app_metadata: { rol: "admin" } },
  "tok-chofer": { id: "u-cho", email: "c@m.mx", app_metadata: { rol: "operador" } },
  // El token dice "admin" pero en la base ya lo bajaron a chofer: manda la base.
  "tok-viejo": { id: "u-bajado", email: "b@m.mx", app_metadata: { rol: "admin" } },
  "tok-inactivo": { id: "u-inact", email: "i@m.mx", app_metadata: { rol: "admin" } },
  "tok-sin-perfil": { id: "u-nada", email: "n@m.mx", app_metadata: {} },
};
const perfiles = {
  "u-adm": { id: "u-adm", nombre: "Ana", rol: "admin", activo: true },
  "u-cho": { id: "u-cho", nombre: "Beto", rol: "operador", activo: true },
  "u-bajado": { id: "u-bajado", nombre: "Ex", rol: "operador", activo: true },
  "u-inact": { id: "u-inact", nombre: "Ida", rol: "admin", activo: false },
};

test("sin token o con uno falso: 401", async () => {
  const sb = sbFalso({ usuarios, perfiles });
  assert.deepEqual(await autenticarApp({ token: null, sb, roles: ROLES_PERSONAL }),
    { ok: false, status: 401, motivo: MENSAJES_APP.sinSesion });
  assert.equal((await autenticarApp({ token: "inventado", sb, roles: ROLES_PERSONAL, log: callado })).status, 401);
});

test("un admin activo entra, con la sesión del token", async () => {
  const r = await autenticarApp({ token: TOKEN_ADMIN, sb: sbFalso({ usuarios, perfiles }), roles: ROLES_PERSONAL });
  assert.equal(r.ok, true);
  assert.equal(r.perfil.rol, "admin");
  assert.equal(r.sesion, "ses-1");
});

test("el rol sale de la BASE, no del token", async () => {
  const r = await autenticarApp({ token: "tok-viejo", sb: sbFalso({ usuarios, perfiles }), roles: ROLES_PERSONAL });
  assert.deepEqual(r, { ok: false, status: 403, motivo: MENSAJES_APP.sinPermiso });
});

test("un chofer no entra a lo del personal, pero sí a lo suyo", async () => {
  const sb = sbFalso({ usuarios, perfiles });
  assert.equal((await autenticarApp({ token: "tok-chofer", sb, roles: ROLES_PERSONAL })).status, 403);
  assert.equal((await autenticarApp({ token: "tok-chofer", sb, roles: ["operador"] })).ok, true);
});

test("cuenta desactivada o sin perfil: 403", async () => {
  const sb = sbFalso({ usuarios, perfiles });
  assert.deepEqual(await autenticarApp({ token: "tok-inactivo", sb, roles: ROLES_PERSONAL }),
    { ok: false, status: 403, motivo: MENSAJES_APP.inactivo });
  assert.equal((await autenticarApp({ token: "tok-sin-perfil", sb, roles: ROLES_PERSONAL })).status, 403);
});

test("si la base no contesta: 500, no deja pasar", async () => {
  const r = await autenticarApp({ token: TOKEN_ADMIN, sb: sbFalso({ usuarios, fallaPerfil: true }), roles: ROLES_PERSONAL, log: callado });
  assert.equal(r.status, 500);
});

test("la bitácora queda a nombre de quien llamó y con origen app", async () => {
  const sb = sbFalso();
  await anotarBitacora(sb, { usuario: { id: "u1", email: "x@m.mx" }, accion: "entrar_panel", tabla: "perfiles", registroId: "u1" });
  assert.deepEqual(sb.bitacora[0], {
    actor_id: "u1", actor_correo: "x@m.mx", accion: "entrar_panel", tabla: "perfiles", registro_id: "u1", detalle: { origen: "app" },
  });
});

test("esUuid", () => {
  assert.equal(esUuid("00000000-0000-0000-0000-00000000000a"), true);
  assert.equal(esUuid("1; drop table"), false);
  assert.equal(esUuid(42), false);
});
