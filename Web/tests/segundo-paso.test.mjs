import { test } from "node:test";
import assert from "node:assert/strict";
import { mandarCodigo, verificarCodigo, limpiarCodigo, MOTIVOS_2P } from "../lib/segundo-paso.mjs";
import { verificarPase, huellaCodigo, ESPERA_REENVIO_S, MAX_INTENTOS, VIGENCIA_PASE_S } from "../lib/mfa.mjs";

const SECRETO = "secreto-de-prueba";
const callado = { error() {}, warn() {} };
const usuario = { id: "u-adm", email: "admin@morcast.mx" };
const T0 = Date.parse("2026-10-05T18:00:00Z");

/** `codigos_panel` en memoria: lo justo que usa el trámite. */
function sbFalso(inicial = {}) {
  const filas = { ...inicial };
  return {
    filas,
    from() {
      const q = {
        _id: null,
        select() { return q; },
        eq(_c, v) { q._id = v; return q; },
        async maybeSingle() { return { data: filas[q._id] ?? null, error: null }; },
        async upsert(fila) { filas[fila.usuario_id] = { ...fila }; return { error: null }; },
        update(cambio) {
          return { async eq(_c, v) { filas[v] = { ...filas[v], ...cambio }; return { error: null }; } };
        },
        delete() {
          return { async eq(_c, v) { delete filas[v]; return { error: null }; } };
        },
      };
      return q;
    },
  };
}

function correoFalso({ falla = false } = {}) {
  const enviados = [];
  const f = async (d) => {
    if (falla) throw new Error("Resend 500");
    enviados.push(d);
  };
  f.enviados = enviados;
  return f;
}

const base = (extra = {}) => ({ usuario, secreto: SECRETO, hayCorreo: true, produccion: true, log: callado, ahora: T0, ...extra });

test("manda el código, guarda solo su huella y dice a qué correo", async () => {
  const sb = sbFalso();
  const correo = correoFalso();
  const r = await mandarCodigo(base({ sb, mandarCorreo: correo }));
  assert.deepEqual(r, { ok: true, espera: ESPERA_REENVIO_S, correo: "a•••n@morcast.mx" });
  assert.equal(correo.enviados.length, 1);
  const { codigo } = correo.enviados[0];
  assert.match(codigo, /^\d{6}$/);
  assert.equal(sb.filas["u-adm"].huella, await huellaCodigo(codigo, "u-adm", SECRETO));
  assert.ok(!JSON.stringify(sb.filas).includes(codigo), "el código en claro no se guarda");
});

test("no reenvía antes de 60 s: dice cuánto falta", async () => {
  const sb = sbFalso({ "u-adm": { enviado: new Date(T0 - 20_000).toISOString() } });
  const correo = correoFalso();
  const r = await mandarCodigo(base({ sb, mandarCorreo: correo }));
  assert.equal(r.yaEnviado, true);
  assert.equal(r.espera, 40);
  assert.equal(correo.enviados.length, 0);
});

test("sin correo en producción: lo dice claro en vez de dejar esperando", async () => {
  const r = await mandarCodigo(base({ sb: sbFalso(), mandarCorreo: correoFalso(), hayCorreo: false }));
  assert.deepEqual(r, { ok: false, motivo: MOTIVOS_2P.sinCorreo });
});

test("si el correo falla, no dice que salió", async () => {
  const r = await mandarCodigo(base({ sb: sbFalso(), mandarCorreo: correoFalso({ falla: true }) }));
  assert.deepEqual(r, { ok: false, motivo: MOTIVOS_2P.correoFallo });
});

test("sin secreto no hay trámite", async () => {
  const r = await mandarCodigo(base({ sb: sbFalso(), mandarCorreo: correoFalso(), secreto: null }));
  assert.equal(r.ok, false);
});

async function conCodigo() {
  const sb = sbFalso();
  const correo = correoFalso();
  await mandarCodigo(base({ sb, mandarCorreo: correo }));
  return { sb, codigo: correo.enviados[0].codigo };
}

test("el código bueno da un pase de ESTA sesión y se borra (un solo uso)", async () => {
  const { sb, codigo } = await conCodigo();
  const r = await verificarCodigo(base({ sb, sesion: "ses-1", codigo: `${codigo.slice(0, 3)} ${codigo.slice(3)}` }));
  assert.equal(r.ok, true);
  assert.equal(r.vence, Math.floor(T0 / 1000) + VIGENCIA_PASE_S);
  const ahora = Math.floor(T0 / 1000);
  assert.equal(await verificarPase(r.pase, { uid: "u-adm", sesion: "ses-1", ahora }, SECRETO), true);
  assert.equal(await verificarPase(r.pase, { uid: "u-adm", sesion: "ses-2", ahora }, SECRETO), false, "otra sesión");
  assert.equal(await verificarPase(r.pase, { uid: "otro", sesion: "ses-1", ahora }, SECRETO), false, "otro usuario");
  assert.equal(sb.filas["u-adm"], undefined);
  const otraVez = await verificarCodigo(base({ sb, sesion: "ses-1", codigo }));
  assert.deepEqual(otraVez, { ok: false, motivo: MOTIVOS_2P.pideOtro });
});

test("el código malo resta intentos, y al quinto ya no sirve ni el bueno", async () => {
  const { sb, codigo } = await conCodigo();
  const malo = codigo === "000000" ? "111111" : "000000";
  const r1 = await verificarCodigo(base({ sb, sesion: "s", codigo: malo }));
  assert.equal(r1.motivo, `Código incorrecto. Te quedan ${MAX_INTENTOS - 1} intentos.`);
  for (let i = 1; i < MAX_INTENTOS; i++) await verificarCodigo(base({ sb, sesion: "s", codigo: malo }));
  const r = await verificarCodigo(base({ sb, sesion: "s", codigo }));
  assert.deepEqual(r, { ok: false, motivo: MOTIVOS_2P.agotado });
});

test("un código vencido no sirve", async () => {
  const { sb, codigo } = await conCodigo();
  const r = await verificarCodigo(base({ sb, sesion: "s", codigo, ahora: T0 + 11 * 60 * 1000 }));
  assert.deepEqual(r, { ok: false, motivo: MOTIVOS_2P.vencido });
});

test("formato y sesión se revisan antes de tocar la base", async () => {
  assert.deepEqual(await verificarCodigo(base({ sb: sbFalso(), sesion: "s", codigo: "12345" })), { ok: false, motivo: MOTIVOS_2P.formato });
  assert.deepEqual(await verificarCodigo(base({ sb: sbFalso(), sesion: null, codigo: "123456" })), { ok: false, motivo: MOTIVOS_2P.sinSesion });
  assert.equal(limpiarCodigo(" 12-34 56 "), "123456");
  assert.equal(limpiarCodigo(undefined), "");
});
