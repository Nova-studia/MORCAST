import { test } from "node:test";
import assert from "node:assert/strict";
import { nonceCrudo, cifrar, nonceParaGoogle } from "../lib/nonce-google.mjs";

test("el nonce crudo es hexadecimal y del largo pedido", () => {
  const n = nonceCrudo();
  assert.equal(n.length, 64);            // 32 bytes = 64 caracteres hex
  assert.match(n, /^[0-9a-f]+$/);
});

test("dos nonces seguidos NO son iguales", () => {
  assert.notEqual(nonceCrudo(), nonceCrudo());
});

// Vector conocido de SHA-256, para saber que ciframos de verdad y no
// devolvemos cualquier cosa que lo parezca.
test("cifrar() calcula SHA-256 de verdad", async () => {
  assert.equal(
    await cifrar("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
  );
  assert.equal(
    await cifrar(""),
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  );
});

// LA PRUEBA QUE IMPORTA. Si alguien manda el mismo valor a los dos lados, o los
// cruza, Google y Supabase no se ponen de acuerdo y no entra nadie. Aqui se
// fija la relacion: lo de Google es el cifrado de lo de Supabase.
test("paraGoogle es el SHA-256 de paraSupabase, y NO son el mismo valor", async () => {
  const { paraGoogle, paraSupabase } = await nonceParaGoogle();
  assert.notEqual(paraGoogle, paraSupabase);
  assert.equal(paraGoogle, await cifrar(paraSupabase));
  // Y al reves NO se cumple: sirve para cazar el cruce.
  assert.notEqual(paraSupabase, await cifrar(paraGoogle));
});

test("cada llamada da un par distinto", async () => {
  const a = await nonceParaGoogle();
  const b = await nonceParaGoogle();
  assert.notEqual(a.paraSupabase, b.paraSupabase);
  assert.notEqual(a.paraGoogle, b.paraGoogle);
});
