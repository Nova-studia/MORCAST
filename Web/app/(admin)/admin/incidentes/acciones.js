"use server";

import { supabaseSesion, usuarioActual } from "@/lib/supabase-sesion";
import { haySupabase } from "@/lib/supabase";
import { registrar } from "@/lib/bitacora";
import { validarAtencion } from "./bandeja.mjs";

/**
 * Cerrar un incidente del chofer.
 *
 * Va por el servidor y no directo desde el navegador por lo mismo que las
 * acciones de acciones-auditadas.js: para que quede en la bitácora con el
 * actor sacado de la SESIÓN, y para que `atendido_por` no sea lo que diga el
 * navegador. El UPDATE sigue yendo con la sesión del usuario: el RLS
 * (`incidentes_personal`, db/023) sigue siendo el guardia.
 */

const PERSONAL = ["dueno", "admin"];

export async function atenderIncidente(id, nota) {
  if (!haySupabase()) return { ok: true, demo: true };

  const quien = await usuarioActual();
  if (!quien) return { ok: false, motivo: "Tu sesión se venció. Vuelve a entrar." };
  // `sin-verificar` (personal sin el segundo paso) cae aquí también.
  if (!PERSONAL.includes(quien.rol)) return { ok: false, motivo: "No tienes permiso para esto." };

  const v = validarAtencion(nota);
  if (!v.ok) return { ok: false, motivo: v.motivo };

  const supabase = await supabaseSesion();
  const { data, error } = await supabase
    .from("incidentes")
    .update({
      estado: "atendido",
      atendido_por: quien.id,
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
      motivo: "No se cambió nada: alguien más ya lo marcó como atendido, o el permiso de la base no te deja tocarlo. Recarga la página.",
    };
  }

  await registrar({
    accion: "atender_incidente",
    tabla: "incidentes",
    registroId: id,
    detalle: { tipo: data[0].tipo, nota: v.nota },
  });

  return { ok: true, atendidoEn: data[0].atendido_en, atendio: quien.nombre || quien.correo };
}
