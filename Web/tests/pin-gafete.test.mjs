import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LARGO_PIN,
  llaveDelPin,
  nuevoPin,
  normalizarPin,
  pinLegible,
  cifrarPin,
  descifrarPin,
  pinCorrecto,
} from "../lib/pin-gafete.mjs";

const LLAVE = "una-llave-de-prueba-de-mas-de-32-caracteres";
const CODIGO = "K7M2X9FDQ4";

test("nuevoPin: seis dígitos, y distintos cada vez", () => {
  const vistos = new Set();
  for (let i = 0; i < 200; i++) {
    const pin = nuevoPin();
    assert.match(pin, /^\d{6}$/);
    vistos.add(pin);
  }
  assert.ok(vistos.size > 190, "casi ninguno se repite");
});

test("nuevoPin descarta los bytes que cargarían los dígitos bajos", () => {
  // 250..255 se tiran; el resto da su último dígito.
  const azar = (bytes) => bytes.set([255, 250, 13, 249, 7, 0, 128, 99, 41, 5, 6, 7]) || bytes;
  assert.equal(nuevoPin(azar), "397089");
  assert.equal(LARGO_PIN, 6);
});

test("normalizarPin perdona espacios y guiones, nada más", () => {
  assert.equal(normalizarPin("482 913"), "482913");
  assert.equal(normalizarPin(" 482-913 "), "482913");
  assert.equal(normalizarPin("48291"), null);
  assert.equal(normalizarPin("4829134"), null);
  assert.equal(normalizarPin("48291a"), null);
  assert.equal(normalizarPin(null), null);
  assert.equal(pinLegible("482913"), "482 913");
  assert.equal(pinLegible("x"), "");
});

test("la llave del servidor tiene que existir y ser larga", () => {
  assert.equal(llaveDelPin({}), null);
  assert.equal(llaveDelPin({ PERSONAL_PIN_LLAVE: "corta" }), null);
  assert.equal(llaveDelPin({ PERSONAL_PIN_LLAVE: ` ${LLAVE} ` }), LLAVE);
});

test("cifrar y descifrar: ida y vuelta, y el texto guardado no enseña el PIN", async () => {
  const cifrado = await cifrarPin("482913", CODIGO, LLAVE);
  assert.match(cifrado, /^v1\.[\w-]+\.[\w-]+$/);
  assert.ok(!cifrado.includes("482913"));
  assert.equal(await descifrarPin(cifrado, CODIGO, LLAVE), "482913");
  // Dos veces el mismo PIN no dan el mismo texto: no se ve quién comparte PIN.
  assert.notEqual(await cifrarPin("482913", CODIGO, LLAVE), cifrado);
});

test("con otra llave, otro gafete o un texto roto no sale nada", async () => {
  const cifrado = await cifrarPin("482913", CODIGO, LLAVE);
  assert.equal(await descifrarPin(cifrado, CODIGO, `${LLAVE}x`), null);
  assert.equal(await descifrarPin(cifrado, "ABCDEFGH23", LLAVE), null, "copiado a otro gafete no sirve");
  assert.equal(await descifrarPin(`${cifrado}A`, CODIGO, LLAVE), null);
  assert.equal(await descifrarPin("v2.a.b", CODIGO, LLAVE), null);
  assert.equal(await descifrarPin(null, CODIGO, LLAVE), null);
  assert.equal(await descifrarPin(cifrado, CODIGO, null), null);
});

test("cifrarPin no cifra basura", async () => {
  await assert.rejects(() => cifrarPin("12345", CODIGO, LLAVE));
  await assert.rejects(() => cifrarPin("123456", CODIGO, ""));
  await assert.rejects(() => cifrarPin("123456", "", LLAVE));
});

test("pinCorrecto: solo el PIN de ESE gafete", async () => {
  const cifrado = await cifrarPin("482913", CODIGO, LLAVE);
  assert.equal(await pinCorrecto("482 913", cifrado, CODIGO, LLAVE), true);
  assert.equal(await pinCorrecto("482914", cifrado, CODIGO, LLAVE), false);
  assert.equal(await pinCorrecto("", cifrado, CODIGO, LLAVE), false);
  assert.equal(await pinCorrecto("482913", cifrado, "ABCDEFGH23", LLAVE), false);
  assert.equal(await pinCorrecto("482913", "roto", CODIGO, LLAVE), false);
});
