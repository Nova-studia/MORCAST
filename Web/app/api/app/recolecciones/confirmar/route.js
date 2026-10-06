/**
 * POST /api/app/recolecciones/confirmar — la oficina, desde la app, le pone
 * día, hora y chofer a una recolección (6-oct-2026, paridad con
 * /admin/recolecciones). Sirve para las tres cosas que en la web son el
 * mismo botón: CONFIRMAR una solicitada, REAGENDAR una vencida y CAMBIAR
 * una confirmada.
 *
 *   Authorization: Bearer <access_token de Supabase del dueño o un admin>
 *   Body: { id, fecha: "AAAA-MM-DD", hora?: "HH:MM" | "", chofer_id?: uuid | "", pase }
 *   → 200 { ok: true, accion, estado }
 *        accion: confirmar_recoleccion | reagendar_recoleccion_vencida | cambiar_recoleccion_confirmada
 *   → 400 { ok: false, motivo }               (id, fecha, hora o chofer malos)
 *   → 403 { ok: false, segundoPaso: true }    (falta el código por correo)
 *   → 404 { ok: false, motivo }               (no existe o el RLS no la deja ver)
 *   → 409 { ok: false, motivo }               (cerrada, o en ruta sin vencer)
 *   → 401 / 403 / 429 / 503 { ok: false, motivo }
 *
 * La ACCIÓN no la dice el teléfono: sale de la recolección como está en la
 * base (lib/oficina-recolecciones.mjs), con las mismas reglas de la web. El
 * trabajo (UPDATE con el token del usuario bajo el RLS, bitácora, correo y
 * push al cliente, correo y push al chofer) es la MISMA función que usa el
 * panel web: lib/recolecciones-oficina.js.
 */
import { entrarAppAdmin, responder } from "@/lib/app-ruta";
import { esUuid, tokenDeCabecera } from "@/lib/app-auth.mjs";
import { fechaEnMatamoros } from "@/lib/avisos.mjs";
import { accionDeProgramacion, validarProgramacion } from "@/lib/oficina-recolecciones.mjs";
import { cambiarEstadoSolicitudComo } from "@/lib/recolecciones-oficina";
import { supabaseDelToken } from "@/lib/supabase-usuario";

export async function POST(peticion) {
  const r = await entrarAppAdmin(peticion, {
    freno: { nombre: "app-recolecciones", maximo: 150, minutos: 60 },
  });
  if (r.respuesta) return r.respuesta;

  const id = typeof r.cuerpo.id === "string" ? r.cuerpo.id.trim().toLowerCase() : "";
  if (!esUuid(id)) return responder({ ok: false, motivo: "Falta la recolección." }, 400);

  const hoy = fechaEnMatamoros(new Date());
  const v = validarProgramacion(r.cuerpo, hoy);
  if (!v.ok) return responder({ ok: false, motivo: v.motivo }, 400);

  const sb = supabaseDelToken(tokenDeCabecera(peticion.headers.get("authorization")));
  const { data: fila, error } = await sb
    .from("solicitudes_recoleccion")
    .select("id, estado, fecha_pedida, fecha_confirmada")
    .eq("id", id)
    .maybeSingle();
  if (error) return responder({ ok: false, motivo: error.message }, 500);

  const decision = accionDeProgramacion(fila, hoy);
  if (!decision.ok) return responder({ ok: false, motivo: decision.motivo }, decision.status);

  // El chofer tiene que ser un chofer de verdad, activo. Con un id cualquiera
  // la parada quedaría asignada a nadie (o a un cliente) y nadie iría.
  if (v.cambios.chofer_id) {
    const { data: chofer } = await r.sb
      .from("perfiles")
      .select("id")
      .eq("id", v.cambios.chofer_id)
      .eq("rol", "operador")
      .eq("activo", true)
      .maybeSingle();
    if (!chofer) return responder({ ok: false, motivo: "Ese chofer no existe o está desactivado." }, 400);
  }

  const res = await cambiarEstadoSolicitudComo({
    sb,
    sbServicio: r.sb,
    actor: { id: r.usuario.id, correo: r.usuario.email },
    id,
    cambios: v.cambios,
    accion: decision.accion,
    origen: "app",
    // Solo si sigue como se leyó: si el chofer la tomó o alguien la cerró
    // entre tanto, no se le mueve.
    soloSiEstado: [fila.estado],
  });
  if (!res.ok) return responder({ ok: false, motivo: res.motivo }, 409);
  return responder({ ok: true, accion: decision.accion, estado: res.estado });
}
