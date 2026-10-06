import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fechaCorta,
  puedeAvisar,
  esChoferDeParada,
  mensajeAvisoCliente,
  EVENTOS_AVISO,
  INCIDENTES_QUE_RETRASAN,
} from "../lib/aviso-cliente.mjs";

test("fechaCorta: día de la semana y mes, sin correrse por la zona horaria", () => {
  assert.equal(fechaCorta("2026-10-08"), "jueves 8 de octubre");
  assert.equal(fechaCorta("2026-01-01"), "jueves 1 de enero");
  assert.equal(fechaCorta(""), "");
  assert.equal(fechaCorta(null), "");
});

test("puedeAvisar exige que la base diga lo mismo que el aviso", () => {
  assert.equal(puedeAvisar("en-camino", "en-ruta"), true);
  assert.equal(puedeAvisar("en-camino", "confirmada"), false);
  assert.equal(puedeAvisar("completada", "completada"), true);
  assert.equal(puedeAvisar("completada", "en-ruta"), false);
  assert.equal(puedeAvisar("no-procedio", "no-procedio"), true);
  // Confirmar, reagendar y retraso no dependen del estado.
  assert.equal(puedeAvisar("reagendada", "confirmada"), true);
  assert.equal(puedeAvisar("retraso", "en-ruta"), true);
  assert.equal(puedeAvisar("inventado", "en-ruta"), false);
});

test("esChoferDeParada: el asignado a la parada manda sobre el de la ruta", () => {
  assert.equal(esChoferDeParada({ chofer_id: "a", rutas: { chofer_id: "b" } }, "a"), true);
  assert.equal(esChoferDeParada({ chofer_id: "a", rutas: { chofer_id: "b" } }, "b"), false);
  assert.equal(esChoferDeParada({ chofer_id: null, rutas: { chofer_id: "b" } }, "b"), true);
  assert.equal(esChoferDeParada({ chofer_id: null, rutas: null }, "b"), false);
  assert.equal(esChoferDeParada(null, "b"), false);
});

test("mensajeAvisoCliente: cada evento trae asunto, título, texto y notificación", () => {
  const d = { folio: "REC-2026-0042", fecha: "2026-10-08", hora: "10:30:00", chofer: "José Medina", motivo: "Cerrado", detalle: "No había nadie", retrasoMin: 40 };
  for (const e of EVENTOS_AVISO) {
    const m = mensajeAvisoCliente(e, d);
    assert.ok(m.asunto.includes("REC-2026-0042"), e);
    assert.ok(m.titulo && m.parrafos.length && m.push.titulo && m.push.cuerpo, e);
  }
  assert.match(mensajeAvisoCliente("reagendada", d).parrafos[0], /jueves 8 de octubre alrededor de las 10:30/);
  assert.match(mensajeAvisoCliente("en-camino", d).parrafos[0], /José Medina/);
  assert.match(mensajeAvisoCliente("retraso", d).parrafos[0], /40 minutos/);
  assert.match(mensajeAvisoCliente("no-procedio", d).parrafos[0], /Cerrado: No había nadie/);
  assert.match(mensajeAvisoCliente("no-procedio", d).parrafos[1], /no se te cobra/);
  assert.equal(mensajeAvisoCliente("otro", d), null);
});

test("los incidentes de contenedor no se le avisan al cliente", () => {
  assert.ok(INCIDENTES_QUE_RETRASAN.includes("retraso"));
  assert.ok(!INCIDENTES_QUE_RETRASAN.includes("contenedor-danado"));
});
