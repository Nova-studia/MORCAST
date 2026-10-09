"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabaseNavegador, haySupabaseNavegador } from "@/lib/supabase-navegador";
import { canjearPuenteAdmin } from "@/app/acciones-puente";

/**
 * ABRIR EL PANEL WEB DESDE LA APP (9-oct-2026, "apps al 100%").
 *
 * La app pidió `/api/app/accion/puente-admin` y abre aquí con:
 *   · th  el enlace mágico (un solo uso) para crear la sesión en el navegador;
 *   · pp  el pase de un solo uso (2 min) para no pedir otro código por correo;
 *   · a   la pantalla del panel a la que va (lista cerrada).
 * Sin `th` o `pp` válidos no entra a nada: se queda en "este enlace ya no sirve".
 */
function Marco({ children }) {
  return (
    <div className="pt-login">
      <div className="pt-login-form-lado" style={{ gridColumn: "1 / -1" }}>
        <div className="pt-login-card">
          <Link href="/" className="pt-login-marca" aria-label="Ir a la página de Morcast del Norte">
            <Image src="/img/logo-h-blanco.png" alt="Morcast del Norte" width={688} height={200} style={{ width: "auto", height: 48 }} priority />
          </Link>
          {children}
        </div>
      </div>
    </div>
  );
}

export default function EntrarPanelDesdeLaApp() {
  const [estado, setEstado] = useState("abriendo"); // abriendo | invalido
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    let vivo = true;
    if (!haySupabaseNavegador()) {
      setEstado("invalido");
      return undefined;
    }
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const th = params.get("th");
      const pp = params.get("pp");
      const destino = params.get("a") || "/admin";
      if (!th || !pp) {
        if (vivo) setEstado("invalido");
        return;
      }
      const supabase = supabaseNavegador();
      const { data: { session: previa } } = await supabase.auth.getSession();
      if (previa) await supabase.auth.signOut({ scope: "local" });
      const { error } = await supabase.auth.verifyOtp({ token_hash: th, type: "magiclink" });
      if (!vivo) return;
      if (error) {
        setEstado("invalido");
        return;
      }
      const r = await canjearPuenteAdmin({ pp, destino });
      if (!vivo) return;
      if (!r.ok) {
        setMotivo(r.motivo || "");
        setEstado("invalido");
        return;
      }
      // Navegación completa: proxy.js ya ve la cookie del pase.
      window.location.replace(r.destino);
    })();
    return () => { vivo = false; };
  }, []);

  if (estado === "invalido") {
    return (
      <Marco>
        <h1>Este enlace ya no sirve</h1>
        <p>{motivo || "Vuelve a la app y toca otra vez «Abrir en la web»: cada enlace sirve una sola vez y por poco tiempo."}</p>
      </Marco>
    );
  }
  return (
    <Marco>
      <h1>Abriendo el panel…</h1>
      <p>Un momento, estamos entrando con la misma cuenta de la app.</p>
    </Marco>
  );
}
