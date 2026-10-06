/**
 * POST /api/app/altas/estado — "Marcar contactada", "Aprobar", "Rechazar"
 * de Altas de clientes.
 *
 *   Body: { solicitudId, estado: "nueva"|"contactada"|"aprobada"|"rechazada", pase }
 *   → 200 { ok: true } | { ok: false, motivo }
 *   → 400 / 401 / 403 (segundoPaso) / 429 / 503 { ok: false, motivo }
 *
 * En la web es un UPDATE con la sesión del usuario (`cambiarEstadoAlta`,
 * lib/datos-altas.js); aquí igual, con su token (`supabaseComoUsuario`): el
 * RLS `solicitudes_alta_edita_personal` es el guardia y se cuentan las filas.
 */
import { entrarAppAdmin, responder } from "@/lib/app-ruta";
import { supabaseComoUsuario } from "@/lib/app-sesion-usuario";
import { ESTADOS_ALTA, esEstado, esId } from "@/lib/admin-app.mjs";

export async function POST(peticion) {
  const r = await entrarAppAdmin(peticion, {
    freno: { nombre: "app-altas-estado", maximo: 120, minutos: 60 },
  });
  if (r.respuesta) return r.respuesta;

  const { solicitudId, estado } = r.cuerpo;
  if (!esId(solicitudId)) return responder({ ok: false, motivo: "Esa solicitud no existe." }, 400);
  if (!esEstado(ESTADOS_ALTA, estado)) return responder({ ok: false, motivo: "Ese estado no existe." }, 400);

  const { data, error } = await supabaseComoUsuario(peticion)
    .from("solicitudes_alta")
    .update({ estado })
    .eq("id", solicitudId)
    .select("id");
  if (error) return responder({ ok: false, motivo: error.message });
  if (!data?.length) {
    return responder({ ok: false, motivo: "No se cambió nada: el permiso de la base no te deja tocar esa solicitud." });
  }
  return responder({ ok: true });
}
