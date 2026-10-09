import { estadoParaMostrar } from "./web/solicitud-cliente.mjs";
import { AVISO_BAJA, mensajeErrorLogin } from "./web/estado-cliente.mjs";

/**
 * LO QUE DECIDE LA APP DEL CLIENTE (apps al 100%, 9-oct-2026). Puro, con
 * pruebas en tests/cliente-app.test.mjs. Las reglas de fondo son las copias
 * de la web (`src/web/*.mjs`); aquí solo lo que la app junta encima.
 */

/**
 * La ruta con que se arman los días para agendar.
 *
 * Con puntos (suscripciones activas) manda el punto ELEGIDO: cada punto
 * tiene su ruta y sus días, y antes la solicitud caía en el primer punto del
 * cliente aunque fuera otra planta. Sin puntos (un cliente sin servicio
 * activo) queda la suscripción de siempre, como la web.
 */
export function rutaParaAgendar({ puntos = [], puntoId = "", suscripcion = null } = {}) {
  if (puntos.length) return puntos.find((p) => p.domicilioId === puntoId)?.ruta || null;
  return suscripcion?.ruta || null;
}

/** Con dos o más puntos hay que escoger antes de ver fechas. */
export const faltaElegirPunto = (puntos = [], puntoId = "") =>
  puntos.length > 1 && !puntos.some((p) => p.domicilioId === puntoId);

/**
 * La etiqueta de una solicitud en "Mis solicitudes". Una rechazada por el
 * propio cliente (`motivo_rechazo` "Cancelada por el cliente…") se lee
 * "Cancelada": decirle "Rechazada" a quien la canceló suena a que Morcast lo
 * rechazó a él.
 */
export function estadoSolicitudCliente(s, estados = []) {
  if (estadoParaMostrar(s) === "cancelada") return { id: "cancelada", texto: "Cancelada", clase: "none" };
  return estados.find((e) => e.id === s?.estado) || { id: s?.estado, texto: String(s?.estado ?? ""), clase: "prog" };
}

/**
 * El motivo que se le enseña cuando la base rechaza la solicitud.
 *
 * El rechazo de la política (db/013 y db/028) llega como "row-level
 * security". Antes siempre se traducía a "Esa fecha no se puede", y a una
 * cuenta SUSPENDIDA se le decía que cambiara la fecha: la causa era su estado.
 */
export function motivoFalloPedido(mensaje, estadoCliente) {
  const msg = String(mensaje || "");
  if (/row-level security|policy/i.test(msg)) {
    if (estadoCliente === "suspendido") return "Tu cuenta está suspendida: por ahora no puedes pedir recolecciones. Contáctanos para restablecerla.";
    if (estadoCliente === "baja") return AVISO_BAJA;
    return "Esa fecha no se puede: elige un día de hoy en adelante.";
  }
  if (/duplicate key/i.test(msg)) return "Se cruzó con otra solicitud al mismo tiempo. Inténtalo de nuevo.";
  return msg;
}

/**
 * ¿La sesión guardada sigue valiendo? Con lo que contestó
 * `supabase.auth.getUser()` (que sí pregunta al servidor).
 *
 *   · "seguir": el servidor la reconoce.
 *   · "red":    no hubo respuesta (o el servidor falló): NO se saca a nadie;
 *               sin señal la app tiene que seguir abriendo.
 *   · "salir":  el servidor dijo que no (token inválido, usuario borrado o
 *               bloqueado por baja): se cierra la sesión.
 */
export function decidirSesion({ user, error } = {}) {
  if (user && !error) return "seguir";
  if (!error) return "salir";
  const status = Number(error.status);
  const red = error.name === "AuthRetryableFetchError" || /network|fetch|timeout|timed out/i.test(String(error.message || ""));
  if (red) return "red";
  if ([400, 401, 403, 404].includes(status)) return "salir";
  if (/user_banned|user_not_found|bad_jwt|session_not_found|AuthSessionMissing/i.test(`${error.code || ""} ${error.name || ""}`)) return "salir";
  return "red";
}

/** Lo que se le dice al sacarlo: a una cuenta dada de baja, por qué. */
export function avisoDeSalida(error, estadoCliente) {
  if (estadoCliente === "baja") return AVISO_BAJA;
  const m = mensajeErrorLogin(error);
  return m === AVISO_BAJA ? AVISO_BAJA : "Tu sesión ya no es válida. Vuelve a entrar.";
}

/* ------------------------------------------------------------------ soporte */

/** El WhatsApp de "¿Necesitas ayuda?" (mismo texto que `TarjetaSoporte` de la web). */
export const mensajeSoporte = ({ empresa, folio } = {}) =>
  `Hola, soy de ${empresa || "mi empresa"}${folio ? ` (cliente ${folio})` : ""} y necesito ayuda con mi servicio.`;

/** El de la banda roja de cuenta suspendida (como `AvisoSuspendido` de la web). */
export const mensajeSuspendido = ({ empresa, folio } = {}) =>
  `Hola, mi cuenta de Morcast${empresa ? ` (${empresa}${folio ? `, ${folio}` : ""})` : ""} está suspendida y quiero restablecerla.`;

/** El de "Contáctanos" junto a una recolección que se pasó de fecha. */
export const mensajeVencida = (folio) => `Hola, mi recolección ${folio} se pasó de fecha. ¿Me ayudan?`;

/** Lo que queda escrito después de cancelar o cambiar la fecha (como la web). */
export function textoCambioHecho({ modo, folio, fechaTexto }) {
  return modo === "cancelar"
    ? `Cancelaste ${folio}. Ya le avisamos a Morcast.`
    : `${folio} quedó para el ${fechaTexto}. Morcast la confirma y te avisa.`;
}

/** Ruta, días y pausa de un punto en "Mis puntos". */
export function lineaDePunto(p = {}) {
  if (!p.ruta) return "Sin ruta asignada";
  const dias = (p.dias || []).length ? ` · pasa ${p.dias.join(", ")}` : "";
  return `${p.ruta}${dias}${p.pausado ? " · en pausa" : ""}`;
}

/**
 * Lo que lee el CLIENTE junto a una solicitud que se pasó de fecha (los
 * textos `detalleCliente` de Web/lib/vencimiento.js). El de la oficina
 * ("nadie la atendió") no es para él.
 */
const DETALLE_VENCIDA_CLIENTE = {
  solicitada: "Seguimos revisando tu solicitud. Te avisamos en cuanto la confirmemos.",
  confirmada: "Tu recolección estaba confirmada para este día y todavía no se registra. Ya lo estamos revisando.",
  "en-ruta": "Tu recolección quedó en proceso. Estamos completando el registro.",
};
export const detalleVencidaCliente = (estado) => DETALLE_VENCIDA_CLIENTE[estado] || "";
