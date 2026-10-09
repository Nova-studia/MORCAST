// Reglas que comparten el panel web y la app 1.1 (6-oct-2026): estados,
// alta de cliente, contraseña legible, puntos y ruta de un punto.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ESTADOS_ALTA,
  ESTADOS_ZONA,
  esEstado,
  esId,
  filaClienteNuevo,
  contrasenaLegible,
  ABC_CONTRASENA,
} from "../lib/admin-app.mjs";
import { filaDePunto } from "../lib/sectores.mjs";
import { revisarAsignacion, revisarCambiosPunto, guardarPuntoCon, asignarRutaAPuntoCon } from "../lib/puntos-servidor.js";

test("los estados de altas y zonas son los de las pantallas", () => {
  assert.deepEqual(ESTADOS_ALTA.map((e) => e.id), ["nueva", "contactada", "aprobada", "rechazada"]);
  assert.deepEqual(ESTADOS_ZONA.map((e) => e.id), ["nueva", "en-evaluacion", "aprobada", "descartada"]);
  assert.equal(esEstado(ESTADOS_ZONA, "en-evaluacion"), true);
  assert.equal(esEstado(ESTADOS_ZONA, "borrada"), false);
  assert.equal(esEstado(ESTADOS_ALTA, undefined), false);
});

test("esId sólo acepta uuid", () => {
  assert.equal(esId("6f1c1a3e-2b4d-4c8e-9f00-1a2b3c4d5e6f"), true);
  assert.equal(esId("MOR-2026-0001"), false);
  assert.equal(esId(null), false);
});

test("filaClienteNuevo exige la empresa y limpia lo demás", () => {
  assert.equal(filaClienteNuevo({}).ok, false);
  assert.equal(filaClienteNuevo({ empresa: "   " }).ok, false);
  const r = filaClienteNuevo({ empresa: " Taller Ruiz ", correo: " Ana@Ruiz.MX ", telefono: "", plan: "Por evento" });
  assert.equal(r.ok, true);
  assert.deepEqual(r.fila, {
    empresa: "Taller Ruiz",
    contacto: null,
    correo: "ana@ruiz.mx",
    telefono: null,
    plan: "Por evento",
    estado: "activo",
  });
});

test("filaClienteNuevo rechaza un correo mal escrito o un plan inventado", () => {
  assert.equal(filaClienteNuevo({ empresa: "X", correo: "ana@" }).ok, false);
  assert.equal(filaClienteNuevo({ empresa: "X", plan: "Gratis para siempre" }).ok, false);
});

test("la contraseña legible no trae letras que se confunden al dictar", () => {
  const p = contrasenaLegible(Uint8Array.from({ length: 12 }, (_, i) => i * 37));
  assert.equal(p.length, 12);
  for (const c of p) assert.ok(ABC_CONTRASENA.includes(c));
  for (const c of "lI1O0o") assert.equal(ABC_CONTRASENA.includes(c), false, c);
});

test("filaDePunto: con pin pasa a la oficina; sólo referencias no toca el origen", () => {
  const ahora = new Date("2026-10-06T18:00:00Z");
  assert.deepEqual(filaDePunto({ pin: [25.87, -97.5], sectorId: "s1" }, ahora), {
    lat: 25.87, lng: -97.5, ubicacion_origen: "panel", ubicacion_fecha: "2026-10-06T18:00:00.000Z", sector_id: "s1",
  });
  assert.deepEqual(filaDePunto({ referencias: "  portón azul " }), { referencias: "portón azul" });
  assert.deepEqual(filaDePunto({ referencias: "   " }), { referencias: null });
  assert.deepEqual(filaDePunto({}), {});
});

test("revisarCambiosPunto: el pin tiene que caer en Matamoros", () => {
  assert.equal(revisarCambiosPunto({ pin: [25.8722, -97.5041] }).ok, true);
  assert.deepEqual(revisarCambiosPunto({ pin: [25.87221234, -97.50419876] }).cambios.pin, [25.872212, -97.504199]);
  // Al revés (lng, lat): el error más común al pegar coordenadas.
  assert.equal(revisarCambiosPunto({ pin: [-97.5041, 25.8722] }).ok, false);
  assert.equal(revisarCambiosPunto({ pin: [19.43, -99.13] }).ok, false);
  assert.equal(revisarCambiosPunto({ pin: ["a", "b"] }).ok, false);
  assert.equal(revisarCambiosPunto({}).ok, false);
  assert.equal(revisarCambiosPunto({ referencias: "x".repeat(501) }).ok, false);
  assert.deepEqual(revisarCambiosPunto({ referencias: "" }).cambios, { referencias: "" });
});

test("revisarAsignacion: de 1 a 200 recolecciones al mes, enteras", () => {
  assert.equal(revisarAsignacion({ serviciosPorMes: 0 }).ok, false);
  assert.equal(revisarAsignacion({ serviciosPorMes: 2.5 }).ok, false);
  assert.equal(revisarAsignacion({ serviciosPorMes: 201 }).ok, false);
  assert.deepEqual(revisarAsignacion({ serviciosPorMes: "4", rutaClave: "", porLlamada: 1 }).resultado, {
    rutaClave: null, serviciosPorMes: 4, porLlamada: true,
  });
});

/** Supabase de mentira: guarda los UPDATE e INSERT y contesta lo que se le diga. */
function sbFalso({ tablas = {}, filasUpdate = 1 } = {}) {
  const escrito = [];
  const consulta = (tabla) => {
    const q = {
      _tabla: tabla, _op: "select", _fila: null,
      select() { return q; }, eq() { return q; }, order() { return q; },
      update(f) { q._op = "update"; q._fila = f; return q; },
      insert(f) { q._op = "insert"; q._fila = f; return q; },
      maybeSingle() { return Promise.resolve({ data: tablas[tabla] ?? null, error: null }); },
      then(res, rej) {
        if (q._op === "select") return Promise.resolve({ data: tablas[tabla] ?? [], error: null }).then(res, rej);
        escrito.push({ tabla, op: q._op, fila: q._fila });
        const data = Array.from({ length: filasUpdate }, () => ({ id: "fila-1", ...q._fila }));
        return Promise.resolve({ data, error: null }).then(res, rej);
      },
    };
    return q;
  };
  return { from: consulta, escrito };
}

test("guardarPuntoCon: con pin calcula el sector con los límites de hoy", async () => {
  const sectores = [{ id: "sA", clave: "A", nombre: "Sector A", color: "#000", activo: true, zona: [[25.8, -97.6], [25.95, -97.6], [25.95, -97.4], [25.8, -97.4]] }];
  const sb = sbFalso({ tablas: { sectores } });
  const r = await guardarPuntoCon(sb, { puntoId: "p1", pin: [25.87, -97.5] });
  assert.equal(r.ok, true);
  assert.equal(r.sector.clave, "A");
  const [w] = sb.escrito;
  assert.equal(w.tabla, "domicilios");
  assert.equal(w.fila.ubicacion_origen, "panel");
  assert.equal(w.fila.sector_id, "sA");
});

test("guardarPuntoCon: sólo referencias no recalcula el sector ni el origen", async () => {
  const sb = sbFalso();
  const r = await guardarPuntoCon(sb, { puntoId: "p1", referencias: "portón azul" });
  assert.equal(r.ok, true);
  assert.deepEqual(sb.escrito[0].fila, { referencias: "portón azul" });
});

test("guardarPuntoCon: cero filas = el RLS no dejó, y se dice", async () => {
  const sb = sbFalso({ filasUpdate: 0 });
  const r = await guardarPuntoCon(sb, { puntoId: "p1", referencias: "x" });
  assert.equal(r.ok, false);
});

test("asignarRutaAPuntoCon: crea la suscripción y anota el antes y el después", async () => {
  const sb = sbFalso({
    tablas: {
      domicilios: { id: "d1", cliente_id: "c1", alias: "Planta 1" },
      rutas: { id: "r1", clave: "RT-NORTE", nombre: "Ruta Norte", activa: true },
      suscripciones: null,
    },
  });
  const notas = [];
  const r = await asignarRutaAPuntoCon(
    { sb, anotar: async (e) => notas.push(e) },
    { domicilioId: "d1", rutaClave: "RT-NORTE", serviciosPorMes: 8, porLlamada: false }
  );
  assert.equal(r.ok, true);
  assert.equal(r.suscripcion.rutaNombre, "Ruta Norte");
  assert.equal(sb.escrito[0].op, "insert");
  assert.equal(sb.escrito[0].fila.ruta_id, "r1");
  assert.equal(notas[0].accion, "asignar_ruta_punto");
  assert.equal(notas[0].detalle.antes, null);
});

test("asignarRutaAPuntoCon: no asigna una ruta desactivada", async () => {
  const sb = sbFalso({
    tablas: {
      domicilios: { id: "d1", cliente_id: "c1", alias: "Planta 1" },
      rutas: { id: "r1", clave: "RT-SUR", nombre: "Ruta Sur", activa: false },
    },
  });
  const r = await asignarRutaAPuntoCon({ sb, anotar: async () => {} }, { domicilioId: "d1", rutaClave: "RT-SUR", serviciosPorMes: 4 });
  assert.equal(r.ok, false);
  assert.equal(sb.escrito.length, 0);
});

test("asignarRutaAPuntoCon: NO reactiva el servicio de un cliente dado de baja (Entrega 3)", async () => {
  const sb = sbFalso({
    tablas: {
      domicilios: { id: "d1", cliente_id: "c1", alias: "Planta 1", clientes: { estado: "baja" } },
      rutas: { id: "r1", clave: "RT-NORTE", nombre: "Ruta Norte", activa: true },
      suscripciones: { id: "s1", ruta_id: null, servicios_por_mes: 4, por_llamada: false, estado: "cancelada" },
    },
  });
  const r = await asignarRutaAPuntoCon({ sb, anotar: async () => {} }, { domicilioId: "d1", rutaClave: "RT-NORTE", serviciosPorMes: 4 });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /baja/);
  assert.equal(sb.escrito.length, 0);
});
