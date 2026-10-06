/**
 * POST /api/app/zonas/estado — mover una zona pedida (nueva → en evaluación →
 * aprobada / descartada), como /admin/zonas-pedidas.
 *
 *   Body: { id (uuid), estado, pase }
 *   → 200 { ok: true } | { ok: false, motivo }
 *   → 400 / 401 / 403 (segundoPaso) / 429 / 503 { ok: false, motivo }
 *
 * Mismo UPDATE que `cambiarEstadoZona` (lib/datos-zonas.js), con el token del
 * usuario (RLS `zonas_pedidas_personal`) y las filas contadas.
 */
import { entrarAppAdmin, responder } from "@/lib/app-ruta";
import { supabaseComoUsuario } from "@/lib/app-sesion-usuario";
import { ESTADOS_ZONA, esEstado, esId } from "@/lib/admin-app.mjs";

export async function POST(peticion) {
  const r = await entrarAppAdmin(peticion, {
    freno: { nombre: "app-zonas-estado", maximo: 120, minutos: 60 },
  });
  if (r.respuesta) return r.respuesta;

  const { id, estado } = r.cuerpo;
  if (!esId(id)) return responder({ ok: false, motivo: "No se encontró esa zona." }, 400);
  if (!esEstado(ESTADOS_ZONA, estado)) return responder({ ok: false, motivo: "Ese estado no existe." }, 400);

  const { data, error } = await supabaseComoUsuario(peticion)
    .from("zonas_pedidas")
    .update({ estado })
    .eq("id", id)
    .select("id");
  if (error) return responder({ ok: false, motivo: error.message });
  if (!data?.length) {
    return responder({ ok: false, motivo: "No se cambió nada: el permiso de la base no te deja tocar esa zona." });
  }
  return responder({ ok: true });
}
