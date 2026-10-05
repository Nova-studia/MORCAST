/**
 * SOLICITUDES DEL CLIENTE — reglas puras (sin React ni Supabase).
 *
 * Pedidos de los dueños (4-oct-2026), iguales que en el portal web
 * (`/portal/agendar` y `lib/datos-solicitudes.js`):
 *   · El tipo de residuo es OBLIGATORIO al agendar. Con él el chofer sabe qué
 *     va a recoger; si al llegar es otra cosa, marca "No procedió" y no se
 *     cobra. Por eso se pide aquí y no después.
 *   · Con «Otro», la nota pasa a ser obligatoria: "Otro" a secas no le dice
 *     a la cuadrilla qué llevar.
 *   · Una visita "No procedió" se enseña con su motivo y "No se te cobra", y
 *     NO cuenta como próximo servicio: ya pasó.
 */
import { TIPOS_RESIDUO } from "./cotizar-whatsapp.js";

/**
 * @returns {{ok: true} | {ok: false, campo: string, mensaje: string}}
 */
export function validarSolicitud({ fecha, tipoResiduo, nota } = {}) {
  if (!fecha) return { ok: false, campo: "fecha", mensaje: "Elige el día de la recolección." };
  if (!TIPOS_RESIDUO.includes(tipoResiduo)) {
    return { ok: false, campo: "tipoResiduo", mensaje: "Elige qué tipo de residuo vamos a recoger." };
  }
  if (tipoResiduo === "Otro" && !String(nota || "").trim()) {
    return { ok: false, campo: "nota", mensaje: "Con «Otro», describe el residuo en la nota." };
  }
  return { ok: true };
}

/**
 * El renglón que ve el cliente en una visita que no procedió. Mismo texto
 * que el portal: "No se pudo recolectar: <motivo> (<detalle>). No se te cobra."
 */
export function textoNoProcedio({ motivoNoProcedio, detalleNoProcedio } = {}) {
  const motivo = String(motivoNoProcedio || "").trim();
  const detalle = String(detalleNoProcedio || "").trim();
  return `No se pudo recolectar${motivo ? `: ${motivo}` : ""}${detalle ? ` (${detalle})` : ""}. No se te cobra.`;
}

/**
 * ¿Va en "Próximos servicios"? Solo lo que todavía va a pasar. Antes era
 * "todo lo que no esté completado", y una visita "No procedió" salía como
 * si el camión todavía fuera a llegar.
 */
export function esProximo(servicio) {
  return servicio?.estatus === "programado" || servicio?.estatus === "en-ruta";
}
