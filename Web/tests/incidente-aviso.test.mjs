import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decidirAvisoIncidente,
  datosCorreoIncidente,
  mensajePushIncidente,
  MINUTOS_PARA_AVISAR,
  ENLACE_INCIDENTES,
} from "../lib/incidente-aviso.mjs";

const AHORA = Date.parse("2026-10-05T18:00:00Z");
const hace = (min) => new Date(AHORA - min * 60 * 1000).toISOString();

const inc = {
  id: "i-1",
  tipo: "retraso",
  retraso_min: 45,
  descripcion: "Tráfico en la carretera",
  ubicacion: { lat: 25.87, lng: -97.5 },
  operador_id: "u-cho",
  creado: hace(2),
  avisado_en: null,
  rutas: { nombre: "Ruta Norte", unidad: "U-texto" },
  unidades: { numero_economico: "U-07" },
  solicitudes_recoleccion: { folio: "REC-1", clientes: { empresa: "Vidriera" }, domicilios: { alias: "Bodega" } },
  contenedores: { codigo: "MOR-C-0001" },
};

test("el chofer avisa de SU incidente reciente", () => {
  assert.deepEqual(decidirAvisoIncidente(inc, { uid: "u-cho", ahora: AHORA }), { ok: true });
});

test("uno ajeno o inexistente responde igual: 404", () => {
  const ajeno = decidirAvisoIncidente(inc, { uid: "otro", ahora: AHORA });
  const nada = decidirAvisoIncidente(null, { uid: "u-cho", ahora: AHORA });
  assert.equal(ajeno.status, 404);
  assert.deepEqual(ajeno, nada);
});

test("ya avisado: no se repite (reintento de la app)", () => {
  const r = decidirAvisoIncidente({ ...inc, avisado_en: hace(1) }, { uid: "u-cho", ahora: AHORA });
  assert.deepEqual(r, { ok: true, yaAvisado: true });
});

test("uno viejo ya no se avisa", () => {
  const r = decidirAvisoIncidente({ ...inc, creado: hace(MINUTOS_PARA_AVISAR + 1) }, { uid: "u-cho", ahora: AHORA });
  assert.equal(r.ok, false);
  assert.equal(r.status, 400);
  assert.equal(decidirAvisoIncidente({ ...inc, creado: "basura" }, { uid: "u-cho", ahora: AHORA }).ok, false);
});

test("el correo lleva lo necesario para actuar", () => {
  const d = datosCorreoIncidente(inc, { chofer: "Beto" });
  assert.equal(d.asunto, "Retraso (45 min) · reporte de Beto");
  assert.equal(d.tipoTexto, "Retraso");
  assert.equal(d.urgente, false);
  assert.equal(d.unidad, "U-07");
  assert.equal(d.ruta, "Ruta Norte");
  assert.equal(d.parada, "REC-1 · Vidriera · Bodega");
  assert.equal(d.contenedor, "MOR-C-0001");
  assert.equal(d.retraso, "45 min");
  assert.equal(d.mapa, "https://www.google.com/maps?q=25.87,-97.5");
  assert.equal(d.enlace, ENLACE_INCIDENTES);
  assert.ok(d.cuando.length > 0);
});

test("sin relaciones ni coordenadas, no inventa nada", () => {
  const d = datosCorreoIncidente({ id: "i", tipo: "accidente", creado: hace(1), ubicacion: {} }, { chofer: "" });
  assert.equal(d.urgente, true);
  assert.equal(d.chofer, "Sin nombre");
  assert.equal(d.unidad, null);
  assert.equal(d.parada, null);
  assert.equal(d.mapa, null);
  assert.equal(d.retraso, null);
});

test("la notificación es corta y abre el incidente", () => {
  const m = mensajePushIncidente(inc, { chofer: "Beto" });
  assert.equal(m.titulo, "Retraso (45 min)");
  assert.equal(m.cuerpo, "Beto · Ruta Norte · REC-1 · Vidriera · Bodega: Tráfico en la carretera");
  assert.deepEqual(m.datos, { tipo: "incidente", id: "i-1" });
  const urgente = mensajePushIncidente({ id: "i-2", tipo: "accidente" }, { chofer: "" });
  assert.equal(urgente.titulo, "URGENTE · Accidente");
  assert.equal(urgente.cuerpo, "Un chofer");
});
