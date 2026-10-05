import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validarAlta,
  validarFirmante,
  validarConstancia,
  validarFirmaPng,
  tipoPorContenido,
  jsonCanonico,
  sha256Hex,
  armarContenidoFirmado,
  huellaContenido,
  generarToken,
  huellaToken,
  venceToken,
  estadoToken,
  fechaHoraMatamoros,
  folioAlta,
  nombrePdfAlta,
  MAX_CONSTANCIA_BYTES,
  MAX_FIRMA_BYTES,
  VIGENCIA_TOKEN_DIAS,
} from "../lib/alta-firma.mjs";
import { VERSION_TERMINOS, textoTerminos, CLAUSULAS, NOTA_BORRADOR } from "../lib/terminos.mjs";
import { TEXTO_AVISO_PRECIOS } from "../lib/aviso-precios.mjs";
import { pngDePrueba } from "./ayuda-png.mjs";

const CATALOGOS = {
  residuos: ["Residuos de Manejo Especial", "Residuos Peligrosos"],
  equipo: [{ tipo: "Tolvas", medidas: ["21", "30"] }],
  usosCfdi: ["G03 — Gastos en general", "P01 — Por definir"],
  formasPago: ["Transferencia", "Efectivo"],
};

const BUENA = {
  empresa: "  Industrias del Golfo  ",
  contacto: "Ana Pérez",
  telefono: "868 384 9478",
  correo: "Ana@Golfo.MX",
  alias: "Planta 1",
  calle: "Av. Industrial 100",
  colonia: "Parque Industrial",
  cp: "87499",
  referencias: "Portón azul",
  lat: "25.87",
  lng: "-97.50",
  residuos: ["Residuos de Manejo Especial"],
  equipo: [{ tipo: "Tolvas", medida: "30", cantidad: "2" }],
  serviciosPorMes: "8",
  razonSocial: "Industrias del Golfo, S.A. de C.V.",
  rfc: "igo-010101-ab1",
  domicilioFiscal: "Av. Industrial 100, Matamoros",
  usoCFDI: "G03 — Gastos en general",
  formaPago: "Transferencia",
  representanteNombre: "Luis Gómez",
  representanteCargo: "Apoderado legal",
  facturacionNombre: "Cuentas por pagar",
  facturacionCorreo: "CXP@golfo.mx",
  facturacionTelefono: "868 111 2222",
  horarioAcceso: "L-V 8:00 a 17:00, portón 3",
};

/* ------------------------------------------------ validación del alta */

test("un alta completa pasa, recortada y normalizada", () => {
  const r = validarAlta(BUENA, CATALOGOS);
  assert.equal(r.ok, true, r.motivo);
  const l = r.limpia;
  assert.equal(l.empresa, "Industrias del Golfo");
  assert.equal(l.correo, "ana@golfo.mx");
  assert.equal(l.rfc, "IGO010101AB1");
  assert.equal(l.lat, 25.87);
  assert.equal(l.serviciosPorMes, 8);
  assert.deepEqual(l.equipo, [{ tipo: "Tolvas", medida: "30", cantidad: 2 }]);
  assert.equal(l.facturacionCorreo, "cxp@golfo.mx");
  assert.equal(l.horarioAcceso, "L-V 8:00 a 17:00, portón 3");
  assert.equal(l.representanteCargo, "Apoderado legal");
});

test("los campos nuevos son opcionales", () => {
  const sin = { ...BUENA };
  for (const k of ["representanteNombre", "representanteCargo", "facturacionNombre", "facturacionCorreo", "facturacionTelefono", "horarioAcceso"]) delete sin[k];
  const r = validarAlta(sin, CATALOGOS);
  assert.equal(r.ok, true, r.motivo);
  assert.equal(r.limpia.horarioAcceso, "");
});

test("rechaza lo que falta o viene mal, diciendo qué campo", () => {
  const casos = [
    [{ empresa: "" }, "empresa"],
    [{ telefono: "123" }, "telefono"],
    [{ correo: "sin-arroba" }, "correo"],
    [{ cp: "8749" }, "cp"],
    [{ lat: "" }, "mapa"],
    [{ lat: "abc" }, "mapa"],
    [{ residuos: [] }, "residuos"],
    [{ serviciosPorMes: "0" }, "serviciosPorMes"],
    [{ serviciosPorMes: "201" }, "serviciosPorMes"],
    [{ rfc: "XXX" }, "rfc"],
    [{ facturacionCorreo: "no-es-correo" }, "facturacionCorreo"],
    [{ facturacionTelefono: "12" }, "facturacionTelefono"],
  ];
  for (const [cambio, campo] of casos) {
    const r = validarAlta({ ...BUENA, ...cambio }, CATALOGOS);
    assert.equal(r.ok, false, JSON.stringify(cambio));
    assert.equal(r.campo, campo, JSON.stringify(cambio));
  }
});

test("con catálogo, lo que no está en la lista se descarta", () => {
  const r = validarAlta({
    ...BUENA,
    residuos: ["<script>alert(1)</script>", "Residuos Peligrosos", "Residuos Peligrosos"],
    equipo: [
      { tipo: "Tolvas", medida: "99", cantidad: 1 },
      { tipo: "Nave espacial", medida: "30", cantidad: 1 },
      { tipo: "Tolvas", medida: "21", cantidad: 50 },
      { tipo: "Tolvas", medida: "21", cantidad: 3 },
    ],
    usoCFDI: "inventado",
    formaPago: "Bitcoin",
  }, CATALOGOS);
  assert.equal(r.ok, true);
  assert.deepEqual(r.limpia.residuos, ["Residuos Peligrosos"]);
  assert.deepEqual(r.limpia.equipo, [{ tipo: "Tolvas", medida: "21", cantidad: 3 }]);
  // Fuera del catálogo = "lo definimos después" (la facturación es opcional).
  assert.equal(r.limpia.usoCFDI, "");
  assert.equal(r.limpia.formaPago, "");
});

test("recorta textos larguísimos al límite", () => {
  const r = validarAlta({ ...BUENA, empresa: "x".repeat(5000), horarioAcceso: "h".repeat(900) }, CATALOGOS);
  assert.equal(r.limpia.empresa.length, 120);
  assert.equal(r.limpia.horarioAcceso.length, 200);
});

test("el firmante: aceptar, nombre completo; cargo opcional", () => {
  assert.equal(validarFirmante({ nombre: "Ana Pérez", acepta: false }).campo, "acepta");
  assert.equal(validarFirmante({ nombre: "Ana Pérez", acepta: "true" }).campo, "acepta"); // sólo true de verdad
  assert.equal(validarFirmante({ nombre: "Ana", acepta: true }).campo, "firmanteNombre");
  assert.equal(validarFirmante({ nombre: "  ", acepta: true }).campo, "firmanteNombre");
  const r = validarFirmante({ nombre: "  Ana   Pérez López ", cargo: "Gerente de planta", acepta: true });
  assert.deepEqual(r, { ok: true, firmante: { nombre: "Ana Pérez López", cargo: "Gerente de planta" } });
});

/* ------------------------------------------------ archivos */

test("el tipo se lee de los bytes, no del nombre", () => {
  assert.equal(tipoPorContenido(new TextEncoder().encode("%PDF-1.7\n...")), "application/pdf");
  assert.equal(tipoPorContenido(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0])), "image/jpeg");
  assert.equal(tipoPorContenido(pngDePrueba()), "image/png");
  assert.equal(tipoPorContenido(new TextEncoder().encode("<html>")), null);
});

test("la constancia: opcional, máximo 5 MB, sólo PDF/JPG/PNG", () => {
  assert.equal(validarConstancia(null).vacia, true);
  assert.equal(validarConstancia(new TextEncoder().encode("MZ\x90 ejecutable")).ok, false);
  const grande = new Uint8Array(MAX_CONSTANCIA_BYTES + 1);
  grande.set([0x25, 0x50, 0x44, 0x46, 0x2d]);
  assert.equal(validarConstancia(grande).ok, false);
  const r = validarConstancia(new TextEncoder().encode("%PDF-1.4 hola"));
  assert.deepEqual(r, { ok: true, tipo: "application/pdf", extension: "pdf" });
});

test("la firma: PNG real, ni vacío, ni enorme, ni de tamaño raro", () => {
  assert.equal(validarFirmaPng(new Uint8Array(10)).ok, false);
  assert.equal(validarFirmaPng(new TextEncoder().encode("%PDF-".padEnd(500, "x"))).ok, false);
  const r = validarFirmaPng(pngDePrueba(600, 200));
  assert.equal(r.ok, true, r.motivo);
  assert.equal(r.ancho, 600);
  assert.equal(r.alto, 200);
  assert.equal(validarFirmaPng(pngDePrueba(20, 20)).ok, false);
  const enorme = new Uint8Array(MAX_FIRMA_BYTES + 1);
  enorme.set(pngDePrueba().slice(0, 24));
  assert.equal(validarFirmaPng(enorme).ok, false);
});

/* ------------------------------------------------ JSON canónico y huella */

test("el JSON canónico no depende del orden de las llaves", () => {
  const a = { b: 1, a: { y: [3, { q: 1, p: 2 }], x: "z" }, c: null, d: undefined };
  const b = { c: null, a: { x: "z", y: [3, { p: 2, q: 1 }] }, b: 1 };
  assert.equal(jsonCanonico(a), jsonCanonico(b));
  assert.equal(jsonCanonico(a), '{"a":{"x":"z","y":[3,{"p":2,"q":1}]},"b":1,"c":null}');
  // Los arreglos SÍ conservan su orden: [1,2] y [2,1] son cosas distintas.
  assert.notEqual(jsonCanonico([1, 2]), jsonCanonico([2, 1]));
  assert.equal(jsonCanonico({ s: "acentó \"comillas\"" }), '{"s":"acentó \\"comillas\\""}');
});

test("sha256Hex da la huella conocida", async () => {
  assert.equal(await sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(await sha256Hex(new TextEncoder().encode("abc")), await sha256Hex("abc"));
});

const contenidoDePrueba = (datos) => armarContenidoFirmado({
  folio: "ALTA-2026-ABCD",
  origen: "formulario",
  datos,
  terminos: { version: VERSION_TERMINOS, textoSha256: "t".repeat(64) },
  avisoPrivacidad: { version: "2026-09-02", url: "https://morcast.mx/aviso-de-privacidad" },
  firma: { imagenSha256: "f".repeat(64), nombre: "Ana Pérez", cargo: "Gerente" },
  constancia: null,
  evidencia: { fechaIso: "2026-10-05T20:00:00.000Z", ip: "1.2.3.4", navegador: "Prueba/1.0", correo: "ana@golfo.mx" },
});

test("la huella del contenido es estable ante el orden y cambia con un solo dato", async () => {
  const limpia = validarAlta(BUENA, CATALOGOS).limpia;
  const alReves = Object.fromEntries(Object.entries(limpia).reverse());
  const h1 = await huellaContenido(contenidoDePrueba(limpia));
  const h2 = await huellaContenido(contenidoDePrueba(alReves));
  assert.match(h1, /^[0-9a-f]{64}$/);
  assert.equal(h1, h2);
  // Lo que guarda la base (jsonb) vuelve con otro orden: la huella se recalcula igual.
  const deLaBase = JSON.parse(JSON.stringify(contenidoDePrueba(alReves)));
  assert.equal(await huellaContenido(deLaBase), h1);
  const h3 = await huellaContenido(contenidoDePrueba({ ...limpia, serviciosPorMes: 9 }));
  assert.notEqual(h1, h3);
  const c = contenidoDePrueba(limpia);
  c.evidencia.ip = "9.9.9.9";
  assert.notEqual(await huellaContenido(c), h1);
});

/* ------------------------------------------------ token */

test("el token: 43 caracteres de azar, distinto cada vez, y se guarda su huella", async () => {
  const t1 = generarToken();
  const t2 = generarToken();
  assert.match(t1, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(t1, t2);
  const h = await huellaToken(t1);
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(h, await huellaToken(t1));
  assert.notEqual(h, t1);
  assert.equal(await huellaToken("basura"), null);
  assert.equal(await huellaToken(`${t1}x`), null);
  assert.equal(await huellaToken(undefined), null);
});

test("el token vence a los 7 días y es de un solo uso", () => {
  const ahora = new Date("2026-10-05T12:00:00Z");
  const vence = venceToken(ahora);
  assert.equal(vence.getTime() - ahora.getTime(), VIGENCIA_TOKEN_DIAS * 86400000);
  const fila = { correoConfirmado: false, huella: "h", vence: vence.toISOString() };
  assert.equal(estadoToken(fila, ahora), "vigente");
  assert.equal(estadoToken(fila, new Date(vence.getTime() - 1)), "vigente");
  assert.equal(estadoToken(fila, vence), "vencido");
  assert.equal(estadoToken({ ...fila, correoConfirmado: true }, ahora), "confirmado");
  assert.equal(estadoToken({ correoConfirmado: false, huella: null, vence: null }, ahora), "invalido");
});

/* ------------------------------------------------ fechas, folio, términos */

test("la fecha de la evidencia sale en hora de Matamoros", () => {
  // 20:00 UTC del 5-oct = 15:00 en Matamoros (horario de verano de EE.UU., UTC-5).
  const t = fechaHoraMatamoros(new Date("2026-10-05T20:00:00Z"));
  assert.match(t, /5 de octubre de 2026/);
  assert.match(t, /15:00:00/);
  assert.match(t, /GMT-05:00/);
  // En diciembre ya es UTC-6.
  assert.match(fechaHoraMatamoros(new Date("2026-12-05T20:00:00Z")), /14:00:00.*GMT-06:00/);
});

test("folio legible y nombre del PDF seguro", () => {
  assert.match(folioAlta("ALTA", new Date("2026-10-05T12:00:00Z")), /^ALTA-2026-[A-HJKMNP-Z2-9]{4}$/);
  assert.match(folioAlta("REG"), /^REG-\d{4}-/);
  assert.equal(nombrePdfAlta("ALTA-2026-AB12"), "solicitud-ALTA-2026-AB12.pdf");
  assert.equal(nombrePdfAlta("ALTA-2026-AB12", { final: true }), "solicitud-ALTA-2026-AB12-confirmada.pdf");
  assert.equal(nombrePdfAlta("../x/y"), "solicitud-xy.pdf");
});

test("los términos: versión borrador, aviso de precios EXACTO y nota visible", () => {
  assert.match(VERSION_TERMINOS, /borrador/);
  const t = textoTerminos();
  assert.ok(t.includes(TEXTO_AVISO_PRECIOS), "el aviso de precios va palabra por palabra");
  assert.ok(t.includes(NOTA_BORRADOR));
  assert.ok(t.includes("No procedió"));
  assert.ok(t.includes("Matamoros, Tamaulipas"));
  assert.ok(t.includes("morcast.mx/aviso-de-privacidad"));
  assert.ok(CLAUSULAS.length >= 15);
  // Prudencia: el borrador no cita artículos de ley.
  assert.doesNotMatch(t, /art[íi]culo\s+\d|arts?\.\s*\d/i);
});

test("el archivo de términos devuelve la versión firmada, o null si ya no está", async () => {
  const { terminosDeVersion, terminosVigentes } = await import("../lib/terminos.mjs");
  assert.deepEqual(terminosDeVersion(VERSION_TERMINOS), terminosVigentes());
  assert.equal(terminosDeVersion("1999-01-v0"), null);
  // La huella del texto es estable: es lo que se compara al emitir el PDF final.
  assert.equal(await sha256Hex(textoTerminos(terminosDeVersion(VERSION_TERMINOS))), await sha256Hex(textoTerminos()));
});

/**
 * La huella del texto de CADA versión archivada, fijada a mano. Si alguien
 * retoca el texto de una versión que ya firmaron clientes (en vez de publicar
 * una nueva), esta prueba truena. Al publicar una versión nueva se agrega su
 * huella aquí.
 */
const HUELLAS_TERMINOS = {
  "2026-10-v1-borrador": "7d6d05ca813389b66864b762678731194699d73c9629130cb3003275bdd886b8",
};

test("cada versión archivada de los términos conserva exactamente su texto", async () => {
  const { VERSIONES_ARCHIVADAS, terminosDeVersion } = await import("../lib/terminos.mjs");
  assert.deepEqual([...VERSIONES_ARCHIVADAS].sort(), Object.keys(HUELLAS_TERMINOS).sort(),
    "cada versión archivada necesita su huella fijada en esta prueba");
  for (const v of VERSIONES_ARCHIVADAS) {
    const t = terminosDeVersion(v);
    assert.equal(await sha256Hex(textoTerminos(t)), HUELLAS_TERMINOS[v], `cambió el texto de la versión ${v}`);
    assert.ok(t.avisoPrecios && t.clausulas.some((c) => c.parrafos.includes(t.avisoPrecios)),
      `la versión ${v} trae su propia copia del aviso de precios`);
    assert.ok(Object.isFrozen(t) && Object.isFrozen(t.clausulas[0].parrafos), "la versión archivada está congelada");
  }
});

test("el aviso de precios vivo coincide con el congelado en la versión vigente", async () => {
  const { terminosVigentes } = await import("../lib/terminos.mjs");
  // Si esto truena: cambió el aviso de la pantalla. Publica una versión
  // NUEVA de los términos con el aviso nuevo; no edites la vigente.
  assert.equal(terminosVigentes().avisoPrecios, TEXTO_AVISO_PRECIOS);
});

test("el choque de llave repetida se distingue por el índice", async () => {
  const { tipoDeChoque } = await import("../lib/alta-firma.mjs");
  assert.equal(tipoDeChoque({ code: "23505", message: 'duplicate key value violates unique constraint "solicitudes_alta_folio_key"' }), "folio");
  assert.equal(tipoDeChoque({ code: "23505", message: "duplicate key", details: "Key (folio)=(ALTA-2026-AB12) already exists." }), "folio");
  assert.equal(tipoDeChoque({ code: "23505", message: 'duplicate key value violates unique constraint "solicitudes_alta_usuario_idx"' }), "usuario");
  assert.equal(tipoDeChoque({ code: "23505", message: 'duplicate key value violates unique constraint "otra_cosa"' }), null);
  assert.equal(tipoDeChoque({ code: "23503", message: "solicitudes_alta_folio_key" }), null);
  assert.equal(tipoDeChoque(null), null);
});

test("el peor caso del formulario cabe holgado bajo el tope de 4.5 MB de Vercel", async () => {
  const { MAX_DATOS_JSON, LIMITE_CUERPO_VERCEL } = await import("../lib/alta-firma.mjs");
  const camposSueltos = 4 * 1024; // firmante, cargo, "acepta"
  const sobreMultipart = 20 * 1024; // límites y cabeceras de cada parte
  const peor = MAX_CONSTANCIA_BYTES + MAX_FIRMA_BYTES + MAX_DATOS_JSON + camposSueltos + sobreMultipart;
  assert.ok(peor < LIMITE_CUERPO_VERCEL - 256 * 1024, `el peor caso (${peor} bytes) queda pegado al tope`);
  assert.equal(MAX_CONSTANCIA_BYTES, 3.5 * 1024 * 1024);
});

test("la facturación es opcional: sin razón social, RFC ni domicilio fiscal, pasa", () => {
  const r = validarAlta(
    { ...BUENA, razonSocial: "", rfc: "", domicilioFiscal: "", usoCFDI: "", formaPago: "" },
    CATALOGOS
  );
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.limpia.rfc, "");
});

test("pero un RFC escrito mal no pasa", () => {
  const r = validarAlta({ ...BUENA, rfc: "ABC123" }, CATALOGOS);
  assert.equal(r.ok, false);
  assert.equal(r.campo, "rfc");
});
