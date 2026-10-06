/**
 * POST /api/app/parada-aviso — el chofer, desde la app, le avisa al CLIENTE
 * de su recolección (6-oct-2026).
 *
 *   Authorization: Bearer <access_token de Supabase de un chofer (operador)>
 *   Body: { solicitud_id, evento: "en-camino" | "completada" | "no-procedio" }
 *   → 200 { ok: true, estado, avisado }       ("en-camino" además la pasa a "en-ruta")
 *   → 400 { ok: false, motivo }               (id o evento malo)
 *   → 404 { ok: false, motivo }               (no existe o no es de su ruta)
 *   → 409 { ok: false, motivo, estado }       (la parada no está en ese estado)
 *   → 401 / 403 / 429 / 503 { ok: false, motivo }
 *
 * "completada" y "no-procedio" ya los guardó la app con la sesión del chofer;
 * aquí solo se comprueba que la base diga lo mismo y se avisa (el correo y
 * los tokens del cliente no se pueden leer desde el teléfono). Cada aviso
 * sale una sola vez por recolección (lib/avisar-cliente.js): un reintento
 * responde 200 sin volver a mandar.
 */
import { entrarApp, responder } from "@/lib/app-ruta";
import { esUuid } from "@/lib/app-auth.mjs";
import { eventoDeParada } from "@/lib/avisar-cliente";

export async function POST(peticion) {
  // Un chofer con 40 paradas en un día malo, tres avisos cada una.
  const r = await entrarApp(peticion, {
    roles: ["operador"],
    freno: { nombre: "app-parada-aviso", maximo: 150, minutos: 60 },
  });
  if (r.respuesta) return r.respuesta;

  const id = typeof r.cuerpo.solicitud_id === "string" ? r.cuerpo.solicitud_id.trim().toLowerCase() : "";
  if (!esUuid(id)) return responder({ ok: false, motivo: "Falta la parada." }, 400);
  const evento = typeof r.cuerpo.evento === "string" ? r.cuerpo.evento : "";

  const res = await eventoDeParada({
    sb: r.sb,
    uid: r.usuario.id,
    correo: r.usuario.email,
    solicitudId: id,
    evento,
  });
  if (!res.ok) return responder({ ok: false, motivo: res.motivo, estado: res.estado }, res.status || 400);
  return responder({
    ok: true,
    estado: res.estado,
    avisado: Boolean(res.aviso?.correo || res.aviso?.notificaciones),
  });
}
