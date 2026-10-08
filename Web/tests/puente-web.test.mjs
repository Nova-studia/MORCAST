import { test } from "node:test";
import assert from "node:assert/strict";
import { destinoPuente, urlPuente, puedeUsarPuente } from "../lib/puente-web.mjs";

test("destinoPuente solo acepta destinos conocidos", () => {
  assert.equal(destinoPuente("portal"), "portal");
  assert.equal(destinoPuente("registro"), "registro");
  for (const malo of ["https://otro.sitio", "//otro", "../admin", "", null, undefined]) {
    assert.equal(destinoPuente(malo), "registro", String(malo));
  }
});

test("urlPuente arma el enlace a /portal/entrar con el token escapado", () => {
  assert.equal(
    urlPuente({ sitio: "https://morcast.mx", hashedToken: "a b&c", destino: "registro" }),
    "https://morcast.mx/portal/entrar?th=a%20b%26c&a=registro"
  );
});

test("solo pendientes y clientes usan el puente", () => {
  assert.equal(puedeUsarPuente("pendiente"), true);
  assert.equal(puedeUsarPuente(undefined), true);
  assert.equal(puedeUsarPuente("cliente"), true);
  for (const r of ["admin", "dueno", "operador"]) assert.equal(puedeUsarPuente(r), false, r);
});
