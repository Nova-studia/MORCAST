import { test } from "node:test";
import assert from "node:assert/strict";
import {
  accionDeProgramacion,
  puedeRechazar,
  validarProgramacion,
  motivoDeRechazo,
  choferesPorAvisar,
  mensajePushParada,
  esFechaValida,
  sumarDias,
  MOTIVO_RECHAZO_POR_OMISION,
} from "../lib/oficina-recolecciones.mjs";
import {
  decidirAvisoSolicitud,
  mensajePushSolicitud,
  datosCorreoSolicitud,
  esFolioRecoleccion,
} from "../lib/solicitud-aviso.mjs";

const HOY = "2026-10-06";
const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

/* ---------------- Qué acción es (la decide el servidor) ---------------- */

test("una solicitada al día se CONFIRMA", () => {
  const r = accionDeProgramacion({ estado: "solicitada", fecha_pedida: "2026-10-09" }, HOY);
  assert.deepEqual(r, { ok: true, accion: "confirmar_recoleccion" });
});

test("una vencida se REAGENDA, venga de solicitada, confirmada o en ruta", () => {
  for (const estado of ["solicitada", "confirmada", "en-ruta"]) {
    const r = accionDeProgramacion({ estado, fecha_pedida: "2026-10-01", fecha_confirmada: "2026-10-02" }, HOY);
    assert.equal(r.accion, "reagendar_recoleccion_vencida", estado);
  }
});

test("una confirmada al día se CAMBIA; en ruta al día no se toca", () => {
  assert.equal(
    accionDeProgramacion({ estado: "confirmada", fecha_confirmada: "2026-10-06" }, HOY).accion,
    "cambiar_recoleccion_confirmada"
  );
  const enRuta = accionDeProgramacion({ estado: "en-ruta", fecha_confirmada: "2026-10-06" }, HOY);
  assert.equal(enRuta.ok, false);
  assert.equal(enRuta.status, 409);
});

test("las cerradas no se programan y lo que no existe es 404", () => {
  for (const estado of ["completada", "rechazada", "no-procedio"]) {
    assert.equal(accionDeProgramacion({ estado, fecha_pedida: "2026-10-01" }, HOY).status, 409);
  }
  assert.equal(accionDeProgramacion(null, HOY).status, 404);
});

test("se rechaza una solicitada o una vencida, nunca una confirmada al día", () => {
  assert.equal(puedeRechazar({ estado: "solicitada", fecha_pedida: "2026-10-09" }, HOY), true);
  assert.equal(puedeRechazar({ estado: "confirmada", fecha_confirmada: "2026-10-02" }, HOY), true);
  assert.equal(puedeRechazar({ estado: "confirmada", fecha_confirmada: "2026-10-08" }, HOY), false);
  assert.equal(puedeRechazar({ estado: "completada", fecha_pedida: "2026-10-01" }, HOY), false);
  assert.equal(puedeRechazar(null, HOY), false);
});

/* ---------------- Lo que manda el teléfono ---------------- */

test("validarProgramacion arma los cambios con nulos donde no se eligió", () => {
  const r = validarProgramacion({ fecha: "2026-10-07", hora: "", chofer_id: "" }, HOY);
  assert.deepEqual(r, {
    ok: true,
    cambios: { estado: "confirmada", fecha_confirmada: "2026-10-07", hora_confirmada: null, chofer_id: null },
  });
  const c = validarProgramacion({ fecha: "2026-10-06", hora: "09:30:00", chofer_id: UUID_A.toUpperCase() }, HOY);
  assert.equal(c.cambios.hora_confirmada, "09:30");
  assert.equal(c.cambios.chofer_id, UUID_A);
});

test("validarProgramacion rechaza días pasados, imposibles o lejanos, horas y choferes malos", () => {
  assert.equal(validarProgramacion({ fecha: "2026-10-05" }, HOY).ok, false);
  assert.equal(validarProgramacion({ fecha: "2026-02-30" }, HOY).ok, false);
  assert.equal(validarProgramacion({ fecha: "" }, HOY).ok, false);
  assert.equal(validarProgramacion({ fecha: "2028-01-01" }, HOY).ok, false);
  assert.equal(validarProgramacion({ fecha: "2026-10-07", hora: "25:00" }, HOY).ok, false);
  assert.equal(validarProgramacion({ fecha: "2026-10-07", hora: "9:30" }, HOY).ok, false);
  assert.equal(validarProgramacion({ fecha: "2026-10-07", chofer_id: "pepe" }, HOY).ok, false);
});

test("fechas de calendario sin zona horaria", () => {
  assert.equal(esFechaValida("2028-02-29"), true);
  assert.equal(esFechaValida("2027-02-29"), false);
  assert.equal(sumarDias("2026-12-31", 1), "2027-01-01");
});

test("motivo del rechazo: vacío = el de la web; largo = no", () => {
  assert.deepEqual(motivoDeRechazo("  "), { ok: true, motivo: MOTIVO_RECHAZO_POR_OMISION });
  assert.deepEqual(motivoDeRechazo("  Ruta   llena "), { ok: true, motivo: "Ruta llena" });
  assert.equal(motivoDeRechazo("x".repeat(301)).ok, false);
});

/* ---------------- Push al chofer ---------------- */

test("primera confirmación: parada nueva para el chofer asignado (o el de la ruta)", () => {
  assert.deepEqual(
    choferesPorAvisar({ estado: "solicitada", chofer_id: null, rutas: { chofer_id: UUID_A } }, { estado: "confirmada", chofer_id: null, rutas: { chofer_id: UUID_A } }),
    [{ uid: UUID_A, evento: "asignada" }]
  );
  assert.deepEqual(choferesPorAvisar(null, { estado: "confirmada", chofer_id: UUID_B }), [{ uid: UUID_B, evento: "asignada" }]);
});

test("cambio de hora con el mismo chofer: 'cambiada'; cambio de chofer: nueva + quitada", () => {
  assert.deepEqual(
    choferesPorAvisar({ estado: "confirmada", chofer_id: UUID_A }, { estado: "confirmada", chofer_id: UUID_A }),
    [{ uid: UUID_A, evento: "cambiada" }]
  );
  assert.deepEqual(
    choferesPorAvisar({ estado: "confirmada", chofer_id: UUID_A }, { estado: "confirmada", chofer_id: UUID_B }),
    [{ uid: UUID_B, evento: "asignada" }, { uid: UUID_A, evento: "quitada" }]
  );
});

test("rechazar una vencida que ya era de un chofer le avisa que ya no va", () => {
  assert.deepEqual(
    choferesPorAvisar({ estado: "confirmada", chofer_id: UUID_A }, { estado: "rechazada", chofer_id: UUID_A }),
    [{ uid: UUID_A, evento: "quitada" }]
  );
  assert.deepEqual(choferesPorAvisar({ estado: "solicitada", chofer_id: null }, { estado: "rechazada" }), []);
});

test("el mensaje al chofer lleva tipo parada, id y folio para abrir y releer su ruta", () => {
  const m = mensajePushParada("asignada", { id: "x", folio: "REC-2026-0007", cliente: "Vidriera", fecha: "2026-10-08", hora: "09:30:00" });
  assert.equal(m.titulo, "Parada nueva");
  assert.match(m.cuerpo, /Vidriera, el jueves 8 de octubre a las 09:30/);
  assert.deepEqual(m.datos, { tipo: "parada", id: "x", folio: "REC-2026-0007", evento: "asignada" });
  assert.equal(mensajePushParada("quitada", { folio: "F" }).titulo, "Te quitaron una parada");
  assert.equal(mensajePushParada("cambiada", { folio: "F" }).titulo, "Cambió una de tus paradas");
});

/* ---------------- Aviso a la oficina de una solicitud ---------------- */

const AHORA = new Date("2026-10-06T18:00:00Z").getTime();
const sol = (extra) => ({
  id: "s1", folio: "REC-2026-0042", estado: "solicitada", cliente_id: "c1",
  creado: "2026-10-06T17:50:00Z", fecha_pedida: "2026-10-08", origen: "ruta",
  tipo_residuo: "Cartón", clientes: { empresa: "Vidriera" }, domicilios: { alias: "Matriz", calle: "Av. 1" },
  ...extra,
});

test("solo se avisa de una solicitud propia, reciente y sin atender", () => {
  assert.deepEqual(decidirAvisoSolicitud(sol(), { clienteId: "c1", ahora: AHORA }), { ok: true });
  assert.equal(decidirAvisoSolicitud(sol(), { clienteId: "otro", ahora: AHORA }).status, 404);
  assert.equal(decidirAvisoSolicitud(null, { clienteId: "c1", ahora: AHORA }).status, 404);
  assert.equal(decidirAvisoSolicitud(sol({ creado: "2026-10-06T10:00:00Z" }), { clienteId: "c1", ahora: AHORA }).status, 400);
  assert.deepEqual(decidirAvisoSolicitud(sol({ estado: "confirmada" }), { clienteId: "c1", ahora: AHORA }), { ok: true, nada: true });
});

test("el push a la oficina abre Recolecciones en esa solicitud", () => {
  const m = mensajePushSolicitud(sol());
  assert.equal(m.titulo, "Recolección pedida");
  assert.match(m.cuerpo, /Vidriera: para el jueves 8 de octubre · Cartón\. Folio REC-2026-0042\./);
  assert.deepEqual(m.datos, { tipo: "solicitud", id: "s1", folio: "REC-2026-0042" });
  assert.equal(mensajePushSolicitud(sol({ origen: "extra" })).titulo, "Recolección extra pedida");
});

test("el correo a la oficina lleva lo necesario para confirmar", () => {
  const d = datosCorreoSolicitud(sol());
  assert.equal(d.punto, "Matriz · Av. 1");
  assert.equal(d.residuo, "Cartón");
  assert.match(d.asunto, /Vidriera — REC-2026-0042/);
  assert.equal(esFolioRecoleccion("REC-2026-0042"), true);
  assert.equal(esFolioRecoleccion("REC-2026-0042'; drop"), false);
});
