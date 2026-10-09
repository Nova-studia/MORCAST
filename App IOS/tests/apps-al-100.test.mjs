// Apps al 100% (9-oct-2026): la lógica pura nueva de la app de iPhone —
// el cliente (puntos, cancelada, suspendido, soporte), la sesión que ya no
// vale, el chofer y la administración (pestañas por rol, "En la web",
// roles, avisos a clientes elegidos, rutas). Si la carpeta Web está al
// lado, se compara contra ella.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

import {
  insigniaSolicitud, rutaParaAgendar, motivoAlPedir, PEDIR_SUSPENDIDO, tieneContrasena,
  mensajeSoporte, mensajeSuspendido, mensajeVencida, detalleVencidaCliente, validarMisDatos,
  aplicarCambioLocal, telefonoMarcable,
} from "../src/apps-cliente.mjs";
import { quePasaConLaSesion, avisoDeSalida, SESION_VENCIDA } from "../src/apps-sesion.mjs";
import {
  PESTANAS_ADMIN, pestanasVisibles, HERRAMIENTAS_WEB, herramientasVisibles, menuVisible,
  CASILLAS_ROL, textoPermiso, alternarPermiso, puedeTocarUsuario, etiquetaRolUsuario, personasConRol,
  filtrarClientesAviso, alternarId, marcarVisibles, filasRutas, botonesEstado, TEXTO_ESTADO,
  cambiosDeFicha, servicioDePunto, totalPaginas, textoPagina, cierreYaHecho,
} from "../src/apps-admin.mjs";
import { ESTADOS_SOLICITUD_REC } from "../src/rutas-datos.js";
import { AVISO_BAJA, AVISO_SUSPENDIDO } from "../src/web/estado-cliente.mjs";
import { MOTIVO_CANCELADA } from "../src/web/solicitud-cliente.mjs";
import { seccionDeRuta } from "../src/web/permisos.mjs";

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

const U1 = "aaaaaaaa-0000-4000-8000-000000000001";
const U2 = "aaaaaaaa-0000-4000-8000-000000000002";

/* ============================== CLIENTE ============================== */

test("una rechazada por el propio cliente se ve «Cancelada»; las demás, como siempre", () => {
  const cancelada = { estado: "rechazada", motivoRechazo: `${MOTIVO_CANCELADA}: ya no hace falta` };
  assert.deepEqual(insigniaSolicitud(cancelada, ESTADOS_SOLICITUD_REC), { texto: "Cancelada", clase: "none" });
  assert.deepEqual(insigniaSolicitud({ estado: "rechazada", motivoRechazo: "Sin cupo" }, ESTADOS_SOLICITUD_REC), { texto: "Rechazada", clase: "mal" });
  assert.deepEqual(insigniaSolicitud({ estado: "confirmada" }, ESTADOS_SOLICITUD_REC), { texto: "Confirmada", clase: "ok" });
  assert.deepEqual(insigniaSolicitud({ estado: "rara" }, ESTADOS_SOLICITUD_REC), { texto: "rara", clase: "prog" });
});

test("agendar: con varios puntos hay que elegir; los días son los de la ruta de ESE punto", () => {
  const norte = { id: "r1", clave: "RT-N", nombre: "Norte", tipo: "manual", dias: ["lunes"] };
  const sur = { id: "r2", clave: "RT-S", nombre: "Sur", tipo: "manual", dias: ["martes"] };
  const puntos = [
    { domicilioId: "d1", texto: "Planta 1", ruta: norte },
    { domicilioId: "d2", texto: "Planta 2", ruta: sur },
  ];
  const sin = rutaParaAgendar({ puntos, puntoId: "" });
  assert.equal(sin.faltaPunto, true);
  assert.equal(sin.ruta, null);
  const dos = rutaParaAgendar({ puntos, puntoId: "d2" });
  assert.equal(dos.faltaPunto, false);
  assert.deepEqual(dos.ruta, sur);
  assert.equal(dos.domicilioId, "d2");
  assert.equal(dos.rutaId, "r2");
  assert.equal(dos.rutaClave, "RT-S");
  // Sin puntos con servicio (o en la demostración): la suscripción de antes.
  const viejo = rutaParaAgendar({ puntos: [], puntoId: "", suscripcion: { domicilioId: "d9", ruta: { clave: "RT-X", dias: [] } } });
  assert.equal(viejo.faltaPunto, false);
  assert.equal(viejo.domicilioId, "d9");
  assert.equal(viejo.rutaClave, "RT-X");
  assert.equal(viejo.rutaId, null);
  assert.equal(rutaParaAgendar({}).ruta, null);
});

test("al pedir, un rechazo de la base por la cuenta suspendida no se vende como «esa fecha»", () => {
  const rls = 'new row violates row-level security policy for table "solicitudes_recoleccion"';
  assert.equal(motivoAlPedir(rls, "suspendido"), PEDIR_SUSPENDIDO);
  assert.equal(motivoAlPedir(rls, "baja"), AVISO_BAJA);
  assert.match(motivoAlPedir(rls, "activo"), /Esa fecha no se puede/);
  assert.match(motivoAlPedir(rls, null), /Esa fecha no se puede/);
  assert.match(motivoAlPedir("duplicate key value violates unique constraint", "activo"), /Se cruzó/);
  assert.equal(motivoAlPedir("otra cosa", "activo"), "otra cosa");
  assert.match(motivoAlPedir("", "activo"), /No se pudo enviar/);
});

test("contraseña: solo si la cuenta entra con correo (no la de solo Google o Apple)", () => {
  assert.equal(tieneContrasena({ app_metadata: { providers: ["email"] } }), true);
  assert.equal(tieneContrasena({ app_metadata: { providers: ["google"] } }), false);
  assert.equal(tieneContrasena({ app_metadata: { providers: ["apple", "email"] } }), true);
  assert.equal(tieneContrasena({ app_metadata: { provider: "apple" } }), false);
  // Sin datos (cuentas viejas): se ofrece, como la web.
  assert.equal(tieneContrasena({ app_metadata: {} }), true);
  assert.equal(tieneContrasena(null), true);
});

test("soporte: los mensajes de WhatsApp son los de la web", () => {
  assert.equal(mensajeSoporte({ empresa: "Acme", folio: "MOR-1" }), "Hola, soy de Acme (cliente MOR-1) y necesito ayuda con mi servicio.");
  assert.equal(mensajeSoporte({}), "Hola, soy de mi empresa y necesito ayuda con mi servicio.");
  assert.equal(mensajeSuspendido({ empresa: "Acme", folio: "MOR-1" }), "Hola, mi cuenta de Morcast (Acme, MOR-1) está suspendida y quiero restablecerla.");
  assert.equal(mensajeSuspendido({}), "Hola, mi cuenta de Morcast está suspendida y quiero restablecerla.");
  assert.equal(mensajeVencida("REC-2026-0007"), "Hola, mi recolección REC-2026-0007 se pasó de fecha. ¿Me ayudan?");
  assert.equal(telefonoMarcable("868 384 9478"), "tel:+528683849478");
});

test("vencidas: lo que se le dice al CLIENTE es lo de la web", async (t) => {
  const web = await deLaWeb(t, "vencimiento.js");
  if (!web) return;
  for (const estado of ["solicitada", "confirmada", "en-ruta"]) {
    const v = web.estadoVencimiento({ estado, fechaPedida: "2026-01-01" }, "2026-01-05");
    assert.equal(detalleVencidaCliente(estado), v.detalleCliente, estado);
  }
  assert.equal(detalleVencidaCliente("completada"), "");
});

test("mis datos: nombre obligatorio y teléfono de 10 dígitos (como la web)", async (t) => {
  assert.deepEqual(validarMisDatos({ nombre: "  Ana   Pérez ", telefono: "+52 868 111 2233" }), { ok: true, limpio: { nombre: "Ana Pérez", telefono: "8681112233" } });
  assert.equal(validarMisDatos({ nombre: "", telefono: "" }).ok, false);
  assert.equal(validarMisDatos({ nombre: "Ana", telefono: "123" }).motivo, "El teléfono debe tener 10 dígitos.");
  assert.deepEqual(validarMisDatos({ nombre: "Ana", telefono: "" }), { ok: true, limpio: { nombre: "Ana", telefono: null } });
  const web = await deLaWeb(t, "equipo.mjs");
  if (!web) return;
  for (const c of [{ nombre: "x", telefono: "8681234567" }, { nombre: "", telefono: "1" }, { nombre: "A".repeat(121) }, { nombre: "Bo", telefono: "+1 956 555 1234" }]) {
    const w = web.validarEdicionUsuario(c);
    const a = validarMisDatos(c);
    assert.equal(a.ok, w.ok);
    if (w.ok) assert.deepEqual(a.limpio, { nombre: w.limpio.nombre, telefono: w.limpio.telefono });
    else assert.equal(a.motivo, w.motivo);
  }
});

test("la cuenta de muestra cancela y reagenda sin tocar la base", () => {
  const lista = [{ id: "a", estado: "solicitada", fechaPedida: "2026-10-10" }, { id: "b", estado: "confirmada", fechaPedida: "2026-10-11" }];
  const c = aplicarCambioLocal(lista, { id: "b", accion: "cancelar", motivo: "ya no" });
  assert.equal(c[1].estado, "rechazada");
  assert.equal(c[1].motivoRechazo, `${MOTIVO_CANCELADA}: ya no`);
  assert.equal(lista[1].estado, "confirmada", "no muta la lista original");
  const r = aplicarCambioLocal(lista, { id: "a", accion: "reagendar", fecha: "2026-10-20" });
  assert.equal(r[0].fechaPedida, "2026-10-20");
  assert.equal(r[1], lista[1]);
});

/* ============================== SESIÓN =============================== */

test("¿la sesión ya no vale, o solo no hubo red? Ante la duda, no se saca a nadie", () => {
  assert.equal(quePasaConLaSesion(null), "ok");
  assert.equal(quePasaConLaSesion({ name: "AuthApiError", status: 400, code: "user_banned", message: "User is banned" }), "baja");
  assert.equal(quePasaConLaSesion({ name: "AuthApiError", status: 403, code: "bad_jwt", message: "invalid JWT" }), "sesion");
  assert.equal(quePasaConLaSesion({ name: "AuthApiError", status: 404, code: "user_not_found", message: "User from sub claim in JWT does not exist" }), "sesion");
  assert.equal(quePasaConLaSesion({ name: "AuthSessionMissingError", status: 400, message: "Auth session missing!" }), "sesion");
  assert.equal(quePasaConLaSesion({ name: "AuthRetryableFetchError", status: 0, message: "Network request failed" }), "red");
  assert.equal(quePasaConLaSesion({ name: "AuthApiError", status: 503, message: "upstream" }), "red");
  assert.equal(quePasaConLaSesion({ message: "TypeError: Failed to fetch" }), "red");
  assert.equal(quePasaConLaSesion({ name: "AuthApiError", status: 422, message: "algo raro" }), "red");
  assert.equal(avisoDeSalida("baja"), AVISO_BAJA);
  assert.equal(avisoDeSalida("sesion"), SESION_VENCIDA);
  assert.equal(avisoDeSalida("red"), null);
  assert.equal(avisoDeSalida("ok"), null);
});

/* ============================== CHOFER =============================== */

test("cerrar otra vez una parada que ya quedó completada es éxito", () => {
  assert.equal(cierreYaHecho("completada"), true);
  assert.equal(cierreYaHecho("en-ruta"), false);
  assert.equal(cierreYaHecho(undefined), false);
});

/* ========================== ADMINISTRACIÓN =========================== */

test("pestañas: Panel y Más para todos; Solicitudes y Saldos según su rol", () => {
  assert.deepEqual(PESTANAS_ADMIN, ["Panel", "Solicitudes", "Saldos", "MasA"]);
  assert.deepEqual(pestanasVisibles({ rol: "dueno", permisos: [] }), PESTANAS_ADMIN);
  assert.deepEqual(pestanasVisibles({ rol: "admin", permisos: ["saldos"] }), ["Panel", "Saldos", "MasA"]);
  assert.deepEqual(pestanasVisibles(null), ["Panel", "MasA"]);
});

test("menú «Más»: solo lo de su rol; Mi cuenta para todos", () => {
  const menu = [{ pantalla: "Recolecciones" }, { pantalla: "Usuarios" }, { pantalla: "MiCuenta" }, { pantalla: "Rutas" }];
  assert.deepEqual(menuVisible({ rol: "admin", permisos: ["recolecciones"] }, menu).map((m) => m.pantalla), ["Recolecciones", "MiCuenta"]);
  assert.deepEqual(menuVisible({ rol: "admin", permisos: ["rutas", "usuarios"] }, menu).map((m) => m.pantalla), ["Usuarios", "MiCuenta", "Rutas"]);
  assert.deepEqual(menuVisible(null, menu).map((m) => m.pantalla), ["MiCuenta"]);
});

test("En la web: cada botón abre una página de la lista cerrada y pide la sección de esa página", async (t) => {
  assert.equal(HERRAMIENTAS_WEB.length, 7);
  for (const h of HERRAMIENTAS_WEB) assert.equal(seccionDeRuta(h.destino), h.seccion, h.destino);
  assert.deepEqual(herramientasVisibles({ rol: "admin", permisos: ["precios", "bitacora"] }).map((h) => h.destino), ["/admin/precios", "/admin/bitacora"]);
  assert.equal(herramientasVisibles({ rol: "dueno", permisos: [] }).length, 7);
  assert.equal(herramientasVisibles(null).length, 0);
  const web = await deLaWeb(t, "app-acciones-mapa.mjs");
  if (!web) return;
  for (const h of HERRAMIENTAS_WEB) assert.ok(web.DESTINOS_PANEL.includes(h.destino), h.destino);
});

test("roles: las casillas son las secciones más los permisos sueltos", () => {
  assert.ok(CASILLAS_ROL.some((c) => c.id === "saldos"));
  assert.ok(CASILLAS_ROL.some((c) => c.id === "eliminar_clientes"));
  assert.equal(textoPermiso("saldos"), "Saldos de clientes");
  assert.equal(textoPermiso("raro"), "raro");
  assert.deepEqual(alternarPermiso(["a"], "b"), ["a", "b"]);
  assert.deepEqual(alternarPermiso(["a", "b"], "a"), ["b"]);
  const roles = [{ id: "r1", nombre: "Caja" }];
  const equipo = [{ id: "u1", rol: "admin", rolId: "r1" }, { id: "u2", rol: "admin", rolId: null }, { id: "u3", rol: "operador" }];
  assert.equal(personasConRol("r1", equipo), 1);
  assert.equal(etiquetaRolUsuario(equipo[0], roles), "Caja");
  assert.equal(etiquetaRolUsuario(equipo[1], roles), "Sin rol (solo el Panel)");
  assert.equal(etiquetaRolUsuario(equipo[2], roles), "Chofer / Operador");
  assert.equal(etiquetaRolUsuario({ rol: "dueno" }, roles), "Dueño");
});

test("usuarios: el dueño toca a todo el equipo; un admin, solo a los choferes; nadie al dueño ni a sí mismo", () => {
  const dueno = { id: "d", rol: "dueno" };
  const admin = { id: "a", rol: "admin" };
  assert.equal(puedeTocarUsuario({ yo: dueno, u: { id: "x", rol: "admin" } }), true);
  assert.equal(puedeTocarUsuario({ yo: dueno, u: { id: "d", rol: "dueno" } }), false);
  assert.equal(puedeTocarUsuario({ yo: admin, u: { id: "x", rol: "admin" } }), false);
  assert.equal(puedeTocarUsuario({ yo: admin, u: { id: "x", rol: "operador" } }), true);
  assert.equal(puedeTocarUsuario({ yo: admin, u: { id: "a", rol: "admin" } }), false);
  assert.equal(puedeTocarUsuario({ yo: null, u: { id: "x", rol: "operador" } }), false);
});

test("avisos a clientes elegidos: buscar, marcar los que se ven y quitar", () => {
  const cs = [
    { id: U1, empresa: "Ácme Norte", folio: "MOR-1", correo: "a@x.mx" },
    { id: U2, empresa: "Beta", folio: "MOR-2", correo: "" },
  ];
  assert.equal(filtrarClientesAviso(cs, "").length, 2);
  assert.deepEqual(filtrarClientesAviso(cs, "acme").map((c) => c.id), [U1]);
  assert.deepEqual(filtrarClientesAviso(cs, "mor-2").map((c) => c.id), [U2]);
  assert.deepEqual(alternarId([], U1), [U1]);
  assert.deepEqual(alternarId([U1, U2], U1), [U2]);
  assert.deepEqual(marcarVisibles([U2], cs), [U2, U1]);
});

test("rutas: chofer de la lista, o el aviso de que el nombre estaba escrito a mano", () => {
  const filas = filasRutas([
    { id: "2", clave: "RT-S", nombre: "Sur", dias: ["lunes", "jueves"], chofer: "Pepe", chofer_id: null, activa: true },
    { id: "1", clave: "RT-N", nombre: "Norte", dias: [], chofer: "José", chofer_id: U1, activa: false },
  ]);
  assert.deepEqual(filas.map((f) => f.clave), ["RT-N", "RT-S"]);
  assert.equal(filas[0].textoChofer, "José");
  assert.equal(filas[0].dias, "Sin días");
  assert.equal(filas[0].activa, false);
  assert.equal(filas[1].textoChofer, "Sin chofer asignado");
  assert.equal(filas[1].aMano, "Pepe");
  assert.equal(filas[1].dias, "lunes, jueves");
});

test("ficha del cliente: qué botones de estado tocan y qué se manda al editar", () => {
  assert.deepEqual(botonesEstado("activo"), ["suspendido", "baja"]);
  assert.deepEqual(botonesEstado("pendiente-info"), ["suspendido", "baja"]);
  assert.deepEqual(botonesEstado("suspendido"), ["baja", "activo"]);
  assert.deepEqual(botonesEstado("baja"), ["activo"]);
  assert.ok(TEXTO_ESTADO.suspendido.explica.includes("SOLO agregar saldo"));
  assert.deepEqual(cambiosDeFicha({ empresa: "A", dias_credito: "15", limite_credito: "x" }), { empresa: "A", dias_credito: 15, limite_credito: 0 });
  assert.deepEqual(servicioDePunto({ suscripciones: [{ id: 1 }] }), { id: 1 });
  assert.deepEqual(servicioDePunto({ suscripciones: { id: 2 } }), { id: 2 });
  assert.equal(servicioDePunto({}), null);
});

test("recolecciones: páginas de 50", () => {
  assert.equal(totalPaginas(0), 1);
  assert.equal(totalPaginas(50), 1);
  assert.equal(totalPaginas(51), 2);
  assert.equal(textoPagina({ pagina: 2, total: 120 }), "51–100 de 120");
  assert.equal(textoPagina({ pagina: 3, total: 120 }), "101–120 de 120");
  assert.equal(textoPagina({ pagina: 1, total: 0 }), "Ninguna");
});

test("el aviso rojo es el de la web", () => {
  assert.equal(AVISO_SUSPENDIDO, "Tu cuenta está suspendida. Contáctanos para restablecerla.");
});

test("avisos a clientes elegidos: valida y nombra igual que la web", async (t) => {
  const app = await import("../src/avisos-admin.mjs");
  const base = { titulo: "Retraso", mensaje: "La ruta va tarde", motivo: "retraso" };
  const uno = app.validarAviso({ ...base, alcance: "clientes", clienteIds: [U1] }, { hoy: "2026-10-09", exigirUuid: true });
  assert.equal(uno.ok, true);
  assert.equal(uno.limpio.alcance, "cliente", "con uno solo se guarda como «un cliente» (la 1.1.1 lo lee)");
  const dos = app.validarAviso({ ...base, alcance: "clientes", clienteIds: [U1, U2, U1] }, { hoy: "2026-10-09", exigirUuid: true });
  assert.deepEqual(dos.limpio.clienteIds, [U1, U2]);
  assert.equal(app.validarAviso({ ...base, alcance: "clientes", clienteIds: [] }).motivo, "Marca al menos un cliente.");
  assert.equal(app.textoAlcance({ alcance: "clientes", cliente_ids: [U1, U2] }), "2 clientes elegidos");
  const web = await deLaWeb(t, "avisos.mjs");
  if (!web) return;
  const casos = [
    { ...base, alcance: "clientes", clienteIds: [U1] },
    { ...base, alcance: "clientes", clienteIds: [U1, U2] },
    { ...base, alcance: "clientes", clienteIds: ["no-uuid"] },
    { ...base, alcance: "clientes" },
    { ...base, alcance: "cliente", clienteId: U1 },
  ];
  for (const c of casos) {
    for (const exigirUuid of [false, true]) {
      assert.deepEqual(app.validarAviso(c, { hoy: "2026-10-09", exigirUuid }), web.validarAviso(c, { hoy: "2026-10-09", exigirUuid }));
    }
  }
  for (const a of [{ alcance: "clientes", cliente_ids: [U1, U2] }, { alcance: "clientes" }]) {
    assert.equal(app.textoAlcance(a), web.textoAlcance(a));
  }
});
