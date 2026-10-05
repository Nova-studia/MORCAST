import { test } from "node:test";
import assert from "node:assert/strict";
import {
  URL_EXPO_PUSH,
  TAMANO_LOTE,
  tokenValido,
  enLotes,
  limpiarTokens,
  armarMensajes,
  leerRespuesta,
  enviarPush,
  recortar,
  MAX_CUERPO_PUSH,
  tokensDeUsuarios,
  usuariosClienteDe,
  usuariosOficina,
} from "../lib/push.mjs";

const callado = { error() {}, warn() {} };
const tk = (i) => `ExponentPushToken[tok${i}]`;

/**
 * Un "Expo" de mentira: anota cada petición y contesta un ticket por mensaje.
 * `muertos` son los tokens a los que responde DeviceNotRegistered.
 */
function expoFalso({ muertos = [], estado = 200, falla = null, sinData = false } = {}) {
  const peticiones = [];
  const f = async (url, opciones) => {
    peticiones.push({ url, opciones, mensajes: JSON.parse(opciones.body) });
    if (falla) throw new Error(falla);
    const mensajes = JSON.parse(opciones.body);
    return {
      status: estado,
      async json() {
        if (sinData) return { errors: [{ code: "VALIDATION_ERROR" }] };
        return {
          data: mensajes.map((m) =>
            muertos.includes(m.to)
              ? { status: "error", message: "no registrado", details: { error: "DeviceNotRegistered" } }
              : { status: "ok", id: `t-${m.to}` }
          ),
        };
      },
    };
  };
  f.peticiones = peticiones;
  return f;
}

/** Supabase de mentira para el borrado de tokens muertos. */
function sbFalso({ falla = false } = {}) {
  const borrados = [];
  return {
    borrados,
    from(tabla) {
      return {
        delete() {
          return {
            async in(col, valores) {
              if (falla) return { error: { message: "base caída" } };
              borrados.push({ tabla, col, valores });
              return { error: null };
            },
          };
        },
      };
    },
  };
}

test("reconoce los dos formatos de token de Expo y nada más", () => {
  assert.equal(tokenValido("ExponentPushToken[abc-DEF_123]"), true);
  assert.equal(tokenValido("ExpoPushToken[abc]"), true);
  assert.equal(tokenValido("ExponentPushToken[]"), false);
  assert.equal(tokenValido("ExponentPushToken[a b]"), false);
  assert.equal(tokenValido("fcm:abc"), false);
  assert.equal(tokenValido(null), false);
});

test("parte en lotes de 100", () => {
  const lotes = enLotes(Array.from({ length: 250 }, (_, i) => i));
  assert.equal(TAMANO_LOTE, 100);
  assert.deepEqual(lotes.map((l) => l.length), [100, 100, 50]);
  assert.deepEqual(enLotes([]), []);
});

test("limpia: sin repetidos, sin basura, acepta filas { token }", () => {
  const r = limpiarTokens([tk(1), { token: tk(1) }, { token: tk(2) }, "basura", null, ` ${tk(3)} `]);
  assert.deepEqual(r, [tk(1), tk(2), tk(3)]);
});

test("arma un mensaje por token con los datos para abrir la pantalla", () => {
  const m = armarMensajes([tk(1), tk(2)], { titulo: "Retraso", cuerpo: "La ruta va tarde", datos: { tipo: "aviso", id: "a1" } });
  assert.equal(m.length, 2);
  assert.deepEqual(m[0], {
    to: tk(1), title: "Retraso", body: "La ruta va tarde", data: { tipo: "aviso", id: "a1" }, sound: "default", priority: "high", channelId: "avisos",
  });
});

test("recorta el cuerpo largo con …, y aplana los saltos de línea", () => {
  const largo = "a".repeat(500);
  const r = recortar(largo, MAX_CUERPO_PUSH);
  assert.equal(r.length, MAX_CUERPO_PUSH);
  assert.ok(r.endsWith("…"));
  assert.equal(recortar("hola\n\nmundo", 50), "hola mundo");
});

test("lee los tickets en orden y saca los DeviceNotRegistered", () => {
  const mensajes = [{ to: tk(1) }, { to: tk(2) }, { to: tk(3) }];
  const r = leerRespuesta(mensajes, {
    data: [
      { status: "ok", id: "x" },
      { status: "error", details: { error: "DeviceNotRegistered" } },
      { status: "error", details: { error: "MessageRateExceeded" } },
    ],
  });
  assert.deepEqual(r, { enviadas: 1, fallidas: 2, muertos: [tk(2)] });
});

test("si Expo rechaza todo el lote, todo cuenta como fallido y no se borra nada", () => {
  const r = leerRespuesta([{ to: tk(1) }, { to: tk(2) }], { errors: [{ code: "X" }] });
  assert.deepEqual(r, { enviadas: 0, fallidas: 2, muertos: [] });
});

test("sin tokens no llama a Expo ni falla", async () => {
  const f = expoFalso();
  const r = await enviarPush([], { titulo: "x", cuerpo: "y" }, { fetch: f, log: callado });
  assert.deepEqual(r, { enviadas: 0, fallidas: 0, borrados: 0 });
  assert.equal(f.peticiones.length, 0);
});

test("manda 250 tokens en 3 peticiones a la URL de Expo", async () => {
  const f = expoFalso();
  const tokens = Array.from({ length: 250 }, (_, i) => tk(i));
  const r = await enviarPush(tokens, { titulo: "t", cuerpo: "c" }, { fetch: f, log: callado, accessToken: null });
  assert.equal(f.peticiones.length, 3);
  assert.ok(f.peticiones.every((p) => p.url === URL_EXPO_PUSH));
  assert.deepEqual(f.peticiones.map((p) => p.mensajes.length), [100, 100, 50]);
  assert.equal(r.enviadas, 250);
  assert.equal(f.peticiones[0].opciones.headers.Authorization, undefined);
});

test("usa EXPO_ACCESS_TOKEN cuando lo hay", async () => {
  const f = expoFalso();
  await enviarPush([tk(1)], { titulo: "t", cuerpo: "c" }, { fetch: f, log: callado, accessToken: "secreto" });
  assert.equal(f.peticiones[0].opciones.headers.Authorization, "Bearer secreto");
});

test("borra de push_tokens los que Expo dice que ya no existen", async () => {
  const f = expoFalso({ muertos: [tk(2), tk(3)] });
  const sb = sbFalso();
  const r = await enviarPush([tk(1), tk(2), tk(3)], { titulo: "t", cuerpo: "c" }, { fetch: f, sb, log: callado });
  assert.deepEqual(r, { enviadas: 1, fallidas: 2, borrados: 2 });
  assert.deepEqual(sb.borrados, [{ tabla: "push_tokens", col: "token", valores: [tk(2), tk(3)] }]);
});

test("si borrar falla, no lanza y lo dice en borrados: 0", async () => {
  const f = expoFalso({ muertos: [tk(1)] });
  const r = await enviarPush([tk(1)], { titulo: "t", cuerpo: "c" }, { fetch: f, sb: sbFalso({ falla: true }), log: callado });
  assert.equal(r.borrados, 0);
});

test("sin red no lanza: cuenta todo como fallido", async () => {
  const f = expoFalso({ falla: "ECONNRESET" });
  const r = await enviarPush([tk(1), tk(2)], { titulo: "t", cuerpo: "c" }, { fetch: f, log: callado });
  assert.deepEqual(r, { enviadas: 0, fallidas: 2, borrados: 0 });
});

test("una respuesta de error de Expo no lanza", async () => {
  const f = expoFalso({ sinData: true, estado: 400 });
  const r = await enviarPush([tk(1)], { titulo: "t", cuerpo: "c" }, { fetch: f, log: callado });
  assert.deepEqual(r, { enviadas: 0, fallidas: 1, borrados: 0 });
});

/* ---------------- a quién ---------------- */

function sbConsultas(tablas, { falla = false } = {}) {
  const consultas = [];
  return {
    consultas,
    from(tabla) {
      const filtros = [];
      const q = {
        select() { return q; },
        eq(c, v) { filtros.push(["eq", c, v]); return q; },
        in(c, v) { filtros.push(["in", c, v]); return q; },
        then(resolve) {
          consultas.push({ tabla, filtros });
          if (falla) return resolve({ data: null, error: { message: "sin tabla" } });
          const filas = (tablas[tabla] || []).filter((f) =>
            filtros.every(([op, c, v]) => (op === "eq" ? f[c] === v : v.includes(f[c])))
          );
          return resolve({ data: filas, error: null });
        },
      };
      return q;
    },
  };
}

test("los usuarios de un aviso: solo cuentas de cliente ACTIVAS de esas empresas", async () => {
  const sb = sbConsultas({
    perfiles: [
      { id: "u1", rol: "cliente", activo: true, cliente_id: "c1" },
      { id: "u2", rol: "cliente", activo: false, cliente_id: "c1" },
      { id: "u3", rol: "cliente", activo: true, cliente_id: "c2" },
      { id: "u4", rol: "admin", activo: true, cliente_id: null },
    ],
  });
  assert.deepEqual(await usuariosClienteDe(sb, ["c1", "c1"]), ["u1"]);
  assert.deepEqual(await usuariosClienteDe(sb, []), []);
});

test("si no se puede leer a los usuarios, devuelve null (no se sabe), no cero", async () => {
  assert.equal(await usuariosClienteDe(sbConsultas({}, { falla: true }), ["c1"], { log: callado }), null);
});

test("la oficina: dueño y admins activos", async () => {
  const sb = sbConsultas({
    perfiles: [
      { id: "d", rol: "dueno", activo: true },
      { id: "a", rol: "admin", activo: true },
      { id: "a2", rol: "admin", activo: false },
      { id: "o", rol: "operador", activo: true },
    ],
  });
  assert.deepEqual((await usuariosOficina(sb)).sort(), ["a", "d"]);
});

test("tokens de usuarios: sin la tabla (026 sin correr) devuelve [] sin lanzar", async () => {
  const sb = sbConsultas({ push_tokens: [{ usuario_id: "u1", token: tk(1) }, { usuario_id: "u2", token: tk(2) }] });
  assert.deepEqual(await tokensDeUsuarios(sb, ["u1"]), [tk(1)]);
  assert.deepEqual(await tokensDeUsuarios(sbConsultas({}, { falla: true }), ["u1"], { log: callado }), []);
  assert.deepEqual(await tokensDeUsuarios(sb, []), []);
});
