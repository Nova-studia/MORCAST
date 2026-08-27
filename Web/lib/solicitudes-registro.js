import { supabaseServidor, haySupabase } from "@/lib/supabase";

/**
 * ¿Este usuario ya dejó sus datos?
 *
 * ⚠️ Va con la llave de SERVICIO, no con la sesión del usuario. La política
 * `solicitudes_alta_lee_personal` (010) sólo le entrega esa tabla al personal
 * de Morcast, así que preguntando con la sesión del recién registrado la
 * respuesta sería siempre "no hay nada" y lo mandaríamos a capturar sus datos
 * otra vez, en cada entrada, para siempre.
 *
 * 🔴 Este archivo NO lleva `"use server"`, y por eso recibe un `usuarioId`
 * sin peligro: sólo lo pueden llamar el manejador de `/auth/callback` y la
 * acción de servidor, los dos del lado del servidor. Si esta función se
 * exportara desde un `"use server"`, cualquiera podría mandarle el uuid de
 * otra persona y sacarle su folio y su empresa.
 */
export async function solicitudDeUsuario(usuarioId) {
  if (!haySupabase() || !usuarioId) return null;

  const { data, error } = await supabaseServidor()
    .from("solicitudes_alta")
    .select("id, folio, empresa, estado")
    .eq("usuario_id", usuarioId)
    .maybeSingle();

  if (error) {
    console.error("[registro] no se pudo consultar la solicitud:", error.message);
    return null;
  }
  return data || null;
}
