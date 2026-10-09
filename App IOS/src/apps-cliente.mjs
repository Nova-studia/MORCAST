import { estadoParaMostrar, motivoCancelacion } from "./web/solicitud-cliente.mjs";
import { permisosDeEstado, AVISO_BAJA } from "./web/estado-cliente.mjs";

/**
 * EL CLIENTE AL 100% EN LA APP (9-oct-2026, "apps al 100%") — lógica pura.
 *
 * Lo que el portal web ya hacía (Entregas 1-4) y la app no: elegir el punto
 * al agendar, ver "Cancelada" en vez de "Rechazada", el aviso de cuenta
 * suspendida, Mi cuenta y el soporte a la mano. Las reglas de fondo son las
 * copias de `src/web/*.mjs` (no se editan); aquí solo va lo que la app
 * necesita para pintarlas. Sin React ni Supabase, con pruebas
 * (tests/apps-al-100.test.mjs).
 */

/* ------------------------------------------------------------------ */
/* Solicitudes                                                         */
/* ------------------------------------------------------------------ */

/**
 * La insignia de una solicitud. Una cancelación del cliente se guarda como
 * `rechazada` con el motivo "Cancelada por el cliente…" (las apps 1.1.1 no
 * conocen otro estado): se enseña "Cancelada", no "Rechazada", que suena a
 * que Morcast le dijo que no.
 */
export function insigniaSolicitud(s, estados = []) {
  if (estadoParaMostrar(s) === "cancelada") return { texto: "Cancelada", clase: "none" };
  const e = estados.find((x) => x.id === s?.estado);
  return e ? { texto: e.texto, clase: e.clase } : { texto: String(s?.estado ?? ""), clase: "prog" };
}

/**
 * La ruta (y sus días) con que se agenda. Con varios puntos con servicio
 * activo, el cliente elige primero el punto y la ruta es la de ESE punto
 * (antes la solicitud caía siempre en el primero). Sin puntos —un cliente
 * sin servicio activo, o la demostración— la suscripción de siempre.
 */
export function rutaParaAgendar({ puntos = [], puntoId = "", suscripcion = null } = {}) {
  const lista = Array.isArray(puntos) ? puntos : [];
  const punto = lista.find((p) => p.domicilioId === puntoId) || null;
  const ruta = lista.length ? punto?.ruta || null : suscripcion?.ruta || null;
  return {
    punto,
    ruta,
    faltaPunto: lista.length > 1 && !punto,
    domicilioId: punto?.domicilioId || (lista.length ? null : suscripcion?.domicilioId || null),
    rutaId: ruta?.id || null,
    rutaClave: ruta?.clave || null,
  };
}

export const PEDIR_SUSPENDIDO =
  "Tu cuenta está suspendida: por ahora no puedes pedir recolecciones. Contáctanos para restablecerla.";

/**
 * Lo que se le dice al cliente cuando la base rechaza su solicitud.
 *
 * La política de la base (db/013 y db/028) rechaza fechas del pasado Y las
 * cuentas suspendidas con el MISMO error de "row-level security". Antes todo
 * se traducía a "Esa fecha no se puede", y un cliente suspendido cambiaba de
 * fecha una y otra vez sin entender. Si se sabe que la cuenta no puede
 * operar, se dice eso.
 */
export function motivoAlPedir(mensaje, estadoCliente) {
  const msg = String(mensaje || "");
  const esRls = /row-level security/i.test(msg);
  if (estadoCliente && !permisosDeEstado(estadoCliente).puedeOperar) {
    if (esRls || !msg) return estadoCliente === "baja" ? AVISO_BAJA : PEDIR_SUSPENDIDO;
  }
  if (esRls) return "Esa fecha no se puede: elige un día de hoy en adelante.";
  if (/duplicate key/i.test(msg)) return "Se cruzó con otra solicitud al mismo tiempo. Inténtalo de nuevo.";
  return msg || "No se pudo enviar tu solicitud. Revisa tu señal e intenta otra vez.";
}

/**
 * La cuenta de muestra (revisor de Apple) cancela o reagenda SIN tocar la
 * base: sus solicitudes son filas sembradas que el siguiente revisor tiene
 * que ver igual. El cambio vive en la memoria del teléfono.
 */
export function aplicarCambioLocal(lista, { id, accion, fecha, motivo } = {}) {
  return (lista || []).map((s) => {
    if (s.id !== id) return s;
    if (accion === "cancelar") return { ...s, estado: "rechazada", motivoRechazo: motivoCancelacion(motivo) };
    if (accion === "reagendar") return { ...s, fechaPedida: fecha };
    return s;
  });
}

/* ------------------------------------------------------------------ */
/* Mi cuenta                                                           */
/* ------------------------------------------------------------------ */

/**
 * ¿Esta cuenta tiene contraseña que cambiar? Quien entra SOLO con Google o
 * Apple no la tiene, y pedirle "tu contraseña actual" no tiene respuesta.
 * Sin datos de proveedor (cuentas viejas) se ofrece, igual que la web.
 */
export function tieneContrasena(usuario) {
  const am = usuario?.app_metadata || {};
  const prov = Array.isArray(am.providers) ? am.providers : [am.provider].filter(Boolean);
  return prov.length === 0 || prov.includes("email");
}

/**
 * Nombre y teléfono propios. Misma regla que `validarEdicionUsuario` de la
 * web (los teléfonos viejos traen +52 o +1: se quedan los últimos 10).
 */
export function validarMisDatos({ nombre, telefono } = {}) {
  const limpio = {
    nombre: String(nombre ?? "").trim().replace(/\s+/g, " "),
    telefono: String(telefono ?? "").replace(/\D/g, "").slice(-10) || null,
  };
  if (!limpio.nombre) return { ok: false, motivo: "Escribe el nombre." };
  if (limpio.nombre.length > 120) return { ok: false, motivo: "El nombre es muy largo." };
  if (limpio.telefono && limpio.telefono.length !== 10) return { ok: false, motivo: "El teléfono debe tener 10 dígitos." };
  return { ok: true, limpio };
}

/* ------------------------------------------------------------------ */
/* Soporte                                                             */
/* ------------------------------------------------------------------ */

/** El WhatsApp de "¿Necesitas ayuda?" (TarjetaSoporte de la web). */
export function mensajeSoporte({ empresa, folio } = {}) {
  return `Hola, soy de ${empresa || "mi empresa"}${folio ? ` (cliente ${folio})` : ""} y necesito ayuda con mi servicio.`;
}

/** El WhatsApp del aviso rojo de cuenta suspendida (AvisoSuspendido de la web). */
export function mensajeSuspendido({ empresa, folio } = {}) {
  return `Hola, mi cuenta de Morcast${empresa ? ` (${empresa}${folio ? `, ${folio}` : ""})` : ""} está suspendida y quiero restablecerla.`;
}

/** "Contáctanos" junto a una recolección que se pasó de fecha. */
export const mensajeVencida = (folio) => `Hola, mi recolección ${folio} se pasó de fecha. ¿Me ayudan?`;

/** "868 384 9478" → "tel:+528683849478". */
export const telefonoMarcable = (telefono) => `tel:+52${String(telefono || "").replace(/\D/g, "")}`;

/**
 * Lo que lee el CLIENTE junto a una recolección vencida (`detalleCliente` de
 * Web/lib/vencimiento.js). Al cliente no se le dice "nadie la atendió": se
 * le dice que ya se está viendo.
 */
const DETALLE_CLIENTE = {
  solicitada: "Seguimos revisando tu solicitud. Te avisamos en cuanto la confirmemos.",
  confirmada: "Tu recolección estaba confirmada para este día y todavía no se registra. Ya lo estamos revisando.",
  "en-ruta": "Tu recolección quedó en proceso. Estamos completando el registro.",
};
export const detalleVencidaCliente = (estado) => DETALLE_CLIENTE[estado] || "";
