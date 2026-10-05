import { test } from "node:test";
import assert from "node:assert/strict";
import zlib from "node:zlib";
import { generarPdfAlta } from "../lib/alta-pdf.mjs";
import { validarAlta, fechaHoraMatamoros, sha256Hex } from "../lib/alta-firma.mjs";
import { VERSION_TERMINOS, NOTA_BORRADOR, CLAUSULAS, textoTerminos } from "../lib/terminos.mjs";
import { TEXTO_AVISO_PRECIOS } from "../lib/aviso-precios.mjs";
import { pngDePrueba } from "./ayuda-png.mjs";

/**
 * Saca el texto de un PDF de jsPDF: infla cada flujo comprimido y junta lo
 * que va entre paréntesis antes de `Tj`. Las fuentes estándar escriben en
 * WinAnsi, que para los acentos del español coincide con latin1.
 */
function textoDelPdf(bytes) {
  const crudo = Buffer.from(bytes).toString("latin1");
  const flujos = [...crudo.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)];
  let texto = "";
  for (const [, f] of flujos) {
    let plano;
    try { plano = zlib.inflateSync(Buffer.from(f, "latin1")).toString("latin1"); } catch { continue; }
    for (const m of plano.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) {
      texto += m[1].replace(/\\([()\\])/g, "$1") + "\n";
    }
  }
  return texto;
}

const limpia = validarAlta({
  empresa: "Industrias del Golfo", contacto: "Ana Pérez", telefono: "868 384 9478", correo: "ana@golfo.mx",
  alias: "Planta 1", calle: "Av. Industrial 100", colonia: "Parque Industrial", cp: "87499",
  referencias: "Portón azul", lat: 25.87, lng: -97.5,
  residuos: ["Residuos de Manejo Especial"], equipo: [{ tipo: "Tolvas", medida: "30", cantidad: 2 }],
  serviciosPorMes: 8, razonSocial: "Industrias del Golfo, S.A. de C.V.", rfc: "IGO010101AB1",
  domicilioFiscal: "Av. Industrial 100, Matamoros", usoCFDI: "G03 — Gastos en general", formaPago: "Transferencia",
  representanteNombre: "Luis Gómez", representanteCargo: "Apoderado legal",
  facturacionNombre: "Cuentas por pagar", facturacionCorreo: "cxp@golfo.mx", facturacionTelefono: "8681112222",
  horarioAcceso: "L-V 8:00 a 17:00, portón 3",
}).limpia;

const base = async (confirmacion) => ({
  alta: { ...limpia, folio: "ALTA-2026-PRUE", enCobertura: true, rutasQueCubren: ["R-01"] },
  firmante: { nombre: "Ana Pérez López", cargo: "Gerente de planta" },
  firmaPng: pngDePrueba(600, 200),
  firmaTamano: { ancho: 600, alto: 200 },
  evidencia: {
    fechaTexto: fechaHoraMatamoros(new Date("2026-10-05T20:00:00Z")),
    fechaIso: "2026-10-05T20:00:00.000Z",
    ip: "201.150.10.20",
    navegador: "Mozilla/5.0 (prueba)",
    origen: "formulario",
    terminosVersion: VERSION_TERMINOS,
    terminosHuella: await sha256Hex(textoTerminos()),
    avisoVersion: "2026-09-02",
    contenidoHuella: "a".repeat(64),
    firmaHuella: "b".repeat(64),
    constancia: { sha256: "c".repeat(64), tipo: "application/pdf", bytes: 120000 },
    confirmacion,
  },
  terminos: { version: VERSION_TERMINOS, nota: NOTA_BORRADOR, clausulas: CLAUSULAS },
  avisoPrecios: TEXTO_AVISO_PRECIOS,
  emisor: {
    razonSocial: "Morcast del Norte, S.A. de C.V.",
    domicilioLinea: "Calle 16 y González #1601, Zona Centro, C.P. 87300, Heroica Matamoros, Tamps.",
    telefonos: ["868 384 9478"], correo: "contacto@morcast.mx", sitio: "https://morcast.mx",
  },
});

test("el PDF se genera en Node con todas sus secciones", async () => {
  const bytes = await generarPdfAlta(await base({ estado: "pendiente" }));
  assert.ok(bytes instanceof Uint8Array);
  assert.equal(Buffer.from(bytes.slice(0, 5)).toString(), "%PDF-");
  const t = textoDelPdf(bytes);

  for (const esperado of [
    "Solicitud de alta de servicio",
    "Folio: ALTA-2026-PRUE",
    "FIRMADA · CORREO POR CONFIRMAR",
    "EMPRESA Y FACTURACIÓN",
    "CONTACTOS",
    "PUNTO DE RECOLECCIÓN",
    "SERVICIO SOLICITADO",
    "IMPORTANTE",
    "DECLARACIÓN Y ACEPTACIÓN",
    "Anexo · Términos del servicio",
    "BORRADOR",
    "Evidencia de la firma electrónica",
    "HUELLAS SHA-256",
    // datos del alta, incluidos los del alta "amplia"
    "Industrias del Golfo, S.A. de C.V.",
    "IGO010101AB1",
    "Luis Gómez · Apoderado legal",
    "cxp@golfo.mx",
    "L-V 8:00 a 17:00, portón 3",
    "2 × Tolvas 30",
    // la firma y la evidencia
    "Ana Pérez López",
    "Gerente de planta",
    "201.150.10.20",
    "a".repeat(64),
    "c".repeat(64),
    "5 de octubre de 2026",
  ]) {
    assert.ok(t.includes(esperado), `falta en el PDF: ${esperado}`);
  }
  // Cada cláusula de los términos va en el anexo.
  for (const c of CLAUSULAS) assert.ok(t.includes(c.titulo), `falta la cláusula ${c.titulo}`);
  // La imagen de la firma va incrustada.
  assert.match(Buffer.from(bytes).toString("latin1"), /\/Subtype \/Image/);
});

test("la versión final dice que el correo se confirmó y cita el PDF original", async () => {
  const bytes = await generarPdfAlta({
    ...(await base({ estado: "enlace", fechaTexto: "6 de octubre de 2026, 09:10:00", ip: "189.1.2.3", navegador: "Correo/2.0" })),
    evidencia: {
      ...(await base()).evidencia,
      confirmacion: { estado: "enlace", fechaTexto: "6 de octubre de 2026, 09:10:00", ip: "189.1.2.3", navegador: "Correo/2.0" },
      pdfInicialHuella: "d".repeat(64),
    },
  });
  const t = textoDelPdf(bytes);
  assert.ok(t.includes("FIRMADA · CORREO CONFIRMADO"));
  assert.ok(t.includes("189.1.2.3"));
  assert.ok(t.includes("d".repeat(64)));
  assert.ok(t.includes("PDF firmado original"));
});

test("con Google se anota que el correo lo verificó Google", async () => {
  const datos = await base({ estado: "google" });
  datos.evidencia.origen = "google";
  const t = textoDelPdf(await generarPdfAlta(datos));
  assert.ok(t.includes("CORREO CONFIRMADO"));
  assert.match(t.replace(/\n/g, " "), /verificado por Google/);
});
