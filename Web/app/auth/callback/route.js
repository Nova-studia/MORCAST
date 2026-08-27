import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { decidirDestino } from "@/lib/destino-sesion.mjs";
import { solicitudDeUsuario } from "@/lib/solicitudes-registro";

/**
 * VUELTA DE GOOGLE.
 *
 * Supabase manda aquí con `?code=…`. Ese código se cambia por una sesión, y
 * la sesión se escribe en COOKIES —no en localStorage— para que `proxy.js`
 * pueda leerla desde el servidor. Por eso esto es un `route.js` y no una
 * página: sólo un manejador de ruta puede escribir cookies en Next.
 *
 * `/auth` ya estaba en la lista `ABIERTAS` de `proxy.js`, así que esta ruta
 * se alcanza sin sesión — que es justo lo que hace falta para crearla.
 */
export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const errorDeGoogle = url.searchParams.get("error_description") || url.searchParams.get("error");

  const aLogin = (motivo) => {
    const destino = new URL("/portal/login", url.origin);
    destino.searchParams.set("error", motivo);
    return NextResponse.redirect(destino);
  };

  // Google rebota así cuando la persona cancela en su pantalla de permisos.
  if (errorDeGoogle) return aLogin("No se completó la entrada con Google.");
  if (!code) return aLogin("Falta el código de Google. Vuelve a intentarlo.");

  const galleta = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return galleta.getAll();
        },
        setAll(porEscribir) {
          porEscribir.forEach(({ name, value, options }) => galleta.set(name, value, options));
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data?.user) {
    console.error("[auth] no se pudo canjear el código:", error?.message);
    return aLogin("No se pudo iniciar sesión con Google. Inténtalo de nuevo.");
  }

  const rol = data.user.app_metadata?.rol ?? null;

  // Sólo se consulta la solicitud si hace falta: quien ya tiene sello se va a
  // su área sin pasar por la base.
  const tieneSolicitud = rol ? false : Boolean(await solicitudDeUsuario(data.user.id));

  return NextResponse.redirect(new URL(decidirDestino({ rol, tieneSolicitud }), url.origin));
}
