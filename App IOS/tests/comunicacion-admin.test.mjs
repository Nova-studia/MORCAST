// Equipo 2 (6-oct-2026): avisos a clientes, bitácora por día y reportes en
// la app de administración. Las copias de la app tienen que decir lo MISMO
// que la web; si la carpeta Web está al lado, se comparan contra ella.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

import * as avisos from "../src/avisos-admin.mjs";
import * as bitacora from "../src/bitacora-vista.mjs";
import * as reportes from "../src/reportes-negocio.mjs";

const aqui = dirname(fileURLToPath(import.meta.url));
const WEB = join(aqui, "..", "..", "Web", "lib");
const deLaWeb = async (t, archivo) => {
  const ruta = join(WEB, archivo);
  if (!existsSync(ruta)) {
    t.skip("no está la carpeta Web junto a la app");
    return null;
  }
  return import(pathToFileURL(ruta).href);
};

const U = "aaaaaaaa-0000-4000-8000-000000000001";

/* ---------------- Bitácora por día ---------------- */

test("el día de Matamoros va de medianoche a medianoche local, no de UTC", () => {
  assert.deepEqual(bitacora.rangoDelDia("2026-01-15"), { desde: "2026-01-15T06:00:00.000Z", hasta: "2026-01-16T06:00:00.000Z" });
  assert.deepEqual(bitacora.rangoDelDia("2026-10-06"), { desde: "2026-10-06T05:00:00.000Z", hasta: "2026-10-07T05:00:00.000Z" });
  // Cambio de horario: 23 y 25 horas.
  assert.equal(bitacora.rangoDelDia("2026-03-08").hasta, "2026-03-09T05:00:00.000Z");
  assert.equal(bitacora.rangoDelDia("2026-11-01").hasta, "2026-11-02T06:00:00.000Z");
  assert.equal(bitacora.rangoDelDia("2026-02-30"), null);
  assert.equal(bitacora.diaEnMatamoros(new Date("2026-10-07T00:30:00Z")), "2026-10-06");
});

test("Hoy, Ayer y las flechas", () => {
  assert.equal(bitacora.nombreDelDia("2026-10-06", "2026-10-06"), "Hoy");
  assert.equal(bitacora.nombreDelDia("2026-10-05", "2026-10-06"), "Ayer");
  assert.equal(bitacora.moverDia("2026-01-01", -1), "2025-12-31");
});

test("bitácora: misma cuenta y mismas palabras que la web", async (t) => {
  const web = await deLaWeb(t, "bitacora-vista.mjs");
  if (!web) return;
  for (const f of ["2026-01-15", "2026-03-08", "2026-07-04", "2026-11-01", "2026-12-31", "malo"]) {
    assert.deepEqual(bitacora.rangoDelDia(f), web.rangoDelDia(f), f);
    assert.equal(bitacora.nombreDelDia(f, "2026-10-06"), web.nombreDelDia(f, "2026-10-06"), f);
  }
  const fila = { detalle: { folio: "DEP-1", monto: 1500, titulo: "Retraso", notas: "x", cambios: { a: 1 }, origen: "app" } };
  assert.equal(bitacora.resumenBitacora(fila), web.resumenBitacora(fila));
});

test("bitácora: cada acción se lee igual que en la web", (t) => {
  const ruta = join(WEB, "bitacora.js");
  if (!existsSync(ruta)) return t.skip("no está la carpeta Web junto a la app");
  // lib/bitacora.js importa Supabase: se lee el objeto del texto del archivo.
  const fuente = readFileSync(ruta, "utf8");
  const objeto = (nombre) => Function(`return ${new RegExp(`export const ${nombre} = (\\{[\\s\\S]*?\\n\\});`).exec(fuente)[1]}`)();
  const acciones = objeto("TEXTO_ACCION");
  const tablas = objeto("TEXTO_TABLA");
  const faltan = [];
  for (const [clave, texto] of Object.entries(acciones)) {
    if (!(clave in bitacora.TEXTO_ACCION)) faltan.push(clave);
    else assert.equal(bitacora.TEXTO_ACCION[clave], texto, clave);
  }
  // Una acción nueva de la web que aquí no está se lee "Asignar ruta punto"
  // (no truena la pantalla), pero conviene copiarla: se avisa sin fallar.
  if (faltan.length) t.diagnostic(`Copiar a bitacora-vista: ${faltan.join(", ")}`);
  for (const [clave, texto] of Object.entries(tablas)) assert.equal(bitacora.TEXTO_TABLA[clave], texto, clave);
  assert.equal(bitacora.textoDeAccion({ accion: "db_update", tabla: "clientes" }), "Cambio de cliente");
  assert.equal(bitacora.textoDeAccion({ accion: "asignar_ruta_punto" }), "Asignar ruta punto");
});

/* ---------------- Avisos a clientes ---------------- */

test("avisos: valida igual que el servidor", async (t) => {
  const web = await deLaWeb(t, "avisos.mjs");
  if (!web) return;
  const casos = [
    {},
    { alcance: "todos", titulo: "Hola", mensaje: "Un mensaje" },
    { alcance: "ruta", titulo: "Retraso", mensaje: "La ruta va tarde" },
    { alcance: "ruta", rutaId: "RT-1", titulo: "Retraso", mensaje: "La ruta va tarde" },
    { alcance: "cliente", clienteId: U, titulo: "  Un   aviso ", mensaje: "Mensaje largo", motivo: "reagenda", vigenteHasta: "2026-10-01" },
    { alcance: "sector", sectorId: U, titulo: "ab", mensaje: "Mensaje" },
    { alcance: "todos", titulo: "x".repeat(121), mensaje: "Mensaje" },
    { alcance: "todos", titulo: "Bien", mensaje: "Mensaje", motivo: "otro" },
  ];
  for (const c of casos) {
    for (const exigirUuid of [false, true]) {
      assert.deepEqual(avisos.validarAviso(c, { hoy: "2026-10-06", exigirUuid }), web.validarAviso(c, { hoy: "2026-10-06", exigirUuid }));
    }
  }
  assert.deepEqual(avisos.ALCANCES_AVISO, web.ALCANCES_AVISO);
  assert.deepEqual(avisos.MOTIVOS_AVISO, web.MOTIVOS_AVISO);
  assert.equal(avisos.MAX_TITULO, web.MAX_TITULO);
  assert.equal(avisos.MAX_MENSAJE, web.MAX_MENSAJE);
  for (const r of [{ clientes: 0, correos: 0, sinCorreo: 0 }, { clientes: 1, correos: 1, sinCorreo: 0 }, { clientes: 12, correos: 10, sinCorreo: 1 }]) {
    assert.equal(avisos.fraseResumen(r), web.fraseResumen(r));
  }
  for (const l of [{ leidos: null }, { leidos: 2, usuariosDestino: null }, { leidos: 0, usuariosDestino: 0 }, { leidos: 3, usuariosDestino: 12 }]) {
    assert.equal(avisos.fraseLecturas(l), web.fraseLecturas(l));
  }
  for (const a of [{ alcance: "todos" }, { alcance: "ruta", rutas: { nombre: "Ruta Norte" } }, { alcance: "cliente" }]) {
    assert.equal(avisos.textoAlcance(a), web.textoAlcance(a));
  }
});

test("avisos: id de envío con forma de UUID v4 y distinto cada vez", () => {
  const a = avisos.nuevoIdEnvio();
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(a, avisos.nuevoIdEnvio());
});

test("avisos: la espera estimada y la frase del resultado", () => {
  assert.equal(avisos.segundosEstimados(0), 4);
  assert.equal(avisos.segundosEstimados(43), 29);
  assert.match(avisos.textoResultado({ yaEnviado: true }), /No se volvió a mandar/);
  const t = avisos.textoResultado({ resumen: { clientes: 2, sinCorreo: 1 }, enviados: 1, notificaciones: 1, fallidos: ["Uno"] });
  assert.match(t, /portal de 2 clientes/);
  assert.match(t, /1 notificación enviada/);
  assert.match(t, /Uno/);
});

/* ---------------- Reportes ---------------- */

test("reportes: el mejor dato de peso es el mismo que en la web", async (t) => {
  const web = await deLaWeb(t, "peso.mjs");
  if (!web) return;
  const recs = [
    { fecha: "2026-09-01", tipo: "manual", estimadoKg: 1000 },
    { fecha: "2026-09-02", tipo: "manual", estimadoKg: 500, realKg: 640 },
    { fecha: "2026-09-03", tipo: "roll-off", estimadoKg: 300, viajeId: "v1" },
    { fecha: "2026-09-03", tipo: "roll-off", estimadoKg: 200, viajeId: "v1" },
    { fecha: "2026-09-04", tipo: "otro" },
  ];
  const viajes = [{ id: "v1", fecha: "2026-09-03", pesoRealKg: 6000 }];
  assert.deepEqual(reportes.aportesConMejorDato(recs, viajes), web.aportesConMejorDato(recs, viajes));
});

test("reportes: doce meses, mejor mes y conversión como /admin/reportes", () => {
  const hoy = new Date(2026, 9, 6);
  const tot = reportes.aportesConMejorDato([
    { fecha: "2026-09-10", tipo: "manual", estimadoKg: 1250 },
    { fecha: "2026-10-01", tipo: "manual", estimadoKg: 500 },
    { fecha: "2025-01-01", tipo: "manual", estimadoKg: 9999 }, // fuera de los 12 meses
  ]);
  const serie = reportes.serieMensual(reportes.filasDeAportes(tot), hoy);
  assert.equal(serie.length, 12);
  assert.equal(serie[11].periodo, "Oct");
  assert.equal(serie[10].volumen, 1.25);
  assert.equal(serie[10].estimado, 1.25);
  assert.equal(serie[0].periodo, "Nov");
  const r = reportes.resumenReportes(serie, [{ estado: "ganada" }, { estado: "nueva" }, { estado: "perdida" }, { estado: "ganada" }]);
  assert.equal(r.total, 1.75);
  assert.equal(r.mejor.periodo, "Sep");
  assert.equal(r.conversion, 50);
  assert.equal(r.ganadas, 2);
  assert.equal(r.pctReal, 0);
  assert.equal(reportes.ton(1234.5), "1,234.5 ton");
  assert.equal(reportes.ton(0), "0 ton");
});
