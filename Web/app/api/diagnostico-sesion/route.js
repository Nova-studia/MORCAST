/**
 * GET /api/diagnostico-sesion — TEMPORAL (5-oct-2026). Se borra al cerrar
 * el problema.
 *
 * En la vista previa, el dueño entraba al panel sin que se le pidiera el
 * segundo paso, aunque con un Supabase simulado el mismo código sí lo pedía.
 * Esta ruta repite, con la sesión de quien la abre, exactamente lo que hace
 * proxy.js para decidir, y lo enseña.
 *
 * Solo enseña datos de la PROPIA sesión (rol, nivel de verificación, cuántos
 * factores tiene), nunca de otra persona, y sin tokens.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { mfaPanelActivo, necesitaVerificar } from "@/lib/mfa.mjs";

const SIN_CACHE = { "Cache-Control": "no-store" };

function cargaDelToken(token) {
  try {
    const parte = String(token || "").split(".")[1];
    const json = JSON.parse(Buffer.from(parte, "base64url").toString("utf8"));
    return { aal: json.aal ?? null, amr: (json.amr || []).map((m) => m.method || m) };
  } catch {
    return { aal: "no se pudo leer", amr: [] };
  }
}

export async function GET() {
  const galleta = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => galleta.getAll(), setAll() {} } }
  );

  const { data: { user }, error: errorUsuario } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ sesion: false, error: errorUsuario?.message || null }, { headers: SIN_CACHE });
  }

  const rol = user.app_metadata?.rol ?? null;
  const { data: nivel, error: errorNivel } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const { data: { session } } = await supabase.auth.getSession();

  return Response.json(
    {
      sesion: true,
      rol,
      nivel_que_ve_el_proxy: nivel?.currentLevel ?? null,
      nivel_siguiente: nivel?.nextLevel ?? null,
      error_nivel: errorNivel?.message || null,
      token_dice: cargaDelToken(session?.access_token),
      factores: (user.factors || []).map((f) => ({ tipo: f.factor_type, estado: f.status })),
      mfa_panel_activo: mfaPanelActivo(),
      mfa_panel_variable: process.env.MFA_PANEL ?? "(no definida)",
      el_proxy_pediria_verificar: necesitaVerificar({ rol, aal: nivel?.currentLevel }),
      entorno: process.env.VERCEL_ENV ?? "local",
      version: (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7) || null,
    },
    { headers: SIN_CACHE }
  );
}
