import { test } from "node:test";
import assert from "node:assert/strict";
import { soporteNfc, enlaceDelChip, textoDeError, crearGrabador, chipDudoso } from "../lib/chip-nfc.mjs";

const ENLACE = "https://morcast.mx/g/K7M2X9FDQ4";
const OTRO = "https://morcast.mx/g/ABCDEFGH23";

const error = (name) => Object.assign(new Error(name), { name });
// Serie de 7 bytes, como la de un NTAG213/215.
const SERIE = "04:a2:2b:6a:1c:5d:80";
const chipCon = (url, serialNumber = SERIE) => ({
  serialNumber,
  message: { records: url ? [{ recordType: "url", data: new TextEncoder().encode(url) }] : [] },
});

/**
 * Un NDEFReader de mentiras: apunta lo que se le pide y falla donde la
 * prueba le diga (`fallas.scan`, `fallas.write`, `fallas.makeReadOnly`).
 */
function lectorFalso(fallas = {}) {
  const llamadas = [];
  let instancia = null;
  class Lector {
    constructor() {
      instancia = this;
    }
    async scan() {
      llamadas.push(["scan"]);
      if (fallas.scan) throw fallas.scan;
    }
    async write(mensaje, opciones) {
      llamadas.push(["write", mensaje.records[0].data, opciones.overwrite]);
      if (fallas.write === "colgado") await colgado(opciones.signal);
      else if (fallas.write) throw fallas.write;
    }
    async makeReadOnly(opciones) {
      llamadas.push(["makeReadOnly"]);
      if (fallas.makeReadOnly === "colgado") await colgado(opciones.signal);
      else if (fallas.makeReadOnly) throw fallas.makeReadOnly;
    }
  }
  return { Lector, llamadas, fallas, acercar: (chip) => instancia.onreading(chip), lector: () => instancia };
}

/** Como una tarjeta que nunca llega: solo termina cuando se corta. */
const colgado = (signal) =>
  new Promise((_, rechaza) => signal.addEventListener("abort", () => rechaza(error("AbortError"))));

function armar({ fallas, sellar = true } = {}) {
  const f = lectorFalso(fallas);
  const pasos = [];
  const grabador = crearGrabador({
    Lector: f.Lector,
    enlace: ENLACE,
    sellar,
    esperaMs: 20,
    alEstado: (e) => pasos.push(e),
  });
  return { ...f, pasos, grabador, nombres: () => pasos.map((p) => p.paso) };
}

test("soporteNfc: solo con NDEFReader y en https", () => {
  assert.deepEqual(soporteNfc({ NDEFReader: class {}, isSecureContext: true }), { ok: true, motivo: null });
  assert.equal(soporteNfc({ isSecureContext: true }).motivo, "sin-nfc");
  assert.equal(soporteNfc({ NDEFReader: class {}, isSecureContext: false }).motivo, "sin-https");
  assert.equal(soporteNfc(undefined).ok, typeof globalThis.NDEFReader === "function");
});

test("enlaceDelChip lee el enlace y no se traga otra cosa", () => {
  assert.equal(enlaceDelChip(chipCon(ENLACE).message), ENLACE);
  assert.equal(enlaceDelChip(chipCon(null).message), null);
  assert.equal(enlaceDelChip({ records: [{ recordType: "text", data: new TextEncoder().encode("hola") }] }), null);
  assert.equal(enlaceDelChip(undefined), null);
});

test("chip en blanco: se graba el enlace y se sella", async () => {
  const t = armar();
  assert.equal(await t.grabador.iniciar(), true);
  await t.acercar(chipCon(null));
  assert.deepEqual(t.nombres(), ["pidiendo", "esperando", "grabando", "sellando", "hecho"]);
  assert.deepEqual(t.llamadas, [["scan"], ["write", ENLACE, true], ["makeReadOnly"]]);
  assert.deepEqual(t.pasos.at(-1), { paso: "hecho", sellado: true, yaEstaba: false, serie: SERIE });
});

test("sin sellar (modo de prueba) no se llama a makeReadOnly", async () => {
  const t = armar({ sellar: false });
  await t.grabador.iniciar();
  await t.acercar(chipCon(null));
  assert.deepEqual(t.llamadas, [["scan"], ["write", ENLACE, true]]);
  assert.equal(t.pasos.at(-1).sellado, false);
});

test("un chip que ya trae OTRO gafete no se toca sin permiso", async () => {
  const t = armar();
  await t.grabador.iniciar();
  await t.acercar(chipCon(OTRO));
  assert.deepEqual(t.pasos.at(-1), { paso: "otro-gafete", codigo: "ABCDEFGH23" });
  assert.deepEqual(t.llamadas, [["scan"]]);

  t.grabador.grabarEncima();
  await t.acercar(chipCon(OTRO));
  assert.deepEqual(t.llamadas, [["scan"], ["write", ENLACE, true], ["makeReadOnly"]]);
  assert.equal(t.pasos.at(-1).paso, "hecho");
});

test("un chip con un enlace cualquiera (no de gafete) sí se regraba", async () => {
  const t = armar();
  await t.grabador.iniciar();
  await t.acercar(chipCon("https://ejemplo.com/promo"));
  assert.equal(t.pasos.at(-1).paso, "hecho");
  assert.equal(t.llamadas[1][0], "write");
});

test("si la tarjeta se movió al grabar, basta volver a acercarla", async () => {
  const t = armar({ fallas: { write: error("NetworkError") } });
  await t.grabador.iniciar();
  await t.acercar(chipCon(null));
  assert.equal(t.pasos.at(-1).paso, "reintenta");
  assert.match(t.pasos.at(-1).motivo, /se movió/);
  assert.ok(!t.llamadas.some((l) => l[0] === "makeReadOnly"), "no se sella lo que no se grabó");

  t.fallas.write = null;
  await t.acercar(chipCon(null));
  assert.equal(t.pasos.at(-1).paso, "hecho");
});

test("grabado pero sin sellar: al volver a acercarla solo se sella", async () => {
  const t = armar({ fallas: { makeReadOnly: error("NetworkError") } });
  await t.grabador.iniciar();
  await t.acercar(chipCon(null));
  assert.equal(t.pasos.at(-1).paso, "falta-sellar");

  t.fallas.makeReadOnly = null;
  await t.acercar(chipCon(ENLACE)); // ahora el chip ya trae el enlace
  assert.equal(t.llamadas.filter((l) => l[0] === "write").length, 1, "no se regraba");
  assert.deepEqual(t.pasos.at(-1), { paso: "hecho", sellado: true, yaEstaba: true, serie: SERIE });
});

test("nunca se sella un chip que trae otra cosa", async () => {
  // Quedó pendiente el sello y acercan OTRA tarjeta, de otro gafete.
  const t = armar({ fallas: { makeReadOnly: error("NetworkError") } });
  await t.grabador.iniciar();
  await t.acercar(chipCon(null));
  t.fallas.makeReadOnly = null;
  const antes = t.llamadas.length;
  await t.acercar(chipCon(OTRO));
  assert.equal(t.pasos.at(-1).paso, "otro-gafete");
  assert.equal(t.llamadas.length, antes);
});

test("si la tarjeta no llega, el paso se corta solo", async () => {
  const t = armar({ fallas: { write: "colgado" } });
  await t.grabador.iniciar();
  await t.acercar(chipCon(null));
  assert.equal(t.pasos.at(-1).paso, "reintenta");
  assert.match(t.pasos.at(-1).motivo, /Se acabó el tiempo/);
});

test("mientras graba una tarjeta no atiende otra lectura", async () => {
  const t = armar({ fallas: { write: "colgado" } });
  await t.grabador.iniciar();
  const primera = t.acercar(chipCon(null));
  await t.acercar(chipCon(null));
  await primera;
  assert.equal(t.llamadas.filter((l) => l[0] === "write").length, 1);
});

test("sin permiso de NFC no arranca, y lo dice", async () => {
  const t = armar({ fallas: { scan: error("NotAllowedError") } });
  assert.equal(await t.grabador.iniciar(), false);
  assert.deepEqual(t.nombres(), ["pidiendo", "error"]);
  assert.match(t.pasos.at(-1).motivo, /permiso/);
});

test("un chip que no se puede leer avisa qué chip hace falta", async () => {
  const t = armar();
  await t.grabador.iniciar();
  t.lector().onreadingerror();
  assert.equal(t.pasos.at(-1).paso, "reintenta");
  assert.match(t.pasos.at(-1).motivo, /NTAG213/);
});

test("terminada o detenida, ya no hace nada", async () => {
  const t = armar();
  await t.grabador.iniciar();
  await t.acercar(chipCon(null));
  const pasos = t.pasos.length;
  const llamadas = t.llamadas.length;
  await t.acercar(chipCon(null)); // otra tarjeta en blanco, por descuido
  assert.equal(t.llamadas.length, llamadas, "no graba una segunda tarjeta");

  t.grabador.detener();
  await t.acercar(chipCon(ENLACE));
  t.grabador.grabarEncima();
  assert.equal(t.pasos.length, pasos, "detenido no avisa");
});

test("detener corta el paso que estaba a medias", async () => {
  const t = armar({ fallas: { write: "colgado" } });
  await t.grabador.iniciar();
  const lectura = t.acercar(chipCon(null));
  t.grabador.detener();
  await lectura;
  assert.equal(t.pasos.at(-1).paso, "grabando", "ya no avisa después de detener");
});

test("chipDudoso: una serie de 4 bytes delata un MIFARE Classic", () => {
  assert.equal(chipDudoso("a1:b2:c3:d4"), true);
  assert.equal(chipDudoso("A1-B2-C3-D4"), true);
  assert.equal(chipDudoso(SERIE), false, "7 bytes: NTAG o Ultralight");
  assert.equal(chipDudoso("e0:04:01:50:2a:3b:4c:5d"), false, "8 bytes: no se opina");
  assert.equal(chipDudoso(""), false, "sin serie no se opina");
  assert.equal(chipDudoso(undefined), false);
});

test("un chip que parece MIFARE Classic no se graba ni se sella sin permiso", async () => {
  const t = armar();
  await t.grabador.iniciar();
  await t.acercar(chipCon(null, "a1:b2:c3:d4"));
  assert.deepEqual(t.pasos.at(-1), { paso: "chip-dudoso", serie: "a1:b2:c3:d4" });
  assert.deepEqual(t.llamadas, [["scan"]], "no se le escribió nada");

  // Aunque ya traiga el enlace correcto: sellarlo no se deshace.
  await t.acercar(chipCon(ENLACE, "a1:b2:c3:d4"));
  assert.equal(t.pasos.at(-1).paso, "chip-dudoso");
  assert.deepEqual(t.llamadas, [["scan"]]);

  t.grabador.grabarAunque();
  assert.equal(t.pasos.at(-1).paso, "esperando");
  await t.acercar(chipCon(null, "a1:b2:c3:d4"));
  assert.deepEqual(t.llamadas, [["scan"], ["write", ENLACE, true], ["makeReadOnly"]]);
  assert.equal(t.pasos.at(-1).paso, "hecho");
});

test("textoDeError distingue el paso", () => {
  assert.match(textoDeError(error("NotReadableError"), "iniciar"), /apagado/);
  assert.match(textoDeError(error("NotSupportedError"), "iniciar"), /no tiene NFC/);
  assert.match(textoDeError(error("NotAllowedError"), "grabar"), /sellado/);
  assert.match(textoDeError(error("NotSupportedError"), "grabar"), /NTAG213, NTAG215 o NTAG216/);
  assert.match(textoDeError(error("NotSupportedError"), "sellar"), /no se dejó sellar/);
  assert.match(textoDeError(error("Raro"), "grabar"), /\(Raro\)/);
});
