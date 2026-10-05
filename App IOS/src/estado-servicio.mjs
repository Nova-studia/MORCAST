/**
 * CÓMO SE LEE EN LA APP CADA ESTADO DE UNA SOLICITUD DE RECOLECCIÓN.
 *
 * Lógica pura (sin React ni Supabase) para probarla con `node --test`.
 *
 * Por qué existe: la 023 agregó el estado `no-procedio` (el chofer llegó y no
 * se pudo recoger: otro residuo, cerrado…). La tabla de `datos-remoto.js` no
 * lo conocía, así que caía tal cual —"no-procedio", con guion— y como "no
 * está completado" se contaba entre los PRÓXIMOS servicios del Inicio: el
 * cliente veía como pendiente una visita que ya pasó y no se va a repetir.
 */

/** Estado de la base → estado de pantalla. */
export const ESTATUS_PANTALLA = {
  solicitada: "programado",
  confirmada: "programado",
  "en-ruta": "en-ruta",
  completada: "completado",
  "no-procedio": "no-procedio",
};

export function estatusDePantalla(estadoBase) {
  return ESTATUS_PANTALLA[estadoBase] || estadoBase || "programado";
}

/** Los estados que todavía esperan camión. Solo ésos son "próximos". */
const PENDIENTES = new Set(["programado", "en-ruta"]);

export function esProximo(servicio) {
  return PENDIENTES.has(servicio?.estatus);
}

/**
 * La frase que ve el cliente en una visita que no procedió. El motivo va
 * primero porque es lo que explica; el "No se te cobra" va siempre, porque
 * es lo primero que se pregunta cualquiera al ver que no le recogieron
 * (los Términos lo dicen igual: una visita que no procedió no se cobra).
 */
export function textoNoProcedio(motivo, detalle) {
  const m = String(motivo || "").trim();
  const d = String(detalle || "").trim();
  const porque = m ? `${m}${d ? ` (${d})` : ""}.` : "El chofer no pudo hacer la recolección.";
  return `${porque} No se te cobra.`;
}
