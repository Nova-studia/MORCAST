import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validarAviso,
  filaAviso,
  calcularDestinatarios,
  resumenDestinatarios,
  fraseResumen,
  avisoVigente,
  sinOcultos,
  textoAlcance,
  borradorRetraso,
  duracionEnLetra,
  hoyMatamoros,
  correoValido,
} from "../lib/avisos.mjs";

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
const HOY = "2026-10-05";

const base = { alcance: "todos", motivo: "retraso", titulo: "Retraso en Ruta Norte", mensaje: "Hoy vamos tarde." };

test("un aviso a todos válido sale sin ids colgando", () => {
  const r = validarAviso({ ...base, rutaId: U1, sectorId: U2 }, { hoy: HOY });
  assert.equal(r.ok, true);
  assert.equal(r.limpio.rutaId, null);
  assert.equal(r.limpio.sectorId, null);
  assert.equal(r.limpio.clienteId, null);
  // La fila cumple el check de la base: "todos" sin ningún id.
  const fila = filaAviso(r.limpio);
  assert.deepEqual([fila.sector_id, fila.ruta_id, fila.cliente_id], [null, null, null]);
  assert.equal(fila.alcance, "todos");
});

test("alcance por ruta exige la ruta, y solo conserva esa", () => {
  assert.equal(validarAviso({ ...base, alcance: "ruta" }, { hoy: HOY }).ok, false);
  const r = validarAviso({ ...base, alcance: "ruta", rutaId: U1, sectorId: U2 }, { hoy: HOY });
  assert.equal(r.ok, true);
  assert.equal(r.limpio.rutaId, U1);
  assert.equal(r.limpio.sectorId, null);
});

test("con la base de verdad, un id que no es UUID se rechaza con un mensaje entendible", () => {
  const r = validarAviso({ ...base, alcance: "sector", sectorId: "A" }, { hoy: HOY, exigirUuid: true });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /no existe/);
  assert.equal(validarAviso({ ...base, alcance: "sector", sectorId: "A" }, { hoy: HOY }).ok, true);
});

test("título y mensaje: obligatorios, con tope, y el título en un solo renglón", () => {
  assert.equal(validarAviso({ ...base, titulo: "  " }, { hoy: HOY }).ok, false);
  assert.equal(validarAviso({ ...base, mensaje: "" }, { hoy: HOY }).ok, false);
  assert.equal(validarAviso({ ...base, titulo: "x".repeat(121) }, { hoy: HOY }).ok, false);
  assert.equal(validarAviso({ ...base, mensaje: "x".repeat(2001) }, { hoy: HOY }).ok, false);
  const r = validarAviso({ ...base, titulo: "Retraso\nen\r\nla ruta" }, { hoy: HOY });
  assert.equal(r.limpio.titulo, "Retraso en la ruta");
});

test("motivo y alcance desconocidos no pasan", () => {
  assert.equal(validarAviso({ ...base, motivo: "spam" }, { hoy: HOY }).ok, false);
  assert.equal(validarAviso({ ...base, alcance: "mundo" }, { hoy: HOY }).ok, false);
});

test("la vigencia puede ser hoy, no ayer, y tiene que ser una fecha", () => {
  assert.equal(validarAviso({ ...base, vigenteHasta: HOY }, { hoy: HOY }).ok, true);
  assert.equal(validarAviso({ ...base, vigenteHasta: "2026-10-04" }, { hoy: HOY }).ok, false);
  assert.equal(validarAviso({ ...base, vigenteHasta: "mañana" }, { hoy: HOY }).ok, false);
  assert.equal(validarAviso({ ...base, vigenteHasta: "" }, { hoy: HOY }).limpio.vigenteHasta, null);
});

test("hoy en Matamoros no es hoy en UTC: a las 8 pm del 5 sigue siendo 5", () => {
  // 2026-10-06 01:00 UTC = 2026-10-05 20:00 en Matamoros (UTC-5 en octubre).
  assert.equal(hoyMatamoros(new Date("2026-10-06T01:00:00Z")), "2026-10-05");
});

const datos = {
  clientes: [
    { id: "c1", empresa: "Uno", correo: "compras@uno.mx", estado: "activo" },
    { id: "c2", empresa: "Dos", correo: "", estado: "activo" },
    { id: "c3", empresa: "Tres", correo: "COMPRAS@uno.mx", estado: "pendiente-info" },
    { id: "c4", empresa: "Cuatro", correo: "cuatro@x.mx", estado: "suspendido" },
    { id: "c5", empresa: "Cinco", correo: "no-es-correo", estado: "activo" },
    { id: "c6", empresa: "Seis", correo: "seis@x.mx", estado: "baja" },
  ],
  domicilios: [
    { cliente_id: "c1", sector_id: "A" },
    { cliente_id: "c1", sector_id: "A" }, // dos plantas en el mismo sector
    { cliente_id: "c2", sector_id: "B" },
    { cliente_id: "c4", sector_id: "A" },
  ],
  suscripciones: [
    { cliente_id: "c1", ruta_id: "R1", estado: "activa" },
    { cliente_id: "c3", ruta_id: "R1", estado: "activa" },
    { cliente_id: "c2", ruta_id: "R1", estado: "pausada" },
    { cliente_id: "c5", ruta_id: "R2", estado: "activa" },
  ],
};

test("a todos: solo activos y pendientes de info; el correo repetido se manda una vez", () => {
  const d = calcularDestinatarios({ alcance: "todos" }, datos);
  assert.deepEqual(d.clientes.map((c) => c.id), ["c1", "c2", "c3", "c5"]);
  assert.deepEqual(d.correos.map((c) => c.correo), ["compras@uno.mx"]);
  assert.deepEqual(d.sinCorreo.map((c) => c.id), ["c2", "c5"]);
  assert.deepEqual(resumenDestinatarios(d), { clientes: 4, correos: 1, sinCorreo: 2 });
});

test("por sector: la empresa con dos plantas cuenta una vez y el suspendido no entra", () => {
  const d = calcularDestinatarios({ alcance: "sector", sectorId: "A" }, datos);
  assert.deepEqual(d.clientes.map((c) => c.id), ["c1"]);
});

test("por ruta: solo suscripciones activas", () => {
  const d = calcularDestinatarios({ alcance: "ruta", rutaId: "R1" }, datos);
  assert.deepEqual(d.clientes.map((c) => c.id), ["c1", "c3"]);
  assert.equal(d.correos.length, 1);
});

test("a un cliente: llega aunque esté suspendido (lo eligieron a mano)", () => {
  const d = calcularDestinatarios({ alcance: "cliente", clienteId: "c4" }, datos);
  assert.deepEqual(d.correos, [{ correo: "cuatro@x.mx", empresa: "Cuatro", clienteId: "c4" }]);
});

test("la frase de la vista previa no dice '1 clientes'", () => {
  assert.equal(fraseResumen({ clientes: 1, correos: 1, sinCorreo: 0 }), "Le llegará a 1 cliente: 1 correo.");
  assert.equal(
    fraseResumen({ clientes: 3, correos: 2, sinCorreo: 1 }),
    "Le llegará a 3 clientes: 2 correos y 1 cliente sin correo, que solo lo verá en su portal."
  );
  assert.match(fraseResumen({ clientes: 0, correos: 0, sinCorreo: 0 }), /no le llegaría a nadie/);
});

test("vigente: sin fecha dura 30 días; con fecha, hasta ese día inclusive", () => {
  const ahora = new Date("2026-10-05T18:00:00Z");
  const op = { hoy: HOY, ahora };
  assert.equal(avisoVigente({ creado: "2026-10-01T10:00:00Z", vigente_hasta: null }, op), true);
  assert.equal(avisoVigente({ creado: "2026-08-20T10:00:00Z", vigente_hasta: null }, op), false);
  assert.equal(avisoVigente({ creado: "2026-10-01T10:00:00Z", vigente_hasta: HOY }, op), true);
  assert.equal(avisoVigente({ creado: "2026-10-01T10:00:00Z", vigente_hasta: "2026-10-04" }, op), false);
  // Con fecha lejana, igual se va a los 30 días: el portal no es un archivo.
  assert.equal(avisoVigente({ creado: "2026-08-01T10:00:00Z", vigente_hasta: "2026-12-31" }, op), false);
  assert.equal(avisoVigente(null, op), false);
});

test("los cerrados en la sesión no se vuelven a enseñar", () => {
  assert.deepEqual(sinOcultos([{ id: 1 }, { id: 2 }], [2]), [{ id: 1 }]);
  assert.deepEqual(sinOcultos([{ id: 1 }], null), [{ id: 1 }]);
});

test("el alcance se lee con el nombre de lo que trae la fila", () => {
  assert.equal(textoAlcance({ alcance: "todos" }), "Todos los clientes");
  assert.equal(textoAlcance({ alcance: "ruta", rutas: { nombre: "Ruta Norte" } }), "Ruta Norte");
  assert.equal(textoAlcance({ alcance: "cliente", clientes: null }), "Un cliente");
});

test("duración en letra, como la diría una persona", () => {
  assert.equal(duracionEnLetra(1), "1 minuto");
  assert.equal(duracionEnLetra(45), "45 minutos");
  assert.equal(duracionEnLetra(90), "hora y media");
  assert.equal(duracionEnLetra(137), "2 horas y media");
  assert.equal(duracionEnLetra(180), "3 horas");
  assert.equal(duracionEnLetra(0), "");
});

test("el borrador de retraso nombra la ruta y el tiempo, y aguanta que falten", () => {
  const b = borradorRetraso({ rutaNombre: "Ruta Norte", minutos: 40 });
  assert.equal(b.titulo, "Retraso en Ruta Norte");
  assert.match(b.mensaje, /aproximadamente 40 minutos/);
  const sin = borradorRetraso({});
  assert.equal(sin.titulo, "Retraso en tu ruta");
  assert.doesNotMatch(sin.mensaje, /aproximadamente/);
});

test("correo válido", () => {
  assert.equal(correoValido(" a@b.mx "), true);
  assert.equal(correoValido("a@b"), false);
  assert.equal(correoValido(null), false);
});

test("la vista previa solo pide el destino, no el mensaje", async () => {
  const { validarAlcance } = await import("../lib/avisos.mjs");
  assert.deepEqual(validarAlcance({ alcance: "cliente", clienteId: " c4 ", rutaId: "R1" }).limpio, {
    alcance: "cliente", sectorId: null, rutaId: null, clienteId: "c4",
  });
  assert.equal(validarAlcance({ alcance: "sector" }).ok, false);
  assert.equal(validarAlcance({}).ok, false);
});
