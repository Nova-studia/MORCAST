"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabaseNavegador, haySupabaseNavegador } from "@/lib/supabase-navegador";
import { destinoPuente } from "@/lib/puente-web.mjs";

/**
 * ENTRAR DESDE LA APP (8-oct-2026, Apple guía 4).
 *
 * La app abre esta página con `?th=` (el `hashed_token` de un enlace de un
 * solo uso que pidió a /api/app/puente-web para SU correo) y `?a=` (a dónde
 * va después). Se canjea con `verifyOtp`, igual que /portal/nueva-clave, y la
 * persona queda dentro de morcast.mx con la MISMA cuenta de la app: termina
 * su alta sin volver a escribir nombre, correo ni contraseña.
 *
 * ⚠️ El token sirve una sola vez. Recargar después lleva a "ya no sirve", y
 * está bien: se pide otro desde la app.
 */

function Marco({ children }) {
  return (
    <div className="pt-login">
      <div className="pt-login-form-lado" style={{ gridColumn: "1 / -1" }}>
        <div className="pt-login-card">
          <Link href="/" className="pt-login-marca" aria-label="Ir a la página de Morcast del Norte">
            <Image
              src="/img/logo-h-blanco.png"
              alt="Morcast del Norte"
              width={688}
              height={200}
              style={{ width: "auto", height: 48 }}
              priority
            />
          </Link>
          {children}
        </div>
      </div>
    </div>
  );
}

export default function EntrarDesdeLaApp() {
  const [estado, setEstado] = useState("abriendo"); // abriendo | invalido

  useEffect(() => {
    let vivo = true;
    if (!haySupabaseNavegador()) {
      setEstado("invalido");
      return undefined;
    }

    (async () => {
      const params = new URLSearchParams(window.location.search);
      const th = params.get("th");
      const destino = destinoPuente(params.get("a"));
      if (!th) {
        if (vivo) setEstado("invalido");
        return;
      }
      const supabase = supabaseNavegador();
      // Si en este navegador había otra cuenta abierta, se cierra primero:
      // el enlace es de quien viene de la app, no de quien estaba aquí.
      const { data: { session: previa } } = await supabase.auth.getSession();
      if (previa) await supabase.auth.signOut();

      const { error } = await supabase.auth.verifyOtp({ token_hash: th, type: "magiclink" });
      if (!vivo) return;
      if (error) {
        console.error("[entrar] el enlace no sirve:", error.message);
        setEstado("invalido");
        return;
      }
      // Navegación completa (no router.push): así proxy.js ve la cookie nueva
      // y a una cuenta sin alta la deja en su registro.
      window.location.replace(destino === "portal" ? "/portal" : "/portal/registro");
    })();

    return () => { vivo = false; };
  }, []);

  if (estado === "invalido") {
    return (
      <Marco>
        <h1>Este enlace ya no sirve</h1>
        <p>
          Vuelve a la app y toca <strong>“Completar mi alta”</strong> otra vez:
          cada enlace sirve una sola vez y por poco tiempo.
        </p>
      </Marco>
    );
  }

  return (
    <Marco>
      <h1>Abriendo tu cuenta…</h1>
      <p>Un momento, estamos entrando con la misma cuenta de la app.</p>
    </Marco>
  );
}
