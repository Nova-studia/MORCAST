// Apps al 100% (9-oct-2026), fase A y B del cliente: punto al agendar, el
// estado que se enseña, la sesión que ya no vale, el error de la base al
// pedir y los mensajes de soporte.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  rutaParaAgendar,
  faltaElegirPunto,
  estadoSolicitudCliente,
  motivoFalloPedido,
  decidirSesion,
  avisoDeSalida,
  mensajeSoporte,
  mensajeSuspendido,
  mensajeVencida,
  textoCambioHecho,
  lineaDePunto,
} from "../src/cliente-app.mjs";
import { puntosAgendables, puntoInicial } from "../src/web/puntos-cliente.mjs";
import { AVISO_BAJA } from "../src/web/estado-cliente.mjs";

const ESTADOS = [
  { id: "solicitada", texto: "Solicitada", clase: "prog" },
  { id: "rechazada", texto: "Rechazada", clase: "mal" },
];

const SUBS = [
  { estado: "activa", domicilio_id: "d2", domicilios: { alias: "Planta 2", colonia: "Sur" }, rutas: { id: "r2", clave: "RT-2", nombre: "Ruta Sur", tipo: "rsu", dias: ["martes"] } },
  { estado: "activa", domicilio_id: "d1", domicilios: { alias: "Oficina", colonia: "Centro" }, rutas: { id: "r1", clave: "RT-1", nombre: "Ruta Centro", tipo: "rsu", dias: ["lunes", "jueves"] } },
];

test("con varios puntos, la ruta (y sus días) es la del punto elegido; sin elegir, ninguna", () => {
  const puntos = puntosAgendables(SUBS);
  assert.equal(puntoInicial(puntos), "", "con dos puntos no se escoge solo");
  assert.equal(faltaElegirPunto(puntos, ""), true);
  assert.equal(rutaParaAgendar({ puntos, puntoId: "", suscripcion: null }), null);
  const r = rutaParaAgendar({ puntos, puntoId: "d1", suscripcion: null });
  assert.equal(r.clave, "RT-1");
  assert.deepEqual(r.dias, ["lunes", "jueves"]);
  assert.equal(faltaElegirPunto(puntos, "d1"), false);
});

test("con un punto se escoge solo; sin puntos se usa la suscripción de siempre", () => {
  const uno = puntosAgendables(SUBS.slice(0, 1));
  assert.equal(puntoInicial(uno), "d2");
  assert.equal(faltaElegirPunto(uno, "d2"), false);
  const su = { ruta: { clave: "RT-9", nombre: "Vieja", dias: ["sábado"] } };
  assert.equal(rutaParaAgendar({ puntos: [], puntoId: "", suscripcion: su }).clave, "RT-9");
  assert.equal(faltaElegirPunto([], ""), false);
});

test("una rechazada por el propio cliente se enseña «Cancelada», no «Rechazada»", () => {
  assert.deepEqual(
    estadoSolicitudCliente({ estado: "rechazada", motivoRechazo: "Cancelada por el cliente: ya no hace falta" }, ESTADOS),
    { id: "cancelada", texto: "Cancelada", clase: "none" }
  );
  assert.equal(estadoSolicitudCliente({ estado: "rechazada", motivoRechazo: "Sin cupo" }, ESTADOS).texto, "Rechazada");
  assert.equal(estadoSolicitudCliente({ estado: "solicitada" }, ESTADOS).clase, "prog");
  assert.equal(estadoSolicitudCliente({ estado: "rara" }, ESTADOS).texto, "rara");
});

test("el rechazo de la base por cuenta suspendida no se disfraza de «fecha»", () => {
  const rls = 'new row violates row-level security policy for table "solicitudes_recoleccion"';
  assert.match(motivoFalloPedido(rls, "suspendido"), /suspendida/);
  assert.match(motivoFalloPedido(rls, "baja"), /baja/);
  assert.match(motivoFalloPedido(rls, "activo"), /Esa fecha no se puede/);
  assert.match(motivoFalloPedido(rls, null), /Esa fecha no se puede/);
  assert.match(motivoFalloPedido('duplicate key value violates unique constraint "folio"', "activo"), /Inténtalo de nuevo/);
  assert.equal(motivoFalloPedido("otra cosa", "activo"), "otra cosa");
});

test("sesión: la red no saca a nadie; un token que el servidor ya no acepta, sí", () => {
  assert.equal(decidirSesion({ user: { id: "u" }, error: null }), "seguir");
  assert.equal(decidirSesion({ user: null, error: { name: "AuthRetryableFetchError", status: 0, message: "Failed to fetch" } }), "red");
  assert.equal(decidirSesion({ user: null, error: { message: "Network request failed" } }), "red");
  assert.equal(decidirSesion({ user: null, error: { name: "AuthApiError", status: 403, code: "user_banned", message: "User is banned" } }), "salir");
  assert.equal(decidirSesion({ user: null, error: { name: "AuthApiError", status: 401, message: "invalid JWT" } }), "salir");
  assert.equal(decidirSesion({ user: null, error: { name: "AuthApiError", status: 404, code: "user_not_found" } }), "salir");
  assert.equal(decidirSesion({ user: null, error: { name: "AuthApiError", status: 500 } }), "red", "un 500 no es culpa de la sesión");
  assert.equal(decidirSesion({ user: null, error: null }), "salir");
});

test("al sacarlo: a una cuenta bloqueada se le explica la baja", () => {
  assert.equal(avisoDeSalida({ code: "user_banned", message: "User is banned" }), AVISO_BAJA);
  assert.equal(avisoDeSalida({ status: 401, message: "invalid JWT" }), "Tu sesión ya no es válida. Vuelve a entrar.");
  assert.equal(avisoDeSalida(null, "baja"), AVISO_BAJA);
});

test("mensajes de WhatsApp de soporte", () => {
  assert.equal(mensajeSoporte({ empresa: "Acme", folio: "MOR-1" }), "Hola, soy de Acme (cliente MOR-1) y necesito ayuda con mi servicio.");
  assert.equal(mensajeSoporte({}), "Hola, soy de mi empresa y necesito ayuda con mi servicio.");
  assert.equal(mensajeSuspendido({ empresa: "Acme", folio: "MOR-1" }), "Hola, mi cuenta de Morcast (Acme, MOR-1) está suspendida y quiero restablecerla.");
  assert.equal(mensajeSuspendido({}), "Hola, mi cuenta de Morcast está suspendida y quiero restablecerla.");
  assert.equal(mensajeVencida("REC-2026-0001"), "Hola, mi recolección REC-2026-0001 se pasó de fecha. ¿Me ayudan?");
});

test("lo que se dice al cancelar o cambiar la fecha", () => {
  assert.equal(textoCambioHecho({ modo: "cancelar", folio: "REC-1" }), "Cancelaste REC-1. Ya le avisamos a Morcast.");
  assert.equal(
    textoCambioHecho({ modo: "reagendar", folio: "REC-1", fechaTexto: "martes 14 de octubre" }),
    "REC-1 quedó para el martes 14 de octubre. Morcast la confirma y te avisa."
  );
});

test("la línea de un punto en Mi cuenta", () => {
  assert.equal(lineaDePunto({ ruta: "Ruta Sur", dias: ["martes", "viernes"], pausado: false }), "Ruta Sur · pasa martes, viernes");
  assert.equal(lineaDePunto({ ruta: "Ruta Sur", dias: [], pausado: true }), "Ruta Sur · en pausa");
  assert.equal(lineaDePunto({ ruta: "", dias: [] }), "Sin ruta asignada");
});

test("una solicitud vencida le explica al cliente lo que pasa (no lo de la oficina)", async () => {
  const { detalleVencidaCliente } = await import("../src/cliente-app.mjs");
  assert.match(detalleVencidaCliente("solicitada"), /Seguimos revisando/);
  assert.match(detalleVencidaCliente("confirmada"), /estaba confirmada/);
  assert.equal(detalleVencidaCliente("completada"), "");
});
