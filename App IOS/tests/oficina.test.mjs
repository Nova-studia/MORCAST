// La oficina en el teléfono (6-oct-2026): recolecciones, incidentes y a
// dónde llevan sus notificaciones. Lo de vencimiento se compara contra la
// web: si allá cambia una regla, esta prueba truena y avisa que falta
// copiarla aquí (y a App Android).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

import {
  estadoVencimiento, ordenarPorUrgencia, opcionesReagenda, textoAtraso, hoyISO,
  queSePuede, planPorOmision, normalizarHora, filtrarRecolecciones, choferQueVa,
  semanasDelMes, fechaCortaDia,
  infoTipoIncidente, filtrarIncidentes, ordenarBandeja, contarIncidentes, validarAtencion,
  fechaHoraMatamoros, enlaceMapaIncidente, TIPOS_BANDEJA,
} from "../src/oficina.mjs";
import { destinoDeNotificacion } from "../src/push-destino.mjs";

const aqui = dirname(fileURLToPath(import.meta.url));
const WEB = join(aqui, "..", "..", "Web");
const HOY = "2026-10-06"; // martes

const CASOS = [
  { estado: "solicitada", fechaPedida: "2026-10-01" },
  { estado: "solicitada", fechaPedida: "2026-10-09" },
  { estado: "confirmada", fechaPedida: "2026-10-01", fechaConfirmada: "2026-10-04" },
  { estado: "confirmada", fechaPedida: "2026-10-01", fechaConfirmada: "2026-10-06" },
  { estado: "en-ruta", fechaConfirmada: "2026-10-05" },
  { estado: "en-ruta", fechaConfirmada: "2026-10-06" },
  { estado: "completada", fechaConfirmada: "2026-10-02" },
  { estado: "no-procedio", fechaConfirmada: "2026-10-03" },
  { estado: "rechazada", fechaPedida: "2026-09-30" },
];

test("vencimiento: la copia dice lo mismo que la web", async (t) => {
  const ruta = join(WEB, "lib", "vencimiento.js");
  if (!existsSync(ruta)) return t.skip("no está la carpeta Web junto a la app");
  const web = await import(pathToFileURL(ruta).href);
  for (const c of CASOS) {
    const a = estadoVencimiento(c, HOY);
    const w = web.estadoVencimiento(c, HOY);
    assert.equal(a.vencida, w.vencida, JSON.stringify(c));
    assert.equal(a.tipo, w.tipo);
    assert.equal(a.texto, w.texto);
    assert.equal(a.dias, w.dias);
  }
  const conFolio = CASOS.map((c, i) => ({ ...c, folio: `F${i}` }));
  assert.deepEqual(
    ordenarPorUrgencia(conFolio, HOY).map((s) => s.folio),
    web.ordenarPorUrgencia(conFolio, HOY).map((s) => s.folio)
  );
  for (const dias of [[], ["lunes"], ["miércoles"], ["sábado", "lunes"], ["domingo"]]) {
    assert.deepEqual(opcionesReagenda(dias, HOY), web.opcionesReagenda(dias, HOY), JSON.stringify(dias));
  }
  assert.equal(textoAtraso(1), web.textoAtraso(1));
  assert.equal(textoAtraso(3), web.textoAtraso(3));
});

test("el próximo día de su ruta entiende los días con acento", () => {
  const sab = opcionesReagenda(["sábado"], HOY).find((o) => o.id === "ruta");
  assert.equal(sab.fecha, "2026-10-10");
});

test("qué botones lleva cada recolección (las reglas del servidor)", () => {
  assert.deepEqual(queSePuede(CASOS[0], HOY), { programar: "reagendar", rechazar: true });
  assert.deepEqual(queSePuede(CASOS[1], HOY), { programar: "confirmar", rechazar: true });
  assert.deepEqual(queSePuede(CASOS[2], HOY), { programar: "reagendar", rechazar: true });
  assert.deepEqual(queSePuede(CASOS[3], HOY), { programar: "cambiar", rechazar: false });
  assert.deepEqual(queSePuede(CASOS[4], HOY), { programar: "reagendar", rechazar: true });
  assert.deepEqual(queSePuede(CASOS[5], HOY), { programar: null, rechazar: false });
  for (const c of CASOS.slice(6)) assert.deepEqual(queSePuede(c, HOY), { programar: null, rechazar: false });
});

test("el plan por omisión de una vencida es HOY, nunca el día que se pasó", () => {
  assert.equal(planPorOmision(CASOS[2], HOY).fecha, HOY);
  assert.deepEqual(
    planPorOmision({ estado: "confirmada", fechaConfirmada: "2026-10-08", horaConfirmada: "09:30:00", choferId: "c1" }, HOY),
    { fecha: "2026-10-08", hora: "09:30", choferId: "c1" }
  );
});

test("la hora se escribe como sea y se guarda como 09:30", () => {
  assert.deepEqual(normalizarHora("9:30"), { ok: true, hora: "09:30" });
  assert.deepEqual(normalizarHora("0930"), { ok: true, hora: "09:30" });
  assert.deepEqual(normalizarHora(""), { ok: true, hora: "" });
  assert.equal(normalizarHora("25:00").ok, false);
  assert.equal(normalizarHora("mañana").ok, false);
});

test("filtros: Todas, Vencidas y por estado", () => {
  assert.equal(filtrarRecolecciones(CASOS, "todas", HOY).length, CASOS.length);
  assert.equal(filtrarRecolecciones(CASOS, "vencidas", HOY).length, 3);
  assert.equal(filtrarRecolecciones(CASOS, "en-ruta", HOY).length, 2);
});

test("en una completada manda quien la hizo, no el chofer de la ruta", () => {
  const s = { estado: "completada", operadorReal: "José Medina", choferAsignado: "", choferRuta: "Marco Antonio" };
  assert.deepEqual(choferQueVa(s), { nombre: "José Medina", de: "lo hizo" });
  assert.deepEqual(choferQueVa({ ...s, estado: "confirmada" }), { nombre: "Marco Antonio", de: "de la ruta" });
  assert.deepEqual(choferQueVa({ estado: "confirmada", choferAsignado: "Ana" }), { nombre: "Ana", de: "asignado" });
  assert.equal(choferQueVa({}).nombre, "");
});

test("calendario: semanas de lunes a domingo con huecos", () => {
  const oct = semanasDelMes(2026, 9); // 1-oct-2026 es jueves
  assert.deepEqual(oct[0], [null, null, null, "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
  assert.equal(oct.flat().filter(Boolean).length, 31);
  assert.ok(oct.every((s) => s.length === 7));
  assert.equal(fechaCortaDia("2026-10-08"), "jue 8 oct");
});

test("bandeja de incidentes: lo abierto arriba y los accidentes primero", () => {
  const l = [
    { id: "a", estado: "atendido", tipo: "accidente", creado: "2026-10-06T10:00:00Z" },
    { id: "b", estado: "abierto", tipo: "retraso", creado: "2026-10-06T12:00:00Z" },
    { id: "c", estado: "abierto", tipo: "accidente", creado: "2026-10-05T12:00:00Z" },
  ];
  assert.deepEqual(ordenarBandeja(l).map((i) => i.id), ["c", "b", "a"]);
  assert.deepEqual(filtrarIncidentes(l, "abiertos").map((i) => i.id), ["b", "c"]);
  assert.deepEqual(contarIncidentes(l), { todos: 3, abiertos: 2, atendidos: 1, urgentes: 1 });
  assert.equal(infoTipoIncidente("accidente").tono, "urgente");
  assert.equal(infoTipoIncidente("contenedor-movido").texto, "Contenedor movido");
});

test("bandeja: mismos tipos y misma regla de la nota que la web", async (t) => {
  const ruta = join(WEB, "app", "(admin)", "admin", "incidentes", "bandeja.mjs");
  if (!existsSync(ruta)) return t.skip("no está la carpeta Web junto a la app");
  const web = await import(pathToFileURL(ruta).href);
  assert.deepEqual(TIPOS_BANDEJA, web.TIPOS_INCIDENTE);
  for (const nota of ["", "ok", "Se cambió la llanta", "x".repeat(1001)]) {
    assert.deepEqual(validarAtencion(nota), web.validarAtencion(nota));
  }
});

test("fecha y mapa de un incidente", () => {
  assert.equal(fechaHoraMatamoros("2026-10-05T19:32:00Z"), "5 oct 2026 · 14:32");
  assert.equal(fechaHoraMatamoros(null), "—");
  assert.equal(enlaceMapaIncidente({ lat: 25.85, lng: -97.5 }), "https://www.google.com/maps/search/?api=1&query=25.85,-97.5");
  assert.equal(enlaceMapaIncidente({}), null);
  assert.equal(enlaceMapaIncidente(null), null);
});

test("notificaciones de la oficina y del chofer llevan a su bandeja", () => {
  assert.deepEqual(destinoDeNotificacion({ tipo: "solicitud", id: "s1" }, "admin"), { pantalla: "Recolecciones", params: { id: "s1" } });
  assert.deepEqual(destinoDeNotificacion({ tipo: "incidente", id: "i1" }, "admin"), { pantalla: "Incidentes", params: { id: "i1" } });
  assert.deepEqual(destinoDeNotificacion({ tipo: "parada", id: "p1" }, "chofer", 123), {
    pantalla: "Ruta",
    params: { recargar: 123, parada: "p1" },
  });
  // Cada una es de su modo.
  assert.equal(destinoDeNotificacion({ tipo: "parada", id: "p1" }, "admin"), null);
  assert.equal(destinoDeNotificacion({ tipo: "solicitud", id: "s1" }, "cliente"), null);
  assert.ok(hoyISO().match(/^\d{4}-\d{2}-\d{2}$/));
});
