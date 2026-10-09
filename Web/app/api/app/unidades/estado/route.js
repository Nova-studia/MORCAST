/**
 * POST /api/app/unidades/estado — poner una unidad (camión) como activa, en
 * taller o de baja desde la app (6-oct-2026; el alta y la edición completa
 * siguen en /admin/unidades).
 *
 *   Body: { id (uuid), estado: "activa"|"taller"|"baja", pase }
 *   → 200 { ok: true, unidad: { id, numero_economico, estado } } | { ok: false, motivo }
 *   → 400 / 401 / 403 (segundoPaso) / 429 / 503 { ok: false, motivo }
 *
 * Los estados son los de lib/unidades.mjs. Va con el token del usuario: el
 * RLS `unidades_personal` (db/023) es el guardia y el disparador
 * `bitacora_unidades_tg` anota el cambio a nombre de quien lo hizo, igual que
 * desde la web.
 */
import { entrarAppAdmin, responder } from "@/lib/app-ruta";
import { supabaseComoUsuario } from "@/lib/app-sesion-usuario";
import { ESTADOS_UNIDAD } from "@/lib/unidades.mjs";
import { esEstado, esId } from "@/lib/admin-app.mjs";

export async function POST(peticion) {
  const r = await entrarAppAdmin(peticion, { permiso: "unidades",
    freno: { nombre: "app-unidades-estado", maximo: 120, minutos: 60 },
  });
  if (r.respuesta) return r.respuesta;

  const { id, estado } = r.cuerpo;
  if (!esId(id)) return responder({ ok: false, motivo: "No se encontró esa unidad." }, 400);
  if (!esEstado(ESTADOS_UNIDAD, estado)) return responder({ ok: false, motivo: "Ese estado no existe." }, 400);

  const { data, error } = await supabaseComoUsuario(peticion)
    .from("unidades")
    .update({ estado })
    .eq("id", id)
    .select("id, numero_economico, estado");
  if (error) return responder({ ok: false, motivo: error.message });
  if (!data?.length) {
    return responder({ ok: false, motivo: "No se guardó nada: la base no te dejó cambiar esa unidad." });
  }
  return responder({ ok: true, unidad: data[0] });
}
