/**
 * POST /api/cuenta/eliminar — "Eliminar mi cuenta" de la app móvil.
 *
 * La app manda `Authorization: Bearer <access_token>` de SU sesión de
 * Supabase. Aquí no se confía en nada más que ese token: quién es y qué rol
 * tiene lo dice el servidor de Auth, no lo que mande el teléfono. Toda la
 * lógica (qué se borra, qué se conserva, la cuenta de muestra del revisor)
 * vive en `lib/eliminar-cuenta.mjs`, con sus pruebas.
 *
 * Por qué una ruta y no una función SQL `security definer`: borrar un
 * usuario es trabajo de la API de administración de Auth (`deleteUser`), que
 * limpia identidades y sesiones. Un `delete from auth.users` a mano se salta
 * eso, y el esquema `auth` lo administra Supabase. Además así no hace falta
 * correr ninguna migración: basta con desplegar la web, que ya tiene la llave
 * de servicio (la usan la bitácora y el alta de clientes).
 */
import { supabaseServidor, haySupabase } from "@/lib/supabase";
import { eliminarCuenta, tokenDeCabecera, MENSAJES } from "@/lib/eliminar-cuenta.mjs";

const SIN_CACHE = { "Cache-Control": "no-store" };

export async function POST(peticion) {
  if (!haySupabase()) {
    return Response.json({ ok: false, mensaje: MENSAJES.fallo }, { status: 503, headers: SIN_CACHE });
  }

  const { status, cuerpo } = await eliminarCuenta({
    token: tokenDeCabecera(peticion.headers.get("authorization")),
    sb: supabaseServidor(),
  });

  return Response.json(cuerpo, { status, headers: SIN_CACHE });
}
