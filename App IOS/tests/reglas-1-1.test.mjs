import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

import { TEXTO_AVISO_PRECIOS, TEXTO_AVISO_PRECIOS_CORTO } from "../src/aviso-precios.mjs";
import { avisoVigente, avisosPorEnseñar, esLecturaDuplicada, fechaEnMatamoros, textoMotivo } from "../src/avisos.mjs";
import { estatusDePantalla, esProximo, textoNoProcedio } from "../src/estado-servicio.mjs";
import { normalizarCodigo, revisarContenedor } from "../src/contenedor-punto.mjs";
import { validarSolicitudAgenda } from "../src/agendar.mjs";
import {
  limpiarCodigo, codigoCompleto, paseLocalVigente, empacarPase, desempacarPase,
  mensajeSegundoPaso, correoOculto,
} from "../src/segundo-paso.mjs";
import { destinoDeNotificacion } from "../src/push-destino.mjs";
import { enlaceComoLlegar, tieneUbicacion, direccionDe, revisarLectura } from "../src/mapas.mjs";
import {
  validarNoProcedio, validarReporte, MOTIVOS_NO_PROCEDIO, TIPOS_INCIDENTE, textoMinutos,
} from "../src/chofer-reportes.mjs";

const aqui = dirname(fileURLToPath(import.meta.url));
const WEB = join(aqui, "..", "..", "Web", "lib");

/* ---------------- Aviso de precios: idéntico a la web ---------------- */

test("el aviso de precios es EXACTAMENTE el de la web", async (t) => {
  const ruta = join(WEB, "aviso-precios.mjs");
  if (!existsSync(ruta)) return t.skip("no está la carpeta Web junto a la app");
  const web = await import(pathToFileURL(ruta).href);
  assert.equal(TEXTO_AVISO_PRECIOS, web.TEXTO_AVISO_PRECIOS);
  assert.equal(TEXTO_AVISO_PRECIOS_CORTO, web.TEXTO_AVISO_PRECIOS_CORTO);
});

test("los motivos de 'No procedió' y los tipos de incidente son los de la web", (t) => {
  const rutas = join(WEB, "rutas-datos.js");
  const reportes = join(WEB, "chofer-reportes.mjs");
  if (!existsSync(rutas) || !existsSync(reportes)) return t.skip("no está la carpeta Web");
  const txtRutas = readFileSync(rutas, "utf8");
  for (const m of MOTIVOS_NO_PROCEDIO) assert.ok(txtRutas.includes(`"${m}"`), `falta en la web: ${m}`);
  const txtRep = readFileSync(reportes, "utf8");
  for (const tipo of TIPOS_INCIDENTE) assert.ok(txtRep.includes(`id: "${tipo.id}"`), `falta en la web: ${tipo.id}`);
});

/* ------------------------------ Avisos ------------------------------ */

const AHORA = new Date("2026-10-05T18:00:00Z"); // 1 pm en Matamoros
const HOY = "2026-10-05";

test("aviso vigente: sin fecha y reciente sí; vencido o de hace 31 días no", () => {
  const o = { hoy: HOY, ahora: AHORA };
  assert.equal(avisoVigente({ creado: "2026-10-04T15:00:00Z" }, o), true);
  assert.equal(avisoVigente({ creado: "2026-10-04T15:00:00Z", vigente_hasta: "2026-10-05" }, o), true);
  assert.equal(avisoVigente({ creado: "2026-10-01T15:00:00Z", vigente_hasta: "2026-10-04" }, o), false);
  assert.equal(avisoVigente({ creado: "2026-09-04T15:00:00Z" }, o), false);
  assert.equal(avisoVigente({ creado: "basura" }, o), false);
  assert.equal(avisoVigente(null), false);
});

test("avisosPorEnseñar quita los leídos y los vencidos, y ordena del más nuevo", () => {
  const avisos = [
    { id: "a", creado: "2026-10-01T10:00:00Z" },
    { id: "b", creado: "2026-10-04T10:00:00Z" },
    { id: "c", creado: "2026-10-03T10:00:00Z" },
    { id: "d", creado: "2026-10-03T10:00:00Z", vigente_hasta: "2026-10-04" },
  ];
  const r = avisosPorEnseñar(avisos, ["c"], { hoy: HOY, ahora: AHORA });
  assert.deepEqual(r.map((a) => a.id), ["b", "a"]);
  assert.deepEqual(avisosPorEnseñar(null, null), []);
});

test("un duplicado al guardar la lectura no es error", () => {
  assert.equal(esLecturaDuplicada({ code: "23505" }), true);
  assert.equal(esLecturaDuplicada({ message: 'duplicate key value violates unique constraint "x"' }), true);
  assert.equal(esLecturaDuplicada({ code: "42501", message: "row-level security" }), false);
  assert.equal(esLecturaDuplicada(null), false);
});

test("la fecha se calcula en Matamoros, no en UTC", () => {
  // 02:00 UTC del 6 de octubre son las 9 pm del 5 en Matamoros.
  assert.equal(fechaEnMatamoros(new Date("2026-10-06T02:00:00Z")), "2026-10-05");
  assert.equal(fechaEnMatamoros("no es fecha"), "");
  assert.equal(textoMotivo("retraso"), "Retraso");
  assert.equal(textoMotivo("x"), "Aviso");
});

/* ------------------------- No procedió (cliente) ------------------------- */

test("'no-procedio' tiene su propio estado y NO cuenta como próximo", () => {
  assert.equal(estatusDePantalla("no-procedio"), "no-procedio");
  assert.equal(estatusDePantalla("solicitada"), "programado");
  assert.equal(estatusDePantalla("confirmada"), "programado");
  assert.equal(estatusDePantalla("en-ruta"), "en-ruta");
  assert.equal(estatusDePantalla("completada"), "completado");
  assert.equal(esProximo({ estatus: "no-procedio" }), false);
  assert.equal(esProximo({ estatus: "completado" }), false);
  assert.equal(esProximo({ estatus: "programado" }), true);
  assert.equal(esProximo({ estatus: "en-ruta" }), true);
});

test("el texto del 'No procedió' dice el motivo y que no se cobra", () => {
  assert.equal(textoNoProcedio("Cerrado o sin acceso", ""), "Cerrado o sin acceso. No se te cobra.");
  assert.equal(textoNoProcedio("Otro", "Portón con candado"), "Otro (Portón con candado). No se te cobra.");
  assert.match(textoNoProcedio("", ""), /No se te cobra\.$/);
});

/* ------------------------------ Contenedores ------------------------------ */

test("normalizarCodigo acepta lo que se teclea de verdad", () => {
  assert.equal(normalizarCodigo("MOR-C-0421"), "MOR-C-0421");
  assert.equal(normalizarCodigo("mor c 421"), "MOR-C-0421");
  assert.equal(normalizarCodigo("421"), "MOR-C-0421");
  assert.equal(normalizarCodigo("MOR-C-0000"), null);
  assert.equal(normalizarCodigo("https://algo"), null);
  assert.equal(normalizarCodigo(""), null);
});

test("revisarContenedor distingue del punto, ajeno y sin inventario", () => {
  const delPunto = [{ id: "1", codigo: "MOR-C-0421" }, { id: "2", codigo: "MOR-C-0422" }];
  assert.equal(revisarContenedor("mor-c-421", delPunto).estado, "del-punto");
  assert.equal(revisarContenedor("MOR-C-0421", delPunto).contenedor.id, "1");
  assert.equal(revisarContenedor("MOR-C-0999", delPunto).estado, "ajeno");
  assert.equal(revisarContenedor("MOR-C-0999", []).estado, "sin-inventario");
  assert.equal(revisarContenedor("", delPunto).estado, "vacio");
  // Un QR que no es de Morcast se compara tal cual: no es de este punto.
  assert.equal(revisarContenedor("ABC", delPunto).estado, "ajeno");
});

/* -------------------------------- Agendar -------------------------------- */

const CATALOGO = ["Residuos Sólidos Urbanos (RSU)", "Otro"];

test("agendar exige fecha y tipo de residuo; con Otro, la nota", () => {
  assert.equal(validarSolicitudAgenda({ fecha: "", tipoResiduo: "Otro" }, CATALOGO).campo, "fecha");
  assert.equal(validarSolicitudAgenda({ fecha: "2026-10-07" }, CATALOGO).campo, "tipoResiduo");
  assert.equal(validarSolicitudAgenda({ fecha: "2026-10-07", tipoResiduo: "Llantas" }, CATALOGO).campo, "tipoResiduo");
  assert.equal(validarSolicitudAgenda({ fecha: "2026-10-07", tipoResiduo: "Otro", nota: "  " }, CATALOGO).campo, "nota");
  assert.equal(validarSolicitudAgenda({ fecha: "2026-10-07", tipoResiduo: "Otro", nota: "Tarimas" }, CATALOGO).ok, true);
  assert.equal(validarSolicitudAgenda({ fecha: "2026-10-07", tipoResiduo: CATALOGO[0] }, CATALOGO).ok, true);
});

/* ------------------------------ Segundo paso ------------------------------ */

test("el código del correo se limpia a 6 dígitos", () => {
  assert.equal(limpiarCodigo(" 12 34-56 7"), "123456");
  assert.equal(codigoCompleto("123456"), true);
  assert.equal(codigoCompleto("12345"), false);
});

test("el pase guardado: vencido no, de otro usuario no", () => {
  const ahora = new Date("2026-10-05T12:00:00Z");
  assert.equal(paseLocalVigente({ pase: "p", vence: "2026-10-06T00:00:00Z" }, ahora), true);
  assert.equal(paseLocalVigente({ pase: "p", vence: "2026-10-05T11:00:00Z" }, ahora), false);
  assert.equal(paseLocalVigente({ pase: "p" }, ahora), true);
  assert.equal(paseLocalVigente({ pase: "" }, ahora), false);
  assert.equal(paseLocalVigente(null, ahora), false);

  const guardado = empacarPase({ pase: "abc", vence: "2026-10-12T00:00:00Z" }, "u1");
  assert.equal(desempacarPase(guardado, "u1").pase, "abc");
  assert.equal(desempacarPase(guardado, "u2"), null);
  assert.equal(desempacarPase("{roto", "u1"), null);
  assert.equal(desempacarPase(null, "u1"), null);
});

test("los motivos del servidor se dicen en español", () => {
  assert.match(mensajeSegundoPaso("codigo_incorrecto"), /código no es/);
  assert.equal(mensajeSegundoPaso("Un mensaje del servidor"), "Un mensaje del servidor");
  assert.equal(mensajeSegundoPaso(undefined, "respaldo"), "respaldo");
  assert.equal(correoOculto("juan@morcast.mx"), "j***@morcast.mx");
});

/* ---------------------------- Notificaciones ---------------------------- */

test("el toque de una notificación abre la pantalla del modo correcto", () => {
  assert.deepEqual(destinoDeNotificacion({ tipo: "aviso", id: "x" }, "cliente"), { pantalla: "TabsCliente", params: { screen: "Inicio" } });
  assert.deepEqual(destinoDeNotificacion({ tipo: "incidente", id: "x" }, "admin"), { pantalla: "TabsAdmin", params: { screen: "Panel" } });
  assert.equal(destinoDeNotificacion({ tipo: "aviso" }, "chofer"), null);
  assert.equal(destinoDeNotificacion({ tipo: "otra" }, "cliente"), null);
  assert.equal(destinoDeNotificacion(null, "cliente"), null);
});

test("el aviso de una recolección lleva al cliente a su Historial (6-oct-2026)", () => {
  assert.deepEqual(
    destinoDeNotificacion({ tipo: "recoleccion", id: "r1", folio: "REC-0042", evento: "en-camino" }, "cliente"),
    { pantalla: "TabsCliente", params: { screen: "Historial", params: { recoleccion: "r1", evento: "en-camino" } } }
  );
  // Sin id ni evento igual abre el Historial.
  assert.deepEqual(destinoDeNotificacion({ tipo: "recoleccion" }, "cliente"), {
    pantalla: "TabsCliente",
    params: { screen: "Historial", params: { recoleccion: null, evento: null } },
  });
  // Es del cliente: en otra sesión no se navega a ningún lado.
  assert.equal(destinoDeNotificacion({ tipo: "recoleccion", id: "r1", evento: "completada" }, "chofer"), null);
  assert.equal(destinoDeNotificacion({ tipo: "recoleccion", id: "r1", evento: "completada" }, "admin"), null);
  assert.equal(destinoDeNotificacion({ tipo: "recoleccion", id: "r1" }, null), null);
});

/* ------------------------------ Mapas / GPS ------------------------------ */

test("Cómo llegar va al pin si lo hay y si no a la dirección", () => {
  assert.equal(
    enlaceComoLlegar({ lat: 25.86, lng: -97.5 }),
    "https://www.google.com/maps/dir/?api=1&destination=25.86%2C-97.5&travelmode=driving"
  );
  const sinPin = enlaceComoLlegar({ calle: "Calle 16 #1601", colonia: "Centro", cp: "87300", lat: null, lng: null });
  assert.ok(sinPin.includes(encodeURIComponent("Calle 16 #1601, Centro, C.P. 87300, Matamoros, Tamaulipas")));
  assert.equal(tieneUbicacion({ lat: null, lng: null }), false);
  assert.equal(tieneUbicacion({ lat: 0, lng: 0 }), false);
  assert.equal(tieneUbicacion({ lat: "25.8", lng: "-97.5" }), true);
  assert.equal(direccionDe({}), "Matamoros, Tamaulipas");
});

test("la lectura del GPS se acepta solo en Matamoros y con ≤100 m", () => {
  assert.equal(revisarLectura({ lat: 25.86, lng: -97.5, precision_m: 35.4 }).ok, true);
  assert.equal(revisarLectura({ lat: 25.86, lng: -97.5, precision_m: 35.4 }).precision_m, 35);
  assert.equal(revisarLectura({ lat: 25.86, lng: -97.5, precision_m: 250 }).ok, false);
  assert.match(revisarLectura({ lat: 25.86, lng: -97.5, precision_m: 250 }).motivo, /±250 m/);
  assert.equal(revisarLectura({ lat: 19.4, lng: -99.1, precision_m: 5 }).ok, false);
  assert.equal(revisarLectura({ lat: 25.86, lng: -97.5 }).ok, false);
  assert.equal(revisarLectura(null).ok, false);
});

/* ------------------------- Reportes del chofer ------------------------- */

test("No procedió: motivo de la lista; con Otro, detalle", () => {
  assert.equal(validarNoProcedio({}).campo, "motivo");
  assert.equal(validarNoProcedio({ motivo: "Lo que sea" }).campo, "motivo");
  assert.equal(validarNoProcedio({ motivo: "Otro", detalle: "no" }).campo, "detalle");
  const ok = validarNoProcedio({ motivo: "Cerrado o sin acceso", detalle: "" });
  assert.deepEqual(ok, { ok: true, datos: { motivo_no_procedio: "Cerrado o sin acceso", detalle_no_procedio: null } });
});

test("Reporte: retraso pide minutos, otro pide descripción, contenedor solo en su grupo", () => {
  assert.equal(validarReporte({}).campo, "tipo");
  assert.equal(validarReporte({ tipo: "retraso", retrasoMin: "" }).campo, "retrasoMin");
  assert.equal(validarReporte({ tipo: "retraso", retrasoMin: "45" }).datos.retraso_min, 45);
  assert.equal(validarReporte({ tipo: "otro", descripcion: "x" }).campo, "descripcion");
  const uuid = "0f8fad5b-d9cb-469f-a165-70867728950e";
  assert.equal(validarReporte({ tipo: "accidente", contenedorId: uuid }).datos.contenedor_id, null);
  assert.equal(validarReporte({ tipo: "contenedor-movido", contenedorId: uuid }).datos.contenedor_id, uuid);
  assert.equal(validarReporte({ tipo: "falla-mecanica", solicitudId: "no-uuid" }).datos.solicitud_id, null);
  const u = validarReporte({
    tipo: "accidente",
    ubicacion: { lat: 25.8612345678, lng: -97.5, precision_m: 12.6, capturada: "2026-10-05T12:00:00Z", extra: 1 },
  }).datos.ubicacion;
  assert.deepEqual(u, { lat: 25.861235, lng: -97.5, precision_m: 13, capturada: "2026-10-05T12:00:00.000Z" });
  assert.equal(textoMinutos(90), "1 h 30 min");
});

test("el vencimiento del pase llega en SEGUNDOS Unix y se reconoce bien", async () => {
  const { paseLocalVigente, venceEnMs } = await import("../src/segundo-paso.mjs");
  const ahora = new Date("2026-10-05T12:00:00Z");
  const enSegundos = Math.floor(ahora.getTime() / 1000) + 7 * 24 * 3600; // como lo manda el servidor
  assert.equal(venceEnMs(enSegundos), enSegundos * 1000);
  assert.equal(paseLocalVigente({ pase: "p", vence: enSegundos }, ahora), true);
  assert.equal(paseLocalVigente({ pase: "p", vence: Math.floor(ahora.getTime() / 1000) - 60 }, ahora), false);
  assert.equal(paseLocalVigente({ pase: "p", vence: String(enSegundos) }, ahora), true);
});
