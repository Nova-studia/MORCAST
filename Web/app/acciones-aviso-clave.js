"use server";

import { supabaseSesion } from "@/lib/supabase-sesion";
import { correoContrasenaCambiada } from "@/lib/correo";

/**
 * Avisa por correo de que la contraseña acaba de cambiar.
 *
 * Es la única forma que tiene un cliente de enterarse de que alguien le tomó
 * la cuenta: si no llega este correo, un cambio de contraseña ajeno es
 * completamente silencioso.
 *
 * ⚠️ El destinatario sale de la SESIÓN, nunca de un parámetro. Si aceptara un
 * correo, sería un endpoint para mandarle correos a quien uno quiera desde el
 * dominio de Morcast — el sueño de cualquiera que monte una estafa.
 */
export async function avisarContrasenaCambiada() {
  try {
    const supabase = await supabaseSesion();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return { ok: false };

    await correoContrasenaCambiada({ correo: user.email });
    return { ok: true };
  } catch (e) {
    // Que no salga el aviso NO puede tumbar el cambio de contraseña: la
    // persona ya la cambió y dejarla fuera sería peor. Queda en el registro.
    console.error("[aviso-clave] no se pudo avisar:", e?.message);
    return { ok: false };
  }
}
