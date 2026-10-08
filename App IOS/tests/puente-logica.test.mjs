import { test } from "node:test";
import assert from "node:assert/strict";
import { resultadoPuente } from "../src/puente-logica.mjs";

test("con enlace https bueno, se abre ese enlace", () => {
  assert.deepEqual(resultadoPuente({ ok: true, url: "https://morcast.mx/portal/entrar?th=x&a=registro" }),
    { abrir: "https://morcast.mx/portal/entrar?th=x&a=registro" });
});

test("si falla, NUNCA se abre el login con contraseña: se dice qué pasó para reintentar", () => {
  for (const r of [{ ok: false, motivo: "Sin red" }, { ok: true, url: "http://inseguro" }, { ok: true }, null]) {
    const x = resultadoPuente(r);
    assert.equal(x.abrir, undefined, JSON.stringify(r));
    assert.match(x.motivo, /.+/);
    assert.match(x.motivo, /otra vez/);
  }
});
