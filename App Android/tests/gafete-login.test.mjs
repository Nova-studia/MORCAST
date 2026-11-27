// Entrar con el gafete: la parte pura de la app (src/gafete-login.mjs).
// La misma prueba vive en la otra app: las dos llevan el mismo archivo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import * as web from "../../Web/lib/gafete-acceso.mjs";
import {
  TEXTOS_GAFETE,
  MAX_FALLOS_TELEFONO,
  LLAVE_TELEFONO,
  datosDelTag,
  opcionGafete,
  nuevoSecreto,
} from "../src/gafete-login.mjs";

// Un registro NDEF de URI como lo entrega react-native-nfc-manager:
// tnf 1, tipo "U" (0x55), primer byte = prefijo (0x04 = "https://").
const registroUri = (resto, prefijo = 0x04) => ({
  tnf: 1,
  type: [0x55],
  payload: [prefijo, ...[...resto].map((c) => c.charCodeAt(0))],
});

test("los textos y el tope son palabra por palabra los de la web", () => {
  assert.deepEqual(TEXTOS_GAFETE, web.TEXTOS_GAFETE);
  assert.equal(MAX_FALLOS_TELEFONO, web.MAX_FALLOS_TELEFONO);
});

test("del chip salen el código del enlace y la serie normalizada", () => {
  const tag = { id: "04a1b2c3d4e5f6", ndefMessage: [registroUri("morcast.mx/g/MNPQRS2345")] };
  assert.deepEqual(datosDelTag(tag), { codigo: "MNPQRS2345", serie: "04A1B2C3D4E5F6" });
});

test("con prefijo https://www. y con el enlace escrito completo también", () => {
  assert.equal(datosDelTag({ id: "04A1B2C3D4E5F6", ndefMessage: [registroUri("morcast.mx/g/MNPQRS2345", 0x02)] }).codigo, "MNPQRS2345");
  assert.equal(datosDelTag({ id: "04A1B2C3D4E5F6", ndefMessage: [registroUri("https://morcast.mx/g/MNPQRS2345", 0x00)] }).codigo, "MNPQRS2345");
});

test("un chip de otro sitio no es un gafete", () => {
  assert.equal(datosDelTag({ id: "04A1B2C3D4E5F6", ndefMessage: [registroUri("otro.mx/g/MNPQRS2345")] }), null);
  assert.equal(datosDelTag({ id: "04A1B2C3D4E5F6", ndefMessage: [] }), null);
  assert.equal(datosDelTag(null), null);
});

test("sin serie (iPhone que no la da) el código sirve y la serie va null", () => {
  assert.deepEqual(datosDelTag({ ndefMessage: [registroUri("morcast.mx/g/MNPQRS2345")] }), { codigo: "MNPQRS2345", serie: null });
});

test("qué enseña el botón del gafete", () => {
  assert.equal(opcionGafete({ hayNfc: false, nfcEncendido: false, bloqueadoLocal: false }), "oculta");
  assert.equal(opcionGafete({ hayNfc: true, nfcEncendido: false, bloqueadoLocal: false }), "enciende");
  assert.equal(opcionGafete({ hayNfc: true, nfcEncendido: true, bloqueadoLocal: true }), "usaCorreo");
  assert.equal(opcionGafete({ hayNfc: true, nfcEncendido: true, bloqueadoLocal: false }), "lista");
});

test("el secreto del teléfono son 32 bytes en base64url (43 caracteres)", () => {
  const s = nuevoSecreto(new Uint8Array(32).fill(255));
  assert.equal(s.length, 43);
  assert.match(s, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(web.validarPeticion({
    codigo: "MNPQRS2345", serie: null, dispositivoId: "11111111-1111-4111-8111-111111111111", secreto: s,
  }).ok, true);
});

test("cerrar sesión NO borra la identidad del teléfono (se vuelve a entrar con el gafete)", () => {
  const fuente = readFileSync(new URL("../src/sesion.js", import.meta.url), "utf8");
  const salir = fuente.slice(fuente.indexOf("export async function salir"));
  assert.ok(!salir.includes(LLAVE_TELEFONO) && !/olvidarTelefono|borrarIdentidad/.test(salir));
});

test("gafete-login.mjs es idéntico en las dos apps", (t) => {
  const otra = new URL("../../App IOS/src/gafete-login.mjs", import.meta.url);
  let fuenteIos;
  try { fuenteIos = readFileSync(otra, "utf8"); } catch { return t.skip("no está App IOS junto a esta app"); }
  assert.equal(readFileSync(new URL("../src/gafete-login.mjs", import.meta.url), "utf8").replace(/\r\n/g, "\n"), fuenteIos.replace(/\r\n/g, "\n"));
});
