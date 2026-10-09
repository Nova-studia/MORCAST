"use server";

import { cookies } from "next/headers";
import { supabaseSesion } from "@/lib/supabase-sesion";
import { supabaseServidor } from "@/lib/supabase";
import { registrar } from "@/lib/bitacora";
import { COOKIE_PASE, VIGENCIA_PASE_S, firmarPase, verificarPase, secretoPanel, sesionDelToken } from "@/lib/mfa.mjs";
import { destinoPanel, marcaPuente } from "@/lib/app-acciones-mapa.mjs";

/**
 * EL PUENTE DE LA APP AL PANEL WEB (9-oct-2026, "apps al 100%").
 *
 * La app ya pasó el segundo paso. La ruta `puente-admin` le dio dos cosas:
 * un enlace mágico (`th`, Supabase lo consume UNA vez) y un pase de 2 minutos
 * firmado y AMARRADO a ese enlace (`pp`). Aquí, en el servidor:
 *   1. se canjea `th` → la sesión del navegador (si ya se usó, no hay nada);
 *   2. se comprueba que `pp` es de ese usuario y de ESE enlace;
 *   3. se revisa en la base que sea dueño o admin ACTIVO;
 *   4. se deja el pase del segundo paso de la sesión nueva.
 * Con la contraseña robada y el enlace visto de reojo ya no basta: el enlace
 * ya se gastó (revisión de la web, 9-oct-2026).
 */
export async function canjearPuenteAdmin({ th, pp, destino } = {}) {
  if (typeof th !== "string" || typeof pp !== "string" || !th || !pp) {
    return { ok: false, motivo: "El enlace no está completo. Vuelve a abrirlo desde la app." };
  }
  const sb = await supabaseSesion();
  const { error: errOtp } = await sb.auth.verifyOtp({ token_hash: th, type: "magiclink" });
  if (errOtp) return { ok: false, motivo: "Este enlace ya se usó o caducó. Vuelve a abrirlo desde la app." };

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, motivo: "No se pudo abrir tu sesión." };
  const { data: perfil } = await supabaseServidor().from("perfiles").select("rol, activo").eq("id", user.id).maybeSingle();
  if (!perfil?.activo || (perfil.rol !== "dueno" && perfil.rol !== "admin")) {
    await sb.auth.signOut({ scope: "local" });
    return { ok: false, motivo: "Esta cuenta no entra al panel." };
  }
  if (!(await verificarPase(pp, { uid: user.id, sesion: await marcaPuente(th) }, secretoPanel()))) {
    await sb.auth.signOut({ scope: "local" });
    return { ok: false, motivo: "El enlace ya caducó. Vuelve a abrirlo desde la app." };
  }

  const { data: { session } } = await sb.auth.getSession();
  const sesion = sesionDelToken(session?.access_token);
  if (!sesion) return { ok: false, motivo: "No se pudo abrir tu sesión." };
  const pase = await firmarPase({ uid: user.id, sesion, vence: Math.floor(Date.now() / 1000) + VIGENCIA_PASE_S }, secretoPanel());
  (await cookies()).set(COOKIE_PASE, pase, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: VIGENCIA_PASE_S,
  });
  await registrar({ accion: "entrar_panel", tabla: "perfiles", registroId: user.id, detalle: { metodo: "puente_app" } });
  return { ok: true, destino: destinoPanel(destino) };
}
