/**
 * AVISAR A LA OFICINA DE UNA RECOLECCIÓN PEDIDA — las decisiones, sin base
 * de datos (6-oct-2026).
 *
 * Hasta hoy, cuando un cliente pedía una recolección (portal o app) a la
 * oficina no le llegaba NADA: se enteraba si alguien abría Recolecciones.
 * Ahora, en cuanto la solicitud queda guardada, quien la pidió llama al
 * servidor y éste avisa a la oficina por correo (al buzón de avisos) y con
 * una notificación al teléfono del dueño y de los administradores.
 *
 * Igual que el aviso de incidentes (lib/incidente-aviso.mjs): la solicitud
 * se guarda directo con la sesión del cliente, bajo el RLS; el servidor solo
 * AVISA, y solo de una solicitud del propio cliente, reciente y todavía sin
 * atender. Una sola vez por solicitud (el candado es la bitácora).
 *
 * Lógica pura (tests/solicitud-aviso.test.mjs). Lo que toca la base y manda
 * está en lib/avisar-solicitud.js.
 */
import { fechaCorta } from "./aviso-cliente.mjs";

/** La app y el portal llaman en cuanto se guardó; una hora cubre la mala señal. */
export const MINUTOS_PARA_AVISAR_SOLICITUD = 60;

export const ENLACE_RECOLECCIONES = "https://morcast.mx/admin/recolecciones";

/** La acción de la bitácora que es a la vez constancia y candado. */
export const ACCION_AVISO_SOLICITUD = "aviso_oficina_solicitud";

const FOLIO_RE = /^REC-\d{4}-\d{1,6}$/;
export const esFolioRecoleccion = (v) => typeof v === "string" && FOLIO_RE.test(v.trim());

/**
 * ¿Se puede avisar de esta solicitud a nombre de este cliente?
 *
 * Una solicitud de otra empresa responde igual que una que no existe (404):
 * no hay por qué confirmarle a nadie qué folios existen.
 *
 * @returns {{ ok: true, nada?: true } | { ok: false, status: number, motivo: string }}
 *   `nada: true` = ya no hace falta avisar (la oficina ya la atendió).
 */
export function decidirAvisoSolicitud(sol, { clienteId, ahora = Date.now() } = {}) {
  if (!sol || !clienteId || sol.cliente_id !== clienteId) {
    return { ok: false, status: 404, motivo: "Esa solicitud no existe o no es de tu empresa." };
  }
  // Si la oficina ya la confirmó o la rechazó (fue más rápida que la señal),
  // avisarle de "una solicitud nueva" sería mandarla a buscar algo resuelto.
  if (sol.estado !== "solicitada") return { ok: true, nada: true };
  const creado = new Date(sol.creado).getTime();
  if (!Number.isFinite(creado) || ahora - creado > MINUTOS_PARA_AVISAR_SOLICITUD * 60 * 1000) {
    return { ok: false, status: 400, motivo: "Esa solicitud ya es de hace rato: la oficina la ve en Recolecciones." };
  }
  return { ok: true };
}

/** "Matriz · Av. Industrial 220 · Parque Industrial", o "" sin punto. */
export function textoPunto(dom) {
  if (!dom) return "";
  return [dom.alias, dom.calle, dom.colonia].filter(Boolean).join(" · ");
}

/**
 * La notificación al teléfono de la oficina: corta, que se entienda en la
 * pantalla bloqueada. Al tocarla, la app abre Recolecciones en esa solicitud.
 */
export function mensajePushSolicitud(sol) {
  const empresa = sol?.clientes?.empresa || "Un cliente";
  const dia = fechaCorta(sol?.fecha_pedida);
  const partes = [dia ? `para el ${dia}` : "", sol?.tipo_residuo || ""].filter(Boolean);
  return {
    titulo: sol?.origen === "extra" ? "Recolección extra pedida" : "Recolección pedida",
    cuerpo: `${empresa}${partes.length ? `: ${partes.join(" · ")}` : ""}. Folio ${sol?.folio || "—"}.`,
    datos: { tipo: "solicitud", id: sol?.id ?? null, folio: sol?.folio ?? null },
  };
}

/** Lo que pide `correoSolicitudRecoleccion` (lib/correo.js, que escapa todo el HTML). */
export function datosCorreoSolicitud(sol) {
  const empresa = sol?.clientes?.empresa || "Un cliente";
  return {
    asunto: `Recolección pedida: ${empresa} — ${sol?.folio || ""}`.trim(),
    empresa,
    folio: sol?.folio || "",
    fecha: fechaCorta(sol?.fecha_pedida) || sol?.fecha_pedida || "",
    tipo: sol?.origen === "extra" ? "Recolección extra" : "De su ruta",
    residuo: sol?.tipo_residuo || "Sin especificar",
    punto: textoPunto(sol?.domicilios),
    ruta: sol?.rutas?.nombre || "",
    nota: sol?.nota || "",
    enlace: ENLACE_RECOLECCIONES,
  };
}

/**
 * Cómo buscar la solicitud de la que avisa la app: por su folio o por el que
 * la app PIDIÓ (db/031 le pone otro si ya estaba ocupado y guarda el pedido
 * en `folio_pedido`). Solo con un folio válido: el texto va dentro de un
 * filtro `or` de PostgREST.
 */
export function filtroFolioAviso(folio) {
  if (!esFolioRecoleccion(folio)) return null;
  const f = folio.trim();
  return `folio.eq.${f},folio_pedido.eq.${f}`;
}
