import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente de Supabase para el SERVIDOR, con la sesión del usuario.
 *
 * Ojo con la diferencia:
 *   · `lib/supabase.js`  → llave de servicio, SALTA el RLS. Para tareas
 *                          internas (guardar una cotización, invitar a
 *                          alguien). Nunca actúa "como" un usuario.
 *   · este archivo        → actúa como el usuario que tiene la sesión, así
 *                          que el RLS SÍ le aplica. Es el que se usa para
 *                          leer datos en las páginas.
 */
export async function supabaseSesion() {
  const galleta = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return galleta.getAll();
        },
        setAll(porEscribir) {
          try {
            porEscribir.forEach(({ name, value, options }) =>
              galleta.set(name, value, options)
            );
          } catch {
            // Desde un Server Component no se pueden escribir cookies. No es
            // un problema: proxy.js ya refrescó la sesión antes de llegar aquí.
          }
        },
      },
    }
  );
}

/**
 * Usuario y perfil de quien tiene la sesión, o null.
 *
 * Siempre `getUser()`, nunca `getSession()`: getSession lee la cookie tal
 * cual y confía en ella; getUser va al servidor de Supabase a comprobar que
 * el token sea de verdad. Para decidir permisos, solo sirve el segundo.
 */
export async function usuarioActual() {
  const supabase = await supabaseSesion();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("id, nombre, rol, cliente_id, activo")
    .eq("id", user.id)
    .single();

  if (!perfil || !perfil.activo) return null;

  return { correo: user.email, ...perfil };
}
