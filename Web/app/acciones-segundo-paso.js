"use server";

import { cookies } from "next/headers";
import { supabaseSesion } from "@/lib/supabase-sesion";
import { supabaseServidor, haySupabase } from "@/lib/supabase";
import { hayResend, correoCodigoPanel } from "@/lib/correo";
import { registrar } from "@/lib/bitacora";
import {
  COOKIE_PASE,
  ESPERA_REENVIO_S,
  MAX_INTENTOS,
  VIGENCIA_CODIGO_MIN,
  VIGENCIA_PASE_S,
  firmarPase,
  generarCodigo,
  huellaCodigo,
  ocultarCorreo,
  secretoPanel,
  sesionDelToken,
} from "@/lib/mfa.mjs";

/**
 * SEGUNDO PASO DEL PANEL: mandar el código por correo y revisarlo.
 * La explicación completa (y por qué por correo) está en lib/mfa.mjs.
 *
 * Todo corre en el servidor. La tabla `codigos_panel` solo la toca la llave
 * de servicio (db/022): el navegador nunca ve ni el código ni su huella.
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

  const secreto = secretoPanel();
  if (!secreto) return { ok: false, motivo: "Falta configurar el servidor. Avisa a soporte." };

  const sb = supabaseServidor();
  const { data: previo } = await sb
    .from("codigos_panel").select("enviado").eq("usuario_id", user.id).maybeSingle();
  if (previo) {
    const pasaron = (Date.now() - new Date(previo.enviado).getTime()) / 1000;
    if (pasaron < ESPERA_REENVIO_S) {
      // Ya hay uno recién mandado (por ejemplo, la pantalla se recargó): no
      // se manda otro, se avisa a dónde llegó.
      return { ok: true, yaEnviado: true, espera: Math.ceil(ESPERA_REENVIO_S - pasaron), correo: ocultarCorreo(user.email) };
    }
  }

  const codigo = generarCodigo();
  const vence = new Date(Date.now() + VIGENCIA_CODIGO_MIN * 60 * 1000).toISOString();
  const { error: eGuardar } = await sb.from("codigos_panel").upsert({
    usuario_id: user.id,
    huella: await huellaCodigo(codigo, user.id, secreto),
    vence,
    intentos: 0,
    enviado: new Date().toISOString(),
  });
  if (eGuardar) {
    console.error("[segundo paso] no se pudo guardar el código:", eGuardar.message);
    return { ok: false, motivo: "No se pudo preparar tu código. Intenta de nuevo." };
  }

  if (!hayResend()) {
    // En producción sin correo no hay forma de entregar el código: se dice
    // claro en vez de dejar a la persona esperando un correo que no llega.
    if (process.env.NODE_ENV === "production") {
      return { ok: false, motivo: "El envío de correos no está configurado. Avisa a soporte." };
    }
    console.warn(`[segundo paso] (desarrollo, sin Resend) código de ${user.email}: ${codigo}`);
  } else {
    try {
      await correoCodigoPanel({ correo: user.email, codigo, minutos: VIGENCIA_CODIGO_MIN });
    } catch (e) {
      console.error("[segundo paso] no se pudo mandar el correo:", e?.message || e);
      return { ok: false, motivo: "No se pudo mandar el correo. Intenta de nuevo en un momento." };
    }
  }

  return { ok: true, espera: ESPERA_REENVIO_S, correo: ocultarCorreo(user.email) };
}

/** Revisa el código. Si es bueno, deja el pase de esta sesión. */
export async function verificarCodigoPanel(codigo) {
  if (!haySupabase()) return { ok: false, motivo: "El panel está en modo de demostración." };

  const limpio = String(codigo || "").replace(/\D/g, "");
  if (limpio.length !== 6) return { ok: false, motivo: "El código tiene 6 dígitos." };

  const { user, sesion, error } = await personalConSesion();
  if (error) return { ok: false, motivo: error };

  const secreto = secretoPanel();
  if (!secreto) return { ok: false, motivo: "Falta configurar el servidor. Avisa a soporte." };

  const sb = supabaseServidor();
  const { data: fila } = await sb
    .from("codigos_panel").select("huella, vence, intentos").eq("usuario_id", user.id).maybeSingle();

  if (!fila) return { ok: false, motivo: "Pide un código nuevo." };
  if (new Date(fila.vence).getTime() < Date.now()) {
    return { ok: false, motivo: "Ese código ya venció. Pide uno nuevo." };
  }
  if (fila.intentos >= MAX_INTENTOS) {
    return { ok: false, motivo: "Demasiados intentos con ese código. Pide uno nuevo." };
  }

  if ((await huellaCodigo(limpio, user.id, secreto)) !== fila.huella) {
    await sb.from("codigos_panel").update({ intentos: fila.intentos + 1 }).eq("usuario_id", user.id);
    const quedan = MAX_INTENTOS - fila.intentos - 1;
    return {
      ok: false,
      motivo: quedan > 0
        ? `Código incorrecto. Te quedan ${quedan} ${quedan === 1 ? "intento" : "intentos"}.`
        : "Código incorrecto. Pide uno nuevo.",
    };
  }

  // Un código sirve una sola vez.
  await sb.from("codigos_panel").delete().eq("usuario_id", user.id);

  const vencePase = Math.floor(Date.now() / 1000) + VIGENCIA_PASE_S;
  const galleta = await cookies();
  galleta.set(COOKIE_PASE, await firmarPase({ uid: user.id, sesion, vence: vencePase }, secreto), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: VIGENCIA_PASE_S,
  });

  await registrar({ accion: "entrar_panel", tabla: "perfiles", registroId: user.id, detalle: { metodo: "codigo_correo" } });
  return { ok: true };
}
