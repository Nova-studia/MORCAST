"use server";

import { supabaseSesion, usuarioActual } from "@/lib/supabase-sesion";
import { haySupabase, supabaseServidor } from "@/lib/supabase";
import { atenderIncidenteComo } from "@/lib/incidentes-oficina";

/**
 * Cerrar un incidente del chofer.
 *
 * Va por el servidor y no directo desde el navegador por lo mismo que las
 * acciones de acciones-auditadas.js: para que quede en la bitácora con el
 * actor sacado de la SESIÓN, y para que `atendido_por` no sea lo que diga el
 * navegador. El UPDATE sigue yendo con la sesión del usuario: el RLS
 * (`incidentes_personal`, db/023) sigue siendo el guardia.
 *
 * El trabajo vive en lib/incidentes-oficina.js desde el 6-oct-2026: la app
 * de la oficina (/api/app/incidentes/atender) usa la MISMA función.
 */

const PERSONAL = ["dueno", "admin"];

export async function atenderIncidente(id, nota) {
  if (!haySupabase()) return { ok: true, demo: true };

  const quien = await usuarioActual();
  if (!quien) return { ok: false, motivo: "Tu sesión se venció. Vuelve a entrar." };
  // `sin-verificar` (personal sin el segundo paso) cae aquí también.
  if (!PERSONAL.includes(quien.rol)) return { ok: false, motivo: "No tienes permiso para esto." };

  return atenderIncidenteComo({
    sb: await supabaseSesion(),
    sbServicio: supabaseServidor(),
    actor: { id: quien.id, correo: quien.correo, nombre: quien.nombre },
    id,
    nota,
  });
}
