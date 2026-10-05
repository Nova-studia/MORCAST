import { test } from "node:test";
import assert from "node:assert/strict";

import { avisoVigente, avisosPorMostrar, esDuplicado, textoMotivo, fechaLocal } from "../src/avisos.js";
import { normalizarCodigo, revisarContenedor } from "../src/contenedores.js";
import { esConfiable, lecturaDe, revisarLectura, PRECISION_ACEPTABLE_M } from "../src/ubicacion.js";
import { validarSolicitud, textoNoProcedio, esProximo } from "../src/solicitudes.js";
import { limpiarCodigo, codigoCompleto, paseUtil, mensajeSegundoPaso, correoOculto } from "../src/pase-admin.js";
import { destinoDeNotificacion } from "../src/push-destino.js";

/* ---------------- Avisos ---------------- */

const AHORA = new Date("2026-10-05T18:00:00");
const HOY = "2026-10-05";
const aviso = (extra) => ({ id: "a1", creado: "2026-10-04T15:00:00Z", vigente_hasta: null, ...extra });

test("un aviso sin fecha se ve 30 días y luego no", () => {
  assert.equal(avisoVigente(aviso(), { hoy: HOY, ahora: AHORA }), true);
  assert.equal(avisoVigente(aviso({ creado: "2026-08-01T10:00:00Z" }), { hoy: HOY, ahora: AHORA }), false);
});

test("vigente_hasta cuenta el día completo", () => {
  assert.equal(avisoVigente(aviso({ vigente_hasta: "2026-10-05" }), { hoy: HOY, ahora: AHORA }), true);
  assert.equal(avisoVigente(aviso({ vigente_hasta: "2026-10-04" }), { hoy: HOY, ahora: AHORA }), false);
});

test("una fecha de creación ilegible no se enseña", () => {
  assert.equal(avisoVigente(aviso({ creado: "ayer" }), { hoy: HOY, ahora: AHORA }), false);
  assert.equal(avisoVigente(null), false);
});

test("los marcados como Enterado ya no se muestran", () => {
  const lista = [aviso({ id: "a1" }), aviso({ id: "a2" }), aviso({ id: "a3", vigente_hasta: "2026-10-01" })];
  const visibles = avisosPorMostrar(lista, ["a1"], { hoy: HOY, ahora: AHORA });
  assert.deepEqual(visibles.map((a) => a.id), ["a2"]);
});

test("23505 (ya estaba leído) no es un error", () => {
  assert.equal(esDuplicado({ code: "23505" }), true);
  assert.equal(esDuplicado({ message: "duplicate key value violates unique constraint" }), true);
  assert.equal(esDuplicado({ code: "42P01" }), false);
  assert.equal(esDuplicado(null), false);
});

test("motivo legible y fecha local", () => {
  assert.equal(textoMotivo("retraso"), "Retraso");
  assert.equal(textoMotivo("x"), "Aviso");
  assert.equal(fechaLocal(new Date(2026, 0, 9)), "2026-01-09");
});

/* ---------------- Contenedores ---------------- */

test("el código se normaliza como en la web", () => {
  assert.equal(normalizarCodigo("mor c 421"), "MOR-C-0421");
  assert.equal(normalizarCodigo("MORC0421"), "MOR-C-0421");
  assert.equal(normalizarCodigo(" 7 "), "MOR-C-0007");
  assert.equal(normalizarCodigo("MOR-C-0000"), null);
  assert.equal(normalizarCodigo("https://algo"), null);
});

const DEL_PUNTO = [
  { id: "c1", codigo: "MOR-C-0421" },
  { id: "c2", codigo: "MOR-C-0422" },
];

test("QR del punto: ok", () => {
  const r = revisarContenedor("mor-c-421", DEL_PUNTO);
  assert.equal(r.estado, "ok");
  assert.equal(r.codigo, "MOR-C-0421");
  assert.equal(r.contenedor.id, "c1");
});

test("QR de otro punto: ajeno", () => {
  assert.equal(revisarContenedor("MOR-C-0310", DEL_PUNTO).estado, "ajeno");
  // Algo que ni siquiera parece código, en un punto con inventario, tampoco es de aquí.
  const raro = revisarContenedor("hola", DEL_PUNTO);
  assert.equal(raro.estado, "ajeno");
  assert.equal(raro.codigo, "hola");
});

test("sin inventario o sin señal no se frena al chofer", () => {
  assert.equal(revisarContenedor("MOR-C-0310", []).estado, "sin-inventario");
  assert.equal(revisarContenedor("MOR-C-0310", null).estado, "sin-datos");
  assert.equal(revisarContenedor("etiqueta vieja 12", null).codigo, "etiqueta vieja 12");
});

/* ---------------- Ubicación ---------------- */

test("solo se guarda una ubicación de 100 m o mejor", () => {
  assert.equal(PRECISION_ACEPTABLE_M, 100);
  assert.equal(esConfiable({ precision_m: 100 }), true);
  assert.equal(esConfiable({ precision_m: 101 }), false);
  assert.equal(esConfiable({ precision_m: null }), false);
  assert.equal(esConfiable(null), false);
});

test("la lectura de expo-location se pasa a la forma de la base", () => {
  const l = lecturaDe({ coords: { latitude: 25.84, longitude: -97.52, accuracy: 12.6 }, timestamp: Date.UTC(2026, 9, 5, 16) });
  assert.deepEqual(l, { lat: 25.84, lng: -97.52, precision_m: 13, capturada: "2026-10-05T16:00:00.000Z" });
  assert.equal(lecturaDe({ coords: {} }), null);
  assert.equal(lecturaDe(null), null);
});

test("revisarLectura: fuera de Matamoros, imprecisa o sin datos no se guarda", () => {
  assert.deepEqual(revisarLectura({ lat: 25.84, lng: -97.52, precision_m: 12.4 }), { ok: true, lat: 25.84, lng: -97.52, precision_m: 12 });
  assert.equal(revisarLectura({ lat: 19.43, lng: -99.13, precision_m: 5 }).ok, false);
  const imprecisa = revisarLectura({ lat: 25.84, lng: -97.52, precision_m: 380 });
  assert.equal(imprecisa.ok, false);
  assert.match(imprecisa.motivo, /±380 m/);
  assert.equal(revisarLectura({ lat: 25.84, lng: -97.52, precision_m: null }).ok, false);
  assert.equal(revisarLectura({ lat: null, lng: null, precision_m: 5 }).ok, false);
  assert.equal(revisarLectura(null).ok, false);
});

/* ---------------- Agendar ---------------- */

test("el tipo de residuo es obligatorio y «Otro» pide nota", () => {
  assert.equal(validarSolicitud({ fecha: "2026-10-07" }).campo, "tipoResiduo");
  assert.equal(validarSolicitud({ fecha: "2026-10-07", tipoResiduo: "Basura" }).campo, "tipoResiduo");
  assert.equal(validarSolicitud({ fecha: "2026-10-07", tipoResiduo: "Otro", nota: "  " }).campo, "nota");
  assert.deepEqual(validarSolicitud({ fecha: "2026-10-07", tipoResiduo: "Otro", nota: "Tarimas rotas" }), { ok: true });
  assert.deepEqual(validarSolicitud({ fecha: "2026-10-07", tipoResiduo: "Residuos Peligrosos" }), { ok: true });
  assert.equal(validarSolicitud({ tipoResiduo: "Residuos Peligrosos" }).campo, "fecha");
});

test("No procedió: motivo, detalle y 'No se te cobra'", () => {
  assert.equal(
    textoNoProcedio({ motivoNoProcedio: "Cerrado o sin acceso", detalleNoProcedio: "portón con candado" }),
    "No se pudo recolectar: Cerrado o sin acceso (portón con candado). No se te cobra."
  );
  assert.equal(textoNoProcedio({}), "No se pudo recolectar. No se te cobra.");
});

test("un No procedió no es un próximo servicio", () => {
  assert.equal(esProximo({ estatus: "programado" }), true);
  assert.equal(esProximo({ estatus: "en-ruta" }), true);
  assert.equal(esProximo({ estatus: "no-procedio" }), false);
  assert.equal(esProximo({ estatus: "completado" }), false);
});

/* ---------------- Segundo paso del admin ---------------- */

test("el código se limpia a 6 dígitos", () => {
  assert.equal(limpiarCodigo("123 456"), "123456");
  assert.equal(limpiarCodigo("12-34-56-78"), "123456");
  assert.equal(codigoCompleto("123 45"), false);
  assert.equal(codigoCompleto("123 456"), true);
});

test("un pase guardado solo sirve para su usuario y antes de vencer", () => {
  const ahora = Date.parse("2026-10-05T12:00:00Z");
  const g = { pase: "abc.def", uid: "u1", vence: "2026-10-12T12:00:00Z" };
  assert.equal(paseUtil(g, "u1", ahora), true);
  assert.equal(paseUtil(g, "u2", ahora), false);
  assert.equal(paseUtil({ ...g, vence: "2026-10-01T00:00:00Z" }, "u1", ahora), false);
  assert.equal(paseUtil({ ...g, vence: "pronto" }, "u1", ahora), false);
  assert.equal(paseUtil({ ...g, vence: null }, "u1", ahora), true);
  assert.equal(paseUtil(null, "u1", ahora), false);
  assert.equal(paseUtil({ ...g, pase: "" }, "u1", ahora), false);
});

test("mensajes del servidor y correo enmascarado", () => {
  assert.equal(mensajeSegundoPaso("codigo_vencido"), "El código ya venció. Pide uno nuevo.");
  assert.equal(mensajeSegundoPaso("Algo en español del servidor"), "Algo en español del servidor");
  assert.equal(mensajeSegundoPaso("", "respaldo"), "respaldo");
  assert.equal(correoOculto("morcastmx@gmail.com"), "m***@gmail.com");
  assert.equal(correoOculto("sin-arroba"), "sin-arroba");
});

/* ---------------- Notificaciones ---------------- */

test("tocar una notificación lleva a la pantalla de su modo", () => {
  assert.deepEqual(destinoDeNotificacion({ tipo: "aviso", id: "a1" }, "cliente"), {
    pila: "TabsCliente", pestana: "Inicio", params: { aviso: "a1" },
  });
  assert.deepEqual(destinoDeNotificacion({ tipo: "incidente", id: "i9" }, "admin"), {
    pila: "TabsAdmin", pestana: "Panel", params: { incidente: "i9" },
  });
  assert.equal(destinoDeNotificacion({ tipo: "aviso" }, "admin"), null);
  assert.equal(destinoDeNotificacion({ tipo: "otro" }, "cliente"), null);
  assert.equal(destinoDeNotificacion(null, "cliente"), null);
});
