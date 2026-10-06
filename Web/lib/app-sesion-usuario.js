import { createClient } from "@supabase/supabase-js";
import { tokenDeCabecera } from "./app-auth.mjs";

/**
 * Supabase COMO EL USUARIO que llamó desde la app (6-oct-2026).
 *
 * Las rutas `/api/app/...` traen el token de la sesión del teléfono. Para lo
 * que en la web se escribe con la sesión del usuario (RLS de guardia, y la
 * bitácora de la base —db/022— anotando a la persona y no a "sistema"), la
 * app tiene que hacer lo mismo: este cliente usa la llave PÚBLICA y manda el
 * token del usuario, así que la base lo trata exactamente como al panel web.
 *
 * Sólo se usa DESPUÉS de `entrarApp`/`entrarAppAdmin`, que ya comprobaron el
 * token, el rol y el pase. Esto no decide permisos: los repite la base.
 */
export function supabaseComoUsuario(peticion) {
  const token = tokenDeCabecera(peticion.headers.get("authorization"));
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
