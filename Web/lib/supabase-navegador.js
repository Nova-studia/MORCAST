"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para el NAVEGADOR.
 *
 * Usa la llave anónima, que es pública a propósito: no da acceso a nada por
 * sí sola. Quien decide qué puede ver cada quien son las políticas RLS de
 * `db/002-rls.sql`, dentro de la base de datos.
 *
 * La sesión NO se guarda en localStorage: `@supabase/ssr` la escribe en
 * cookies para que el servidor también pueda leerla y así proteger las
 * páginas antes de mandarlas.
 *
 * Se guarda UNA sola instancia. Antes se construía un cliente nuevo en cada
 * llamada, y cada cliente levanta lo suyo: su escucha de cambios de sesión y
 * su propio temporizador para renovar el token. En una pantalla que consulta
 * seguido, eso son clientes acumulándose sin que nadie los apague.
 */
let cliente = null;

export function supabaseNavegador() {
  if (!cliente) {
    cliente = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }
  return cliente;
}

/** true si ya están puestas las variables de entorno del navegador. */
export function haySupabaseNavegador() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
