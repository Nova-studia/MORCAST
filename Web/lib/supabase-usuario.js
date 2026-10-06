import { createClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase que actúa COMO el usuario de la app (6-oct-2026).
 *
 * Las rutas `/api/app/...` reciben el token de la sesión del teléfono
 * (`Authorization: Bearer …`). Para las acciones de la oficina se usa ESE
 * token, con la llave pública, y no la llave de servicio: así el RLS sigue
 * siendo el guardia igual que en el panel web (`supabaseSesion`), y un
 * UPDATE que el permiso no deja hacer devuelve cero filas en vez de
 * saltárselo. La llave de servicio solo se usa para lo que el panel web
 * también hace con ella: la bitácora, los correos y los tokens de push.
 *
 * Quien llama YA validó el token (lib/app-auth.mjs); esto no lo vuelve a
 * comprobar, solo lo reenvía a la base.
 */
export function supabaseDelToken(token) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon || !token) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY o el token.");
  }
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}
