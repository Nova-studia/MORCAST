import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { casaDe, DESTINOS } from "@/lib/destino-sesion.mjs";
import {
  COOKIE_PASE,
  RUTA_VERIFICACION,
  mfaPanelActivo,
  necesitaVerificar,
  secretoPanel,
  sesionDelToken,
  verificarPase,
} from "@/lib/mfa.mjs";
import { seccionDeRuta, leerPermisos, puede } from "@/lib/permisos.mjs";

/**
 * GUARDIA DE RUTAS — se ejecuta en el servidor ANTES de entregar la página.
 *
 * ⚠️ El archivo se llama `proxy.js` y la función `proxy` porque Next.js 16
 * renombró lo que antes era `middleware.js`. Con el nombre viejo el archivo
 * se ignora en silencio y la protección deja de existir sin avisar.
 *
 * Antes de esto, el candado del panel era una redirección de JavaScript en
 * el navegador: se saltaba desactivando JS. Ahora la página protegida nunca
 * sale del servidor si no hay sesión.
 */

/** Páginas de estas áreas que SÍ pueden verse sin sesión. */
const ABIERTAS = [
  "/portal/login",
  "/portal/alta",
  // Recuperar contrasena: quien llega aqui, por definicion, NO puede entrar.
  // Van en ABIERTAS y no en el bloque de la sala de espera porque ahi hace
  // falta sesion, y aqui justamente no hay ninguna.
  "/portal/recuperar",
  "/portal/nueva-clave",
  // Enlace de un solo uso que abre la app (8-oct-2026): quien llega aquí
  // todavía no tiene sesión en el navegador; la página la crea.
  "/portal/entrar",
  "/admin/login",
  // Puente de la app al panel (9-oct-2026): quien llega aquí todavía no tiene
  // sesión en el navegador; la página la crea y canjea el pase de la app.
  "/admin/entrar",
  "/chofer/login",
  "/auth",
];

const esArea = (ruta, area) => ruta === area || ruta.startsWith(`${area}/`);

export async function proxy(request) {
  const ruta = request.nextUrl.pathname;

  const protegida =
    (esArea(ruta, "/admin") || esArea(ruta, "/portal") || esArea(ruta, "/chofer")) &&
    // `esArea` y no `startsWith`, por lo mismo que se explica mas abajo en el
    // bloque de la sala de espera: `startsWith` no respeta el limite de
    // segmento y dejaria pasar de colado a algo como `/portal/loginX`.
    !ABIERTAS.some((p) => esArea(ruta, p));

  if (!protegida) return NextResponse.next({ request });

  // Mientras no existan las variables de Supabase el sitio sigue en modo
  // prototipo (datos de ejemplo, nada real que proteger) y se deja pasar.
  // En cuanto se configuren, este guardia empieza a aplicar solo.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return NextResponse.next({ request });
  }

  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(porEscribir, cabeceras) {
          porEscribir.forEach(({ name, value }) => request.cookies.set(name, value));
          respuesta = NextResponse.next({ request });
          porEscribir.forEach(({ name, value, options }) =>
            respuesta.cookies.set(name, value, options)
          );
          Object.entries(cabeceras || {}).forEach(([k, v]) =>
            respuesta.headers.set(k, v)
          );
        },
      },
    }
  );

  // No meter nada entre createServerClient y getUser: es la advertencia
  // expresa de Supabase, y saltársela provoca sesiones que se caen solas.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const aLogin = (destino) => {
    const url = request.nextUrl.clone();
    url.pathname = destino;
    // Para devolverlo a donde iba después de entrar.
    url.searchParams.set("volver", ruta);
    return NextResponse.redirect(url);
  };

  const zonaAdmin = esArea(ruta, "/admin");
  const zonaChofer = esArea(ruta, "/chofer");

  if (!user) {
    return aLogin(
      zonaAdmin ? "/admin/login" : zonaChofer ? "/chofer/login" : "/portal/login"
    );
  }

  // El rol viaja dentro del token, en app_metadata, que solo se puede escribir
  // con la llave de servicio. Leerlo de aquí evita ir a la base de datos en
  // cada petición. (user_metadata NO sirve: eso lo edita el propio usuario.)
  //
  // ⚠️ Aquí había `?? "cliente"`. Eso bautizaba cliente a cualquiera que
  // llegara SIN sello —que es justo lo que produce el registro abierto con
  // Google— y el guardia lo dejaba pasar a /portal. Fallaba abierto. Ahora la
  // decisión la toma `casaDe()`, que no supone nada y está probada en
  // `tests/destino-sesion.test.mjs`.
  const rol = user.app_metadata?.rol ?? null;
  const esPersonal = rol === "dueno" || rol === "admin";

  /** A dónde pertenece cada rol. Ahí se manda a quien se equivoque de puerta. */
  const suCasa = casaDe(rol);

  const aSuCasa = () => {
    const url = request.nextUrl.clone();
    url.pathname = suCasa;
    return NextResponse.redirect(url);
  };

  // Las dos pantallas del registro son la casa de quien todavía no tiene
  // sello. Se dejan pasar AQUÍ y no en `ABIERTAS` a propósito: en ABIERTAS
  // entraría cualquiera sin sesión, y estas dos pantallas no tienen nada que
  // enseñarle a quien no ha entrado. Quien ya tiene su área se va a la suya:
  // un cliente activo no tiene por qué ver la sala de espera.
  //
  // Va con `esArea` y no con `startsWith` a propósito: `startsWith` no
  // respeta el límite de segmento y dejaría pasar de colado a algo como
  // `/portal/pendiente-falso` o `/portal/registroX`, saltándose los tres
  // rebotes de abajo.
  const salaDeEspera =
    esArea(ruta, DESTINOS.pendiente) || esArea(ruta, DESTINOS.registro);
  if (salaDeEspera) {
    return suCasa === DESTINOS.pendiente ? respuesta : aSuCasa();
  }

  // Cada quien en su área. Un cliente no entra al panel, un chofer no entra al
  // portal, y el personal no anda en el modo chofer.
  if (zonaAdmin && !esPersonal) return aSuCasa();

  // Segundo paso del panel (lib/mfa.mjs). La pantalla de verificación es la
  // única del panel que se ve con solo la contraseña.
  if (zonaAdmin && mfaPanelActivo()) {
    const enVerificacion = esArea(ruta, RUTA_VERIFICACION);
    const { data: { session } } = await supabase.auth.getSession();
    const paseValido = await verificarPase(
      request.cookies.get(COOKIE_PASE)?.value,
      { uid: user.id, sesion: sesionDelToken(session?.access_token) },
      secretoPanel()
    );
    const falta = necesitaVerificar({ rol, paseValido });
    if (falta && !enVerificacion) {
      const url = request.nextUrl.clone();
      url.pathname = RUTA_VERIFICACION;
      url.search = "";
      url.searchParams.set("volver", ruta);
      return NextResponse.redirect(url);
    }
    if (!falta && enVerificacion) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }
  // Roles personalizados (db/029): un admin solo abre las secciones de su rol.
  // Se consulta la base SOLO en páginas que tienen sección (el Panel, Mi
  // cuenta y la verificación son de todo el personal). Quien decide de verdad
  // sigue siendo la base y cada acción; esto evita pantallas que no sirven.
  if (zonaAdmin && rol === "admin") {
    const seccion = seccionDeRuta(ruta);
    if (seccion) {
      const { permisos } = await leerPermisos(supabase, user.id);
      if (!puede({ rol, permisos }, seccion)) {
        const url = request.nextUrl.clone();
        url.pathname = "/admin";
        url.search = "";
        url.searchParams.set("sin_permiso", seccion);
        return NextResponse.redirect(url);
      }
    }
  }
  if (zonaChofer && rol !== "operador") return aSuCasa();
  if (esArea(ruta, "/portal") && rol !== "cliente") return aSuCasa();

  // Devolver ESTE objeto tal cual. Si se arma otra respuesta sin copiarle las
  // cookies, el navegador y el servidor se desincronizan y la sesión se cae.
  return respuesta;
}

export const config = {
  matcher: ["/admin/:path*", "/portal/:path*", "/chofer/:path*"],
};
