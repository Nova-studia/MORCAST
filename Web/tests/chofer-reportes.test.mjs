import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validarNoProcedio,
  validarReporte,
  limpiarUbicacion,
  rutaEnCarpeta,
  textoMinutos,
  asuntoIncidente,
  esDeContenedor,
  TIPOS_INCIDENTE,
} from "../lib/chofer-reportes.mjs";

const UUID = "3f2a9c1e-8b7d-4e6f-9a01-23456789abcd";
const UUID2 = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

/* ----------------------------- No procedió ----------------------------- */

test("no procedió: sin motivo no pasa", () => {
  const r = validarNoProcedio({ motivo: "", detalle: "algo" });
  assert.equal(r.ok, false);
  assert.equal(r.campo, "motivo");
});

test("no procedió: un motivo inventado no pasa (la oficina tiene que poder contarlos)", () => {
  assert.equal(validarNoProcedio({ motivo: "Me dio flojera" }).ok, false);
});

test("no procedió: motivo de la lista sin detalle pasa, y el detalle vacío va como null", () => {
  const r = validarNoProcedio({ motivo: "Cerrado o sin acceso", detalle: "   " });
  assert.deepEqual(r, {
    ok: true,
    datos: { motivo_no_procedio: "Cerrado o sin acceso", detalle_no_procedio: null },
  });
});

test("no procedió: «Otro» exige detalle", () => {
  assert.equal(validarNoProcedio({ motivo: "Otro" }).campo, "detalle");
  assert.equal(validarNoProcedio({ motivo: "Otro", detalle: "ok" }).ok, false);
  const r = validarNoProcedio({ motivo: "Otro", detalle: "  Había un perro suelto  " });
  assert.equal(r.ok, true);
  assert.equal(r.datos.detalle_no_procedio, "Había un perro suelto");
});

test("no procedió: detalle demasiado largo no pasa", () => {
  const r = validarNoProcedio({ motivo: "Otro", detalle: "x".repeat(501) });
  assert.equal(r.ok, false);
});

/* ------------------------------- Reporte ------------------------------- */

test("reporte: sin tipo, o con un tipo que la base no acepta, no pasa", () => {
  assert.equal(validarReporte({}).campo, "tipo");
  assert.equal(validarReporte({ tipo: "incendio" }).ok, false);
});

test("los tipos son exactamente los del check de la base (db/023)", () => {
  assert.deepEqual(
    TIPOS_INCIDENTE.map((t) => t.id).sort(),
    ["accidente", "contenedor-danado", "contenedor-movido", "contenedor-no-esta", "falla-mecanica", "otro", "retraso"]
  );
});

test("reporte: un accidente pasa aunque no traiga descripción (no se le hace escribir)", () => {
  const r = validarReporte({ tipo: "accidente" });
  assert.equal(r.ok, true);
  assert.equal(r.datos.tipo, "accidente");
  assert.equal(r.datos.descripcion, null);
  assert.equal(r.datos.retraso_min, null);
});

test("reporte: retraso exige minutos enteros entre 1 y 1440", () => {
  assert.equal(validarReporte({ tipo: "retraso" }).campo, "retrasoMin");
  assert.equal(validarReporte({ tipo: "retraso", retrasoMin: "" }).ok, false);
  assert.equal(validarReporte({ tipo: "retraso", retrasoMin: 0 }).ok, false);
  assert.equal(validarReporte({ tipo: "retraso", retrasoMin: 12.5 }).ok, false);
  assert.equal(validarReporte({ tipo: "retraso", retrasoMin: 1441 }).ok, false);
  assert.equal(validarReporte({ tipo: "retraso", retrasoMin: "45" }).datos.retraso_min, 45);
});

test("reporte: los minutos solo se guardan en un retraso", () => {
  assert.equal(validarReporte({ tipo: "falla-mecanica", retrasoMin: 30 }).datos.retraso_min, null);
});

test("reporte: «otra cosa» exige descripción", () => {
  assert.equal(validarReporte({ tipo: "otro", descripcion: " " }).campo, "descripcion");
  assert.equal(validarReporte({ tipo: "otro", descripcion: "Se cayó la lona" }).ok, true);
});

test("reporte: el contenedor solo se amarra en los tipos de contenedor", () => {
  const cont = validarReporte({ tipo: "contenedor-danado", contenedorId: UUID, solicitudId: UUID2 });
  assert.equal(cont.datos.contenedor_id, UUID);
  assert.equal(cont.datos.solicitud_id, UUID2);
  assert.equal(validarReporte({ tipo: "accidente", contenedorId: UUID }).datos.contenedor_id, null);
  assert.equal(esDeContenedor("contenedor-no-esta"), true);
  assert.equal(esDeContenedor("retraso"), false);
});

test("reporte: un id sin forma de uuid se descarta en vez de mandarlo a la base", () => {
  const r = validarReporte({ tipo: "contenedor-movido", contenedorId: "1; drop table", solicitudId: "x" });
  assert.equal(r.datos.contenedor_id, null);
  assert.equal(r.datos.solicitud_id, null);
});

test("reporte: descripción de más de 1000 letras no pasa", () => {
  assert.equal(validarReporte({ tipo: "accidente", descripcion: "a".repeat(1001) }).ok, false);
});

test("la ubicación se rearma campo por campo y descarta lo que sobre", () => {
  const u = limpiarUbicacion({
    lat: 25.8697123456, lng: -97.5027, precision_m: 12.6, capturada: "2026-10-05T15:00:00Z", extra: "<script>",
  });
  assert.deepEqual(u, { lat: 25.869712, lng: -97.5027, precision_m: 13, capturada: "2026-10-05T15:00:00.000Z" });
  assert.equal(limpiarUbicacion({ lat: "x", lng: 1 }), null);
  assert.equal(limpiarUbicacion({ lat: 200, lng: 1 }), null);
  assert.equal(limpiarUbicacion(null), null);
  assert.equal(limpiarUbicacion({ lat: 25.8, lng: -97.5, capturada: "no es fecha" }).capturada, null);
});

test("la foto tiene que estar en la carpeta de quien la manda", () => {
  assert.equal(rutaEnCarpeta(`${UUID}/1700000000.jpg`, UUID), true);
  assert.equal(rutaEnCarpeta(`${UUID2}/1700000000.jpg`, UUID), false);
  assert.equal(rutaEnCarpeta(`${UUID}/../${UUID2}/a.jpg`, UUID), false);
  assert.equal(rutaEnCarpeta(`${UUID}/`, UUID), false);
  assert.equal(rutaEnCarpeta(`/${UUID}/a.jpg`, UUID), false);
  assert.equal(rutaEnCarpeta("", UUID), false);
  // Un prefijo parecido no cuenta: la carpeta termina en la diagonal.
  assert.equal(rutaEnCarpeta(`${UUID}x/a.jpg`, UUID), false);
});

test("los minutos se dicen como por teléfono", () => {
  assert.equal(textoMinutos(45), "45 min");
  assert.equal(textoMinutos(60), "1 h");
  assert.equal(textoMinutos(90), "1 h 30 min");
  assert.equal(textoMinutos(0), "");
});

test("el asunto marca URGENTE solo en el accidente", () => {
  assert.equal(asuntoIncidente({ tipo: "accidente", chofer: "José" }), "URGENTE · Accidente reportado por José");
  assert.equal(asuntoIncidente({ tipo: "retraso", chofer: "José", retrasoMin: 90 }), "Retraso (1 h 30 min) · reporte de José");
  assert.doesNotMatch(asuntoIncidente({ tipo: "contenedor-danado", chofer: "" }), /URGENTE/);
  assert.match(asuntoIncidente({ tipo: "contenedor-danado", chofer: "" }), /un chofer$/);
});

/* --------------------------- Correo a la oficina --------------------------- */

test("el correo del incidente va a la oficina, escapado y sin renglones vacíos", async () => {
  process.env.RESEND_API_KEY = "re_prueba";
  process.env.CORREO_AVISOS = "avisos@prueba.mx";
  const enviados = [];
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async (url, opciones) => {
    enviados.push({ url, cuerpo: JSON.parse(opciones.body) });
    return { ok: true, json: async () => ({ id: "x" }) };
  };
  try {
    const { correoIncidente } = await import("../lib/correo.js");
    await correoIncidente({
      asunto: "URGENTE · Accidente reportado por José",
      tipoTexto: "Accidente",
      urgente: true,
      chofer: "José <b>Medina</b>",
      unidad: "U-07",
      ruta: "Ruta Industrial",
      parada: "REC-2026-0142 · Industrias del Golfo",
      contenedor: null,
      descripcion: "Me pegaron <script>alert(1)</script>",
      retraso: null,
      mapa: "https://www.google.com/maps?q=25.8,-97.5",
      cuando: "lunes 5 de octubre, 10:30",
      enlace: "https://morcast.mx/admin/incidentes",
    });

    assert.equal(enviados.length, 1);
    const { cuerpo } = enviados[0];
    assert.deepEqual(cuerpo.to, ["avisos@prueba.mx"]);
    assert.equal(cuerpo.subject, "URGENTE · Accidente reportado por José");
    assert.match(cuerpo.html, /Urgente\./);
    assert.match(cuerpo.html, /https:\/\/morcast\.mx\/admin\/incidentes/);
    assert.match(cuerpo.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.match(cuerpo.html, /José &lt;b&gt;Medina&lt;\/b&gt;/);
    assert.doesNotMatch(cuerpo.html, /<script>/);
    // Lo que no vino no aparece como renglón vacío.
    assert.doesNotMatch(cuerpo.html, />Contenedor</);
    assert.doesNotMatch(cuerpo.html, />Retraso</);
    assert.match(cuerpo.html, />Unidad</);
  } finally {
    globalThis.fetch = fetchOriginal;
    delete process.env.RESEND_API_KEY;
    delete process.env.CORREO_AVISOS;
  }
});
