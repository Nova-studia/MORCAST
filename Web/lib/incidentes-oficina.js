import { validarAtencion } from "../app/(admin)/admin/incidentes/bandeja.mjs";

/**
 * CERRAR UN INCIDENTE DEL CHOFER ("Marcar atendido") — la MISMA para el panel
 * web (admin/incidentes/acciones.js) y la app de la oficina
 * (/api/app/incidentes/atender). Se sacó aquí el 6-oct-2026 para que las dos
 * puertas escriban igual: misma validación de la nota, mismo UPDATE contado
 * y la misma fila en la bitácora.
 *
 *   `sb`         actúa COMO el usuario: el RLS (`incidentes_personal`,
 *                db/023) sigue siendo el guardia.
 *   `sbServicio` llave de servicio, solo para la bitácora.
 *   `actor`      { id, correo, nombre } de la sesión, nunca del cuerpo:
 *                `atendido_por` no puede ser lo que diga el teléfono.
 *
 * @returns {Promise<{ ok: true, atendidoEn: string, atendio: string } | { ok: false, motivo: string }>}
 */
export async function atenderIncidenteComo({ sb, sbServicio, actor, id, nota, origen = null, log = console }) {
  const v = validarAtencion(nota);
  if (!v.ok) return { ok: false, motivo: v.motivo };

  const { data, error } = await sb
    .from("incidentes")
    .update({
      estado: "atendido",
      atendido_por: actor.id,
      atendido_en: new Date().toISOString(),
      nota_atencion: v.nota,
    })
    .eq("id", id)
    // Solo si sigue abierto: si otra persona lo cerró hace un minuto desde
    // otra computadora, no se le pisa su nota.
    .eq("estado", "abierto")
    .select("id, tipo, atendido_en");

  if (error) return { ok: false, motivo: error.message };
  if (!data?.length) {
    return {
      ok: false,
      motivo: "No se cambió nada: alguien más ya lo marcó como atendido, o el permiso de la base no te deja tocarlo. Recarga la lista.",
    };
  }

  // Con la llave de servicio y el actor de la sesión, como lib/bitacora.js.
  try {
    const { error: errBit } = await sbServicio.from("bitacora").insert({
      actor_id: actor?.id ?? null,
      actor_correo: actor?.correo ?? null,
      accion: "atender_incidente",
      tabla: "incidentes",
      registro_id: String(id),
      detalle: { tipo: data[0].tipo, nota: v.nota, ...(origen ? { origen } : {}) },
    });
    if (errBit) log.error("[bitacora] no se pudo registrar: atender_incidente", errBit.message);
  } catch (e) {
    log.error("[bitacora] no se pudo registrar: atender_incidente", e?.message || e);
  }

  return { ok: true, atendidoEn: data[0].atendido_en, atendio: actor?.nombre || actor?.correo || "" };
}
