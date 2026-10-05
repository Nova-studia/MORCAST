/**
 * POST /api/app/segundo-paso/estado — ¿el pase que guardó la app sigue
 * sirviendo para ESTA sesión?
 *
 *   Authorization: Bearer <access_token de Supabase>
 *   Body: { pase }
 *   → 200 { ok: true, valido: true|false, exigido: true|false }
 *   → 401 / 403 / 429 / 503 { ok: false, motivo }
 *
 * Va por POST y no por GET para que el pase no quede en ninguna bitácora de
 * URLs. Un pase de otra sesión, de otro usuario, vencido o alterado da
 * `valido: false` (lib/mfa.mjs: firma HMAC + usuario + session_id).
 *
 * `exigido: false` cuando la válvula de emergencia `MFA_PANEL=apagado` está
 * puesta: entonces `valido` es true para todos, igual que la web.
 *
 * Como en la web: protege la PANTALLA de administración, no la base.
 */
import { entrarApp, responder } from "@/lib/app-ruta";
import { ROLES_PERSONAL } from "@/lib/app-auth.mjs";
import { mfaPanelActivo, secretoPanel, verificarPase } from "@/lib/mfa.mjs";

export async function POST(peticion) {
  // La app lo pregunta al abrir y al volver del fondo: el tope es holgado.
  const r = await entrarApp(peticion, {
    roles: ROLES_PERSONAL,
    freno: { nombre: "app-2p-estado", maximo: 120, minutos: 10 },
  });
  if (r.respuesta) return r.respuesta;

  if (!mfaPanelActivo()) return responder({ ok: true, valido: true, exigido: false });

  const valido = await verificarPase(
    typeof r.cuerpo.pase === "string" ? r.cuerpo.pase : null,
    { uid: r.usuario.id, sesion: r.sesion },
    secretoPanel()
  );
  return responder({ ok: true, valido, exigido: true });
}
