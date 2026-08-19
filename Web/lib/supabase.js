import { createClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase para uso EXCLUSIVO en el servidor.
 *
 * Usa la service role key, que salta las políticas RLS. Nunca la importes
 * desde un componente con "use client" ni la expongas con NEXT_PUBLIC_.
 */
export function supabaseServidor() {
  const url = process.env.SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !clave) {
    throw new Error(
      "Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en las variables de entorno."
    );
  }

  return createClient(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** true si Supabase está configurado; permite correr el sitio sin BD. */
export function haySupabase() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
