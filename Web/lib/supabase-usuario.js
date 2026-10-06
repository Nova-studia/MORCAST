import { createClient } from "@supabase/supabase-js";
import { tokenDeCabecera } from "./app-auth.mjs";

/**
 * Cliente de Supabase que actúa COMO el usuario de la app (6-oct-2026).
 *
 * Es el equivalente de `supabaseSesion()` (lib/supabase-sesion.js) para las
 * rutas `/api/app/...`: la app no trae cookies, trae su token en
 * `Authorization: Bearer …`. Con la llave PÚBLICA y ese token, el RLS le
 * aplica igual que en el panel web.
 *
 * Por qué no basta la llave de servicio que ya da `entrarApp`: las acciones
 * de la web (aplicar un depósito, guardar un aviso) escriben con la sesión a
 * propósito, para que el RLS siga siendo el guardia y para que
 * `auth.uid()` (p. ej. `avisos.enviado_por`) diga quién fue. Si la app
 * escribiera con la llave de servicio, se saltaría las dos cosas.
 *
 * Solo para el servidor. `entrarApp` ya comprobó el token con Auth antes de
 * llegar aquí; esto no decide permisos, solo los hereda.
 */
export function supabaseDelUsuario(peticion) {
  const token = tokenDeCabecera(peticion.headers.get("authorization"));
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}
