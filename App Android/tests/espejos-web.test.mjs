// Las copias de la app tienen que decir EXACTAMENTE lo mismo que la web.
// Si alguien cambia el texto o la lista en `Web/lib/`, esta prueba truena y
// avisa que falta copiarlo aquí (y a App IOS).
import { test } from "node:test";
import assert from "node:assert/strict";

import * as webPrecios from "../../Web/lib/aviso-precios.mjs";
import * as appPrecios from "../src/aviso-precios.js";
import * as webMapas from "../../Web/lib/mapas.mjs";
import * as appMapas from "../src/mapas.js";
import * as webReportes from "../../Web/lib/chofer-reportes.mjs";
import * as appReportes from "../src/chofer-reportes.js";
import { MOTIVOS_NO_PROCEDIO as motivosWeb, ESTADOS_SOLICITUD_REC as estadosWeb } from "../../Web/lib/rutas-datos.js";
import { MOTIVOS_NO_PROCEDIO as motivosApp, ESTADOS_SOLICITUD_REC as estadosApp } from "../src/rutas-datos.js";
import { readFileSync } from "node:fs";
import { TIPOS_RESIDUO as residuosApp } from "../src/cotizar-whatsapp.js";
import { DIAS_EN_PORTAL as diasWeb, MOTIVOS_AVISO as motivosAvisoWeb } from "../../Web/lib/avisos.mjs";
import { DIAS_EN_PORTAL as diasApp, MOTIVOS_AVISO as motivosAvisoApp } from "../src/avisos.js";

// `Web/lib/cotizar-whatsapp.js` importa "./datos" sin extensión (el
// empaquetador de Next lo resuelve, Node no), así que la lista se lee del
// texto del archivo en vez de importarlo.
const fuenteWeb = readFileSync(new URL("../../Web/lib/cotizar-whatsapp.js", import.meta.url), "utf8");
const residuosWeb = Function(`return ${/export const TIPOS_RESIDUO = (\[[\s\S]*?\]);/.exec(fuenteWeb)[1]}`)();

test("el aviso de precios es palabra por palabra el de la web", () => {
  assert.equal(appPrecios.TEXTO_AVISO_PRECIOS, webPrecios.TEXTO_AVISO_PRECIOS);
  assert.equal(appPrecios.TEXTO_AVISO_PRECIOS_CORTO, webPrecios.TEXTO_AVISO_PRECIOS_CORTO);
});

test("catálogos iguales a la web: residuos, motivos, estados, incidentes", () => {
  assert.deepEqual(residuosApp, residuosWeb);
  assert.deepEqual(motivosApp, motivosWeb);
  assert.deepEqual(estadosApp, estadosWeb);
  assert.deepEqual(appReportes.TIPOS_INCIDENTE, webReportes.TIPOS_INCIDENTE);
  assert.equal(appReportes.TELEFONO_OFICINA, webReportes.TELEFONO_OFICINA);
  assert.equal(appReportes.TELEFONO_OFICINA_ENLACE, webReportes.TELEFONO_OFICINA_ENLACE);
  assert.deepEqual(appReportes.LIMITES_REPORTE, webReportes.LIMITES_REPORTE);
  assert.equal(diasApp, diasWeb);
  assert.deepEqual(motivosAvisoApp, motivosAvisoWeb);
});

test("los enlaces de Google Maps salen iguales que en la web", () => {
  const puntos = [
    { lat: 25.8436, lng: -97.5243, calle: "Av. Uniones #1700" },
    { lat: null, lng: null, calle: "Calle Sexta #85", colonia: "Zona Centro", cp: "87300" },
    { lat: "25.8571", lng: "-97.4939" },
    { calle: "Sin pin" },
  ];
  for (const p of puntos) {
    assert.equal(appMapas.enlaceComoLlegar(p), webMapas.enlaceComoLlegar(p));
    assert.equal(appMapas.direccionDe(p), webMapas.direccionDe(p));
    assert.equal(appMapas.tieneUbicacion(p), webMapas.tieneUbicacion(p));
  }
});

test("validaciones del chofer: misma respuesta que la web", () => {
  const casos = [
    {},
    { motivo: "Otro" },
    { motivo: "Otro", detalle: "había llantas" },
    { motivo: "Cerrado o sin acceso" },
    { motivo: "inventado" },
  ];
  for (const c of casos) assert.deepEqual(appReportes.validarNoProcedio(c), webReportes.validarNoProcedio(c));

  const reportes = [
    { tipo: "retraso" },
    { tipo: "retraso", retrasoMin: 30 },
    { tipo: "otro", descripcion: "x" },
    { tipo: "contenedor-movido", contenedorId: "d0000000-0000-4000-8000-0000000000c1", solicitudId: "no-es-uuid" },
    { tipo: "accidente", ubicacion: { lat: 25.8, lng: -97.5, precision_m: 12.4, capturada: "2026-10-05T10:00:00Z" } },
  ];
  for (const r of reportes) assert.deepEqual(appReportes.validarReporte(r), webReportes.validarReporte(r));
});
