/**
 * POST /api/app/incidentes/atender — la oficina, desde la app, marca como
 * atendido un incidente del chofer, con la nota de qué se hizo (6-oct-2026,
 * paridad con /admin/incidentes).
 *
 *   Authorization: Bearer <access_token de Supabase del dueño o un admin>
 *   Body: { id, nota, pase }
 *   → 200 { ok: true, atendidoEn, atendio }
 *   → 400 { ok: false, motivo }               (id malo o nota corta/larga)
 *   → 403 { ok: false, segundoPaso: true }    (falta el código por correo)
 *   → 409 { ok: false, motivo }               (alguien más ya lo cerró)
 *   → 401 / 403 / 429 / 503 { ok: false, motivo }
 *
 * La MISMA función que el panel web (lib/incidentes-oficina.js): la nota es
 * obligatoria, solo se cierra si sigue abierto y queda en la bitácora
 * (`atender_incidente`). El UPDATE va con el token del usuario, bajo el RLS.
 */
import { entrarAppAdmin, responder } from "@/lib/app-ruta";
import { esUuid, tokenDeCabecera } from "@/lib/app-auth.mjs";
import { atenderIncidenteComo } from "@/lib/incidentes-oficina";
import { validarAtencion } from "@/app/(admin)/admin/incidentes/bandeja.mjs";
import { supabaseDelToken } from "@/lib/supabase-usuario";

export async function POST(peticion) {
  const r = await entrarAppAdmin(peticion, { permiso: "incidentes",
    freno: { nombre: "app-incidentes", maximo: 120, minutos: 60 },
  });
  if (r.respuesta) return r.respuesta;

  const id = typeof r.cuerpo.id === "string" ? r.cuerpo.id.trim().toLowerCase() : "";
  if (!esUuid(id)) return responder({ ok: false, motivo: "Falta el incidente." }, 400);

  // Se revisa aquí también para contestar 400 (y no 409) a una nota mala.
  const v = validarAtencion(r.cuerpo.nota);
  if (!v.ok) return responder({ ok: false, motivo: v.motivo }, 400);

  const res = await atenderIncidenteComo({
    sb: supabaseDelToken(tokenDeCabecera(peticion.headers.get("authorization"))),
    sbServicio: r.sb,
    actor: { id: r.usuario.id, correo: r.usuario.email, nombre: r.perfil.nombre },
    id,
    nota: v.nota,
    origen: "app",
  });
  if (!res.ok) return responder({ ok: false, motivo: res.motivo }, 409);
  return responder({ ok: true, atendidoEn: res.atendidoEn, atendio: res.atendio });
}
