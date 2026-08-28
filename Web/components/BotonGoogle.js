"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { supabaseNavegador, haySupabaseNavegador } from "@/lib/supabase-navegador";
import { decidirDestino, casaDe, DESTINOS } from "@/lib/destino-sesion.mjs";
import { nonceParaGoogle } from "@/lib/nonce-google.mjs";
import { GOOGLE_CLIENT_ID, GIS_SRC } from "@/lib/google-datos.mjs";
import { miSolicitud } from "@/app/acciones-registro";

/**
 * ENTRAR CON GOOGLE SIN SALIR DE MORCAST.MX.
 *
 * Por qué existe, que es todo el punto
 * ------------------------------------
 * Con el camino de siempre (`signInWithOAuth`) el navegador va a Google,
 * Google devuelve a **Supabase**, y Supabase devuelve aquí. Como Google enseña
 * el dominio al que ENTREGA al usuario, la pantalla de permisos decía
 * "Accede a mbdmulygpupahocpylze.supabase.co", que no le dice nada a un
 * cliente y da desconfianza justo en el momento de aceptar.
 *
 * Con Google Identity Services no hay ese salto: Google entrega el token
 * AQUÍ, y la pantalla se ancla al origen de esta página. Enseña morcast.mx.
 * Después el token se le pasa a Supabase, que comprueba la firma contra las
 * llaves públicas de Google y emite la sesión igual que siempre.
 *
 * Lo que NO cambia
 * ----------------
 * La sesión sigue yendo a cookies (la escribe `@supabase/ssr`), así que
 * `proxy.js` la lee igual y todas las reglas de acceso siguen valiendo. Y a
 * dónde va cada quien lo decide `decidirDestino()`, la misma función probada
 * que usa el guardia: la regla no se duplica, sólo cambia quién la invoca.
 *
 * El respaldo
 * -----------
 * Si el guion no carga —una extensión que lo bloquea, un navegador viejo, la
 * red— este botón no aparece y **el de siempre sigue ahí abajo**. No se
 * apuesta la puerta de entrada a una sola tecnología.
 *
 * Por qué `next/script` y no un <script> a mano
 * ---------------------------------------------
 * Lo pide la documentación de esta versión de Next, y resuelve dos cosas por
 * su cuenta: garantiza que el guion se descargue UNA sola vez aunque se
 * navegue de una pantalla a otra, y `onReady` dispara tanto la primera vez
 * como en cada montaje posterior — que es justo lo que hace falta para volver
 * a dibujar el botón al regresar al login.
 */
export default function BotonGoogle({ onError }) {
  const router = useRouter();
  const caja = useRef(null);
  const [entrando, setEntrando] = useState(false);

  // El nonce se calcula una vez por montaje: Google lo mete dentro del token y
  // Supabase tiene que ver exactamente el mismo par.
  const nonce = useRef(null);

  // `onError` va por referencia. Si el padre pasara una función anónima y ésta
  // estuviera en las dependencias, el efecto se reharía en cada render.
  const avisar = useRef(onError);
  useEffect(() => {
    avisar.current = onError;
  }, [onError]);

  /** Lo que Google llama cuando la persona ya eligió su cuenta. */
  const recibirCredencial = useCallback(
    async (respuesta) => {
      setEntrando(true);
      try {
        const { data, error } = await supabaseNavegador().auth.signInWithIdToken({
          provider: "google",
          token: respuesta.credential,
          nonce: nonce.current?.paraSupabase,
        });

        if (error || !data?.user) {
          console.error("[google] no se pudo canjear el token:", error?.message);
          avisar.current?.("No se pudo entrar con Google. Inténtalo de nuevo.");
          setEntrando(false);
          return;
        }

        const rol = data.user.app_metadata?.rol ?? null;
        // Sólo se pregunta por la solicitud si hace falta: quien ya tiene sello
        // se va a su área sin tocar la base. Mismo criterio que el callback.
        const tieneSolicitud =
          casaDe(rol) !== DESTINOS.pendiente ? false : Boolean(await miSolicitud());

        // refresh() antes de navegar: obliga al servidor a releer la cookie
        // recién escrita. Sin esto, proxy.js todavía ve "sin sesión" y rebota.
        router.refresh();
        router.replace(decidirDestino({ rol, tieneSolicitud }));
      } catch (e) {
        console.error("[google] error inesperado:", e?.message);
        avisar.current?.("No se pudo entrar con Google. Inténtalo de nuevo.");
        setEntrando(false);
      }
    },
    [router]
  );

  /** Se ejecuta cuando el guion está listo, y también en cada montaje. */
  const dibujar = useCallback(async () => {
    if (!haySupabaseNavegador()) return;
    try {
      nonce.current = await nonceParaGoogle();
      if (!window.google?.accounts?.id || !caja.current) return;

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: recibirCredencial,
        nonce: nonce.current.paraGoogle,
        // El botón dibujado, NO el "One Tap" automático: One Tap lo bloquean
        // bastantes extensiones y su migración a FedCM sigue moviéndose. Un
        // botón que la persona pulsa es aburrido y funciona en todas partes.
        use_fedcm_for_prompt: false,
        auto_select: false,
      });

      // Se vacía antes por si `onReady` vuelve a correr al regresar a esta
      // pantalla: si no, Google dibujaría un segundo botón debajo del primero.
      caja.current.innerHTML = "";
      window.google.accounts.id.renderButton(caja.current, {
        theme: "outline",
        size: "large",
        shape: "rectangular",
        text: "continue_with",
        locale: "es-419",
        width: 320,
      });
    } catch (e) {
      console.error("[google] no se pudo iniciar GIS:", e?.message);
    }
  }, [recibirCredencial]);

  // Sin Supabase configurado (modo demostración) no se carga nada de Google:
  // no habría con qué canjear el token.
  if (!haySupabaseNavegador()) return null;

  return (
    <>
      <Script
        src={GIS_SRC}
        strategy="afterInteractive"
        onReady={dibujar}
        onError={() => {
          // No se pinta un error rojo: abajo está el botón de siempre y esa
          // puerta funciona. Meter miedo aquí sería peor que callarse.
          console.error("[google] no se pudo cargar", GIS_SRC);
        }}
      />
      {/* Aquí dentro dibuja Google su propio botón. Es suyo a propósito: así
          la pantalla que sale después es la que Google reserva a los orígenes
          que reconoce, y es justo lo que hace que diga morcast.mx. */}
      <div ref={caja} style={{ display: "flex", justifyContent: "center" }} />
      {entrando && (
        <p style={{ textAlign: "center", fontSize: "0.86rem", color: "var(--mc-gris)", marginTop: "0.6rem" }}>
          Entrando…
        </p>
      )}
    </>
  );
}
