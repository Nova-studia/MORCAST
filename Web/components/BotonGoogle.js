"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
 * Si algo de esto falla —el guion no carga, una extensión lo bloquea, el
 * navegador no lo soporta— se avisa y **el botón de siempre sigue ahí abajo**.
 * No se apuesta la puerta de entrada a una sola tecnología.
 */
export default function BotonGoogle({ onError }) {
  const router = useRouter();
  const caja = useRef(null);
  const [entrando, setEntrando] = useState(false);
  const [listo, setListo] = useState(false);

  // El nonce se calcula UNA vez por carga y se guarda aquí: Google lo mete en
  // el token y Supabase tiene que ver exactamente el mismo par.
  const nonce = useRef(null);

  // `onError` va por referencia y NO en las dependencias del efecto. Si el
  // padre pasara una función anónima, estar en las dependencias haría que el
  // efecto se rehiciera en cada render: se recargaría el guion y el botón
  // parpadearía o se duplicaría. Hoy se le pasa `setError`, que React mantiene
  // estable, pero esto deja de depender de que quien lo use lo sepa.
  const avisar = useRef(onError);
  useEffect(() => { avisar.current = onError; }, [onError]);

  useEffect(() => {
    if (!haySupabaseNavegador()) return;
    let vivo = true;

    /** Lo que Google llama cuando la persona ya eligió su cuenta. */
    const recibirCredencial = async (respuesta) => {
      if (!vivo) return;
      setEntrando(true);
      try {
        const supabase = supabaseNavegador();
        const { data, error } = await supabase.auth.signInWithIdToken({
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

        if (!vivo) return;
        // refresh() antes de navegar: obliga al servidor a releer la cookie
        // recién escrita. Sin esto, proxy.js todavía ve "sin sesión" y rebota.
        router.refresh();
        router.replace(decidirDestino({ rol, tieneSolicitud }));
      } catch (e) {
        console.error("[google] error inesperado:", e?.message);
        avisar.current?.("No se pudo entrar con Google. Inténtalo de nuevo.");
        setEntrando(false);
      }
    };

    const arrancar = async () => {
      try {
        nonce.current = await nonceParaGoogle();
        if (!vivo || !window.google?.accounts?.id || !caja.current) return;

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

        window.google.accounts.id.renderButton(caja.current, {
          theme: "outline",
          size: "large",
          shape: "rectangular",
          text: "continue_with",
          locale: "es-419",
          width: 320,
        });
        setListo(true);
      } catch (e) {
        console.error("[google] no se pudo iniciar GIS:", e?.message);
      }
    };

    // Si el guion ya está (por ejemplo al volver a esta pantalla), no se
    // vuelve a cargar.
    if (window.google?.accounts?.id) {
      arrancar();
      return () => { vivo = false; };
    }

    const guion = document.createElement("script");
    guion.src = GIS_SRC;
    guion.async = true;
    guion.defer = true;
    guion.onload = arrancar;
    guion.onerror = () => {
      // No se avisa con un error rojo: abajo está el botón de siempre y esa
      // puerta funciona. Meter miedo aquí sería peor que quedarse callado.
      console.error("[google] no se pudo cargar", GIS_SRC);
    };
    document.head.appendChild(guion);

    return () => {
      vivo = false;
    };
  }, [router]);

  return (
    <div style={{ minHeight: listo ? undefined : 0 }}>
      {/* Aquí dentro dibuja Google su propio botón. Es suyo a propósito: así
          la pantalla que sale después es la que Google reserva a los orígenes
          que reconoce, y es justo lo que hace que diga morcast.mx. */}
      <div ref={caja} style={{ display: "flex", justifyContent: "center" }} />
      {entrando && (
        <p style={{ textAlign: "center", fontSize: "0.86rem", color: "var(--mc-gris)", marginTop: "0.6rem" }}>
          Entrando…
        </p>
      )}
    </div>
  );
}
