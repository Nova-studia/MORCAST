import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { casaDe, decidirDestino, DESTINOS } from "@/lib/destino-sesion.mjs";
import { ERRORES_LOGIN } from "@/lib/errores-login.mjs";
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

/**
 * DE DÓNDE CUELGAN LAS REDIRECCIONES.
 *
 * Detrás de un balanceador —y Vercel, que es donde vive esto desde el
 * 19-ago-2026, es el caso documentado— el `request.url` que ve el código puede
 * traer el host INTERNO de la plataforma y no morcast.mx. Si se resuelve mal,
 * la cookie de sesión se escribe para un host y al navegador se le manda a
 * otro: la persona acaba en el login sin sesión y SIN NINGÚN ERROR VISIBLE,
 * que es la falla más cara de diagnosticar. Por eso el manejador de referencia
 * de Supabase para Next prefiere `x-forwarded-host`, que es el host que pidió
 * el navegador de verdad. Si no viene (desarrollo local, o cualquier servidor
 * sin balanceador delante) se cae a `url.origin`, que ahí sí es el correcto.
 *
 * Lista blanca de hosts que puede devolver `x-forwarded-host`. Sin ella, un
 * proxy que dejara pasar la cabecera del cliente tal cual (hoy Vercel no lo
 * hace) permitiría mandar a la gente a cualquier dominio con sólo mentir en
 * la cabecera: phishing por redirección abierta. La comparación es sobre el
 * host SIN puerto —`morcast.mx:443` tiene que seguir aceptándose.
 */
function hostPermitido(host) {
  const [nombre] = host.split(":");
  return (
    nombre === "morcast.mx" ||
    nombre === "www.morcast.mx" ||
    nombre.endsWith(".vercel.app") ||
    nombre === "localhost" ||
    nombre === "127.0.0.1"
  );
}

function origenReal(request, url) {
  // `x-forwarded-host` y `x-forwarded-proto` son cabeceras ACUMULATIVAS: con
  // varios proxies encadenados vienen separadas por coma (`"morcast.mx,
  // interno"`), y el primer valor es el del cliente original —el que importa
  // aquí—. Antes de este `split` un `new URL()` con la cabecera cruda tal
  // cual lanzaba `TypeError: Invalid URL` y tumbaba la ruta con un 500 sin
  // mensaje: nadie podía entrar y no había nada en pantalla que explicara
  // por qué.
  const hostCrudo = request.headers.get("x-forwarded-host");
  const host = hostCrudo ? hostCrudo.split(",")[0].trim() : null;
  if (!host || !hostPermitido(host)) {
    if (host) {
      console.error("[auth] x-forwarded-host fuera de la lista blanca, ignorada:", host);
    }
    return url.origin;
  }
  // El protocolo también se pregunta: detrás del balanceador la conexión
  // interna suele ser http aunque el navegador venga por https. En producción
  // se asume https por omisión; en local manda lo que diga `url`. Sólo se
  // acepta "http" o "https" —cualquier otra cosa cae a https.
  const protocoloCrudo = request.headers.get("x-forwarded-proto");
  const protocoloPedido = protocoloCrudo ? protocoloCrudo.split(",")[0].trim() : null;
  const protocolo =
    protocoloPedido === "http" || protocoloPedido === "https"
      ? protocoloPedido
      : protocoloCrudo
        ? "https"
        : process.env.NODE_ENV === "production"
          ? "https"
          : url.protocol.replace(":", "");
  return `${protocolo}://${host}`;
}

export async function GET(request) {
  const url = new URL(request.url);
  const origen = origenReal(request, url);
  const code = url.searchParams.get("code");
  const errorDeGoogle = url.searchParams.get("error_description") || url.searchParams.get("error");

  // Al login se manda un CÓDIGO CORTO, nunca la frase: el texto lo escribe
  // `lib/errores-login.mjs`, para que un enlace armado a mano no pueda poner
  // el mensaje que quiera sobre el dominio real de la empresa.
  const aLogin = (codigo) => {
    const destino = new URL("/portal/login", origen);
    destino.searchParams.set("error", codigo);
    return NextResponse.redirect(destino);
  };

  // Google rebota así cuando la persona cancela en su pantalla de permisos.
  if (errorDeGoogle) return aLogin(ERRORES_LOGIN.googleCancelado);
  if (!code) return aLogin(ERRORES_LOGIN.faltaCodigo);

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
    return aLogin(ERRORES_LOGIN.sesionNoCanjeada);
  }

  const rol = data.user.app_metadata?.rol ?? null;

  // Sólo se consulta la solicitud si hace falta: quien ya tiene sello se va a
  // su área sin pasar por la base. Qué cuenta como "tener sello" lo decide
  // `casaDe` y NADIE MÁS: preguntar `rol ?` daba por sellado cualquier texto
  // truthy —un `"Cliente"` tecleado a mano en el tablero de Supabase—, y esa
  // persona se saltaba la consulta y acababa rebotando entre el guardia y la
  // sala de espera para siempre.
  const tieneSolicitud =
    casaDe(rol) !== DESTINOS.pendiente ? false : Boolean(await solicitudDeUsuario(data.user.id));

  return NextResponse.redirect(new URL(decidirDestino({ rol, tieneSolicitud }), origen));
}
