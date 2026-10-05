/**
 * POST /api/app/segundo-paso/mandar — la app pide el código por correo para
 * entrar a la administración (solo dueño y admin activos; otros roles: 403).
 *
 *   Authorization: Bearer <access_token de Supabase>
 *   → 200 { ok: true, correo: "l•••5@gmail.com", espera: 60, yaEnviado? }
 *   → 400 { ok: false, motivo }   (no se pudo guardar o mandar)
 *   → 401 / 403 / 429 / 503 { ok: false, motivo }
 *
 * Es el mismo trámite que la web (lib/segundo-paso.mjs). OJO, igual que en
 * la web: esto protege la PANTALLA de administración de la app, no la base.
 * Supabase no reconoce este código como segundo factor (la sesión sigue en
 * `aal1`), así que el RLS deja al admin lo mismo con o sin código. Ver el
 * porqué completo en lib/mfa.mjs.
 */
import { entrarApp, responder } from "@/lib/app-ruta";
import { ROLES_PERSONAL } from "@/lib/app-auth.mjs";
import { mandarCodigo } from "@/lib/segundo-paso.mjs";
import { secretoPanel } from "@/lib/mfa.mjs";
import { hayResend, correoCodigoPanel } from "@/lib/correo";

export async function POST(peticion) {
  // 10 envíos por hora por persona, además de los 60 s entre uno y otro que
  // pone el propio trámite: nadie puede usar esto para llenarle el buzón a
  // un administrador.
  const r = await entrarApp(peticion, {
    roles: ROLES_PERSONAL,
    freno: { nombre: "app-2p-mandar", maximo: 10, minutos: 60 },
  });
  if (r.respuesta) return r.respuesta;

  const res = await mandarCodigo({
    usuario: r.usuario,
    sb: r.sb,
    secreto: secretoPanel(),
    mandarCorreo: correoCodigoPanel,
    hayCorreo: hayResend(),
    produccion: process.env.NODE_ENV === "production",
  });
  return responder(res, res.ok ? 200 : 400);
}
