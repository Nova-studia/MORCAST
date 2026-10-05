import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mfaPanelActivo,
  necesitaVerificar,
  firmarPase,
  verificarPase,
  sesionDelToken,
  generarCodigo,
  huellaCodigo,
  ocultarCorreo,
  secretoPanel,
} from "../lib/mfa.mjs";

const SECRETO = "secreto-de-prueba";
const ahora = 1_800_000_000;

test("dueño y admin sin pase tienen que verificar; con pase, entran", () => {
  assert.equal(necesitaVerificar({ rol: "dueno", paseValido: false }), true);
  assert.equal(necesitaVerificar({ rol: "admin", paseValido: false }), true);
  assert.equal(necesitaVerificar({ rol: "admin", paseValido: true }), false);
});

test("clientes y choferes no pasan por aquí", () => {
  for (const rol of ["cliente", "operador", "pendiente", null]) {
    assert.equal(necesitaVerificar({ rol, paseValido: false }), false, String(rol));
  }
});

test("solo se apaga escribiendo 'apagado' a propósito", () => {
  assert.equal(mfaPanelActivo({}), true);
  assert.equal(mfaPanelActivo({ MFA_PANEL: "encendido" }), true);
  assert.equal(mfaPanelActivo({ MFA_PANEL: " Apagado " }), false);
});

test("el secreto: el propio si existe, si no la llave de servicio", () => {
  assert.equal(secretoPanel({ PANEL_2P_SECRETO: "a", SUPABASE_SERVICE_ROLE_KEY: "b" }), "a");
  assert.equal(secretoPanel({ SUPABASE_SERVICE_ROLE_KEY: "b" }), "b");
  assert.equal(secretoPanel({}), null);
});

test("un pase bueno vale para su usuario y su sesión", async () => {
  const pase = await firmarPase({ uid: "u1", sesion: "s1", vence: ahora + 60 }, SECRETO);
  assert.equal(await verificarPase(pase, { uid: "u1", sesion: "s1", ahora }, SECRETO), true);
});

test("el pase NO sirve en otra sesión, para otra persona, vencido o con otro secreto", async () => {
  const pase = await firmarPase({ uid: "u1", sesion: "s1", vence: ahora + 60 }, SECRETO);
  assert.equal(await verificarPase(pase, { uid: "u1", sesion: "s2", ahora }, SECRETO), false);
  assert.equal(await verificarPase(pase, { uid: "u2", sesion: "s1", ahora }, SECRETO), false);
  assert.equal(await verificarPase(pase, { uid: "u1", sesion: "s1", ahora: ahora + 61 }, SECRETO), false);
  assert.equal(await verificarPase(pase, { uid: "u1", sesion: "s1", ahora }, "otro"), false);
});

test("un pase alterado a mano no pasa", async () => {
  const pase = await firmarPase({ uid: "u1", sesion: "s1", vence: ahora + 60 }, SECRETO);
  const [, firma] = pase.split(".");
  const falso = Buffer.from(JSON.stringify({ u: "u1", s: "s1", v: ahora + 999999 })).toString("base64url");
  assert.equal(await verificarPase(`${falso}.${firma}`, { uid: "u1", sesion: "s1", ahora }, SECRETO), false);
  for (const basura of ["", "x", "a.b", null, undefined]) {
    assert.equal(await verificarPase(basura, { uid: "u1", sesion: "s1", ahora }, SECRETO), false);
  }
});

test("sin secreto no se reconoce ningún pase", async () => {
  const pase = await firmarPase({ uid: "u1", sesion: "s1", vence: ahora + 60 }, SECRETO);
  assert.equal(await verificarPase(pase, { uid: "u1", sesion: "s1", ahora }, null), false);
});

test("lee el session_id del token de Supabase", () => {
  const carga = Buffer.from(JSON.stringify({ sub: "u1", session_id: "abc" })).toString("base64url");
  assert.equal(sesionDelToken(`x.${carga}.y`), "abc");
  assert.equal(sesionDelToken("basura"), null);
});

test("el código tiene 6 dígitos y la huella depende del usuario", async () => {
  for (let i = 0; i < 50; i++) assert.match(generarCodigo(), /^\d{6}$/);
  const a = await huellaCodigo("123456", "u1", SECRETO);
  assert.equal(a, await huellaCodigo("123456", "u1", SECRETO));
  assert.notEqual(a, await huellaCodigo("123456", "u2", SECRETO));
  assert.notEqual(a, await huellaCodigo("123457", "u1", SECRETO));
});

test("el correo se enseña tapado", () => {
  assert.equal(ocultarCorreo("luisye85@gmail.com"), "l••••••5@gmail.com");
  assert.equal(ocultarCorreo("ab@x.mx"), "a•@x.mx");
  assert.equal(ocultarCorreo(""), "tu correo");
});
