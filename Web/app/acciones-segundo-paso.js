"use server";

import { cookies } from "next/headers";
import { supabaseSesion } from "@/lib/supabase-sesion";
import { supabaseServidor, haySupabase } from "@/lib/supabase";
import { hayResend, correoCodigoPanel } from "@/lib/correo";
import { registrar } from "@/lib/bitacora";
import { COOKIE_PASE, VIGENCIA_PASE_S, secretoPanel, sesionDelToken } from "@/lib/mfa.mjs";
import { mandarCodigo, verificarCodigo, limpiarCodigo, MOTIVOS_2P } from "@/lib/segundo-paso.mjs";

/**
 * SEGUNDO PASO DEL PANEL: mandar el código por correo y revisarlo.
 * La explicación completa (y por qué por correo) está en lib/mfa.mjs.
 *
 * Todo corre en el servidor. La tabla `codigos_panel` solo la toca la llave
 * de servicio (db/022): el navegador nunca ve ni el código ni su huella.
 * El trámite en sí (lib/segundo-paso.mjs) es el mismo que usa la app por
 * /api/app/segundo-paso/...; aquí solo cambia de dónde sale la sesión (la
 * cookie) y a dónde va el pase (otra cookie).
 */

/** Quién está intentando entrar: tiene que ser dueño o admin, activo. */
async function personalConSesion() {
  const supabase = await supabaseSesion();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tu sesión se venció. Vuelve a entrar." };

  const { data: perfil } = await supabase
    .from("perfiles").select("rol, activo").eq("id", user.id).single();
  if (!perfil?.activo || (perfil.rol !== "dueno" && perfil.rol !== "admin")) {
    return { error: "Esta cuenta no tiene acceso al panel." };
  }

  const { data: { session } } = await supabase.auth.getSession();
  const sesion = sesionDelToken(session?.access_token);
  if (!sesion) return { error: "No se pudo leer tu sesión. Vuelve a entrar." };

  return { user, sesion };
}

/** Manda (o reenvía) el código al correo de la cuenta. */
export async function mandarCodigoPanel() {
  if (!haySupabase()) return { ok: false, motivo: "El panel está en modo de demostración." };

  const { user, error } = await personalConSesion();
  if (error) return { ok: false, motivo: error };

  // Las reglas (espera entre envíos, vigencia, qué decir si no hay correo)
  // son las mismas que usa la app: viven en lib/segundo-paso.mjs.
  return mandarCodigo({
    usuario: user,
    sb: supabaseServidor(),
    secreto: secretoPanel(),
    mandarCorreo: correoCodigoPanel,
    hayCorreo: hayResend(),
    produccion: process.env.NODE_ENV === "production",
  });
}

/** Revisa el código. Si es bueno, deja el pase de esta sesión. */
export async function verificarCodigoPanel(codigo) {
  if (!haySupabase()) return { ok: false, motivo: "El panel está en modo de demostración." };

  if (limpiarCodigo(codigo).length !== 6) return { ok: false, motivo: MOTIVOS_2P.formato };

  const { user, sesion, error } = await personalConSesion();
  if (error) return { ok: false, motivo: error };

  const r = await verificarCodigo({ usuario: user, sesion, codigo, sb: supabaseServidor(), secreto: secretoPanel() });
  if (!r.ok) return r;

  // En la web el pase va en una cookie httpOnly: el JavaScript de la página
  // no lo puede leer ni copiar.
  const galleta = await cookies();
  galleta.set(COOKIE_PASE, r.pase, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: VIGENCIA_PASE_S,
  });

  await registrar({ accion: "entrar_panel", tabla: "perfiles", registroId: user.id, detalle: { metodo: "codigo_correo" } });
  return { ok: true };
}
