import { createClient } from "@supabase/supabase-js";
import { tokenDeCabecera } from "./app-auth.mjs";

/**
 * Cliente de Supabase que actúa COMO el usuario de la app (6-oct-2026).
 *
 * Es el equivalente de `supabaseSesion()` (lib/supabase-sesion.js) para las
 * rutas `/api/app/...`: la app no trae cookies, trae su token en
 * `Authorization: Bearer …`. Con la llave PÚBLICA y ese token, el RLS le
 * aplica igual que en el panel web, y un UPDATE que el permiso no deja hacer
 * devuelve cero filas en vez de saltárselo.
 *
 * Por qué no basta la llave de servicio que ya da `entrarApp`: las acciones
 * de la web (confirmar una recolección, aplicar un depósito, guardar un
 * aviso) escriben con la sesión a propósito, para que el RLS siga siendo el
 * guardia y para que `auth.uid()` (p. ej. `avisos.enviado_por`) diga quién
 * fue. La llave de servicio solo se usa para lo que el panel web también
 * hace con ella: la bitácora, los correos y los tokens de push.
 *
 * Solo para el servidor. Quien llama YA validó el token (lib/app-auth.mjs);
 * esto no decide permisos, solo los hereda.
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

/** Lo mismo, tomando el token de la cabecera de la petición. */
export function supabaseDelUsuario(peticion) {
  return supabaseDelToken(tokenDeCabecera(peticion.headers.get("authorization")));
}
