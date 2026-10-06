/**
 * POST /api/app/recolecciones/rechazar — la oficina, desde la app, rechaza
 * una recolección dejando dicho por qué (6-oct-2026, paridad con
 * /admin/recolecciones).
 *
 *   Authorization: Bearer <access_token de Supabase del dueño o un admin>
 *   Body: { id, motivo?: string, pase }      (sin motivo: "Sin cupo en la ruta.")
 *   → 200 { ok: true, estado: "rechazada" }
 *   → 400 { ok: false, motivo }               (id malo o motivo muy largo)
 *   → 403 { ok: false, segundoPaso: true }    (falta el código por correo)
 *   → 404 { ok: false, motivo }
 *   → 409 { ok: false, motivo }               (ya no se puede rechazar)
 *   → 401 / 403 / 429 / 503 { ok: false, motivo }
 *
 * Como en la web, se rechaza una solicitada o una vencida; una confirmada al
 * día se CAMBIA, no se rechaza. Mismo trabajo que el panel web
 * (lib/recolecciones-oficina.js): bitácora `rechazar_recoleccion` y correo
 * al cliente con el motivo.
 */
import { entrarAppAdmin, responder } from "@/lib/app-ruta";
import { esUuid, tokenDeCabecera } from "@/lib/app-auth.mjs";
import { fechaEnMatamoros } from "@/lib/avisos.mjs";
import { motivoDeRechazo, puedeRechazar } from "@/lib/oficina-recolecciones.mjs";
import { cambiarEstadoSolicitudComo } from "@/lib/recolecciones-oficina";
import { supabaseDelToken } from "@/lib/supabase-usuario";

export async function POST(peticion) {
  const r = await entrarAppAdmin(peticion, {
    freno: { nombre: "app-recolecciones", maximo: 150, minutos: 60 },
  });
  if (r.respuesta) return r.respuesta;

  const id = typeof r.cuerpo.id === "string" ? r.cuerpo.id.trim().toLowerCase() : "";
  if (!esUuid(id)) return responder({ ok: false, motivo: "Falta la recolección." }, 400);

  const m = motivoDeRechazo(r.cuerpo.motivo);
  if (!m.ok) return responder({ ok: false, motivo: m.motivo }, 400);

  const sb = supabaseDelToken(tokenDeCabecera(peticion.headers.get("authorization")));
  const { data: fila, error } = await sb
    .from("solicitudes_recoleccion")
    .select("id, estado, fecha_pedida, fecha_confirmada")
    .eq("id", id)
    .maybeSingle();
  if (error) return responder({ ok: false, motivo: error.message }, 500);
  if (!fila) return responder({ ok: false, motivo: "Esa recolección no existe." }, 404);
  if (!puedeRechazar(fila, fechaEnMatamoros(new Date()))) {
    return responder({ ok: false, motivo: "Esa recolección ya no se puede rechazar: cámbiala o déjala como está." }, 409);
  }

  const res = await cambiarEstadoSolicitudComo({
    sb,
    sbServicio: r.sb,
    actor: { id: r.usuario.id, correo: r.usuario.email },
    id,
    cambios: { estado: "rechazada", motivo_rechazo: m.motivo },
    accion: "rechazar_recoleccion",
    origen: "app",
    soloSiEstado: [fila.estado],
  });
  if (!res.ok) return responder({ ok: false, motivo: res.motivo }, 409);
  return responder({ ok: true, estado: res.estado });
}
