"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import CampoContrasena from "@/components/CampoContrasena";
import { supabaseNavegador, haySupabaseNavegador } from "@/lib/supabase-navegador";

/**
 * CREAR LA CONTRASEÑA NUEVA — a donde lleva el enlace del correo.
 *
 * El enlace trae `?token=`, que es el `hashed_token` que generó
 * `admin.generateLink`. Se canjea con `verifyOtp`, y eso crea una sesión de
 * recuperación con la que ya se puede llamar a `updateUser`.
 *
 * Se usa `verifyOtp` y no el flujo con código a propósito: aquí el enlace lo
 * armamos nosotros (para que apunte a esta pantalla y el correo salga por
 * Resend), así que no hay verificador de PKCE que casar. Menos piezas, menos
 * formas de fallar.
 *
 * ⚠️ El token se canjea UNA sola vez. Por eso, si alguien recarga esta página
 * después de canjearlo, no se vuelve a intentar: ya hay sesión y el formulario
 * sigue sirviendo.
 */
export default function NuevaClavePortal() {
  const router = useRouter();
  const [estado, setEstado] = useState("comprobando"); // comprobando | listo | invalido
  const [clave, setClave] = useState("");
  const [repetida, setRepetida] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vivo = true;
    if (!haySupabaseNavegador()) {
      setEstado("invalido");
      return;
    }

    const canjear = async () => {
      const supabase = supabaseNavegador();
      const token = new URLSearchParams(window.location.search).get("token");

      // Si ya hay sesión (por ejemplo tras recargar), no se vuelve a canjear:
      // el token es de un solo uso y el segundo intento fallaría.
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        if (vivo) setEstado("listo");
        return;
      }

      if (!token) {
        if (vivo) setEstado("invalido");
        return;
      }

      const { error: err } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: "recovery",
      });

      if (!vivo) return;
      if (err) {
        console.error("[nueva-clave] el enlace no sirve:", err.message);
        setEstado("invalido");
        return;
      }
      // La dirección se limpia para que el token no se quede en el historial
      // ni se lo lleve nadie al copiar la URL.
      window.history.replaceState(null, "", "/portal/nueva-clave");
      setEstado("listo");
    };

    canjear();
    return () => {
      vivo = false;
    };
  }, []);

  const guardar = async (e) => {
    e.preventDefault();
    setError("");

    if (clave.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (clave !== repetida) {
      setError("Las dos contraseñas no son iguales.");
      return;
    }

    setGuardando(true);
    const { error: err } = await supabaseNavegador().auth.updateUser({ password: clave });
    if (err) {
      console.error("[nueva-clave] no se pudo guardar:", err.message);
      setError("No se pudo guardar la contraseña. Pide el enlace otra vez.");
      setGuardando(false);
      return;
    }

    // Ya con la contraseña puesta, se manda al portal. El guardia decide a
    // dónde va según su rol; si no tuviera sello, acabará en la sala de espera.
    router.refresh();
    router.replace("/portal");
  };

  const Marco = ({ children }) => (
    <div className="pt-login">
      <div className="pt-login-form-lado" style={{ gridColumn: "1 / -1" }}>
        <div className="pt-login-card">
          <Link href="/" className="pt-login-marca" aria-label="Ir a la página de Morcast del Norte">
            <Image
              src="/img/logo-h.png"
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

  if (estado === "comprobando") {
    return (
      <div className="pt-login">
        <div className="pt-cargando">Comprobando el enlace…</div>
      </div>
    );
  }

  if (estado === "invalido") {
    return (
      <Marco>
        <h1>Este enlace ya no sirve</h1>
        <p>
          Los enlaces para crear contraseña <strong>vencen en una hora</strong> y
          sólo se pueden usar una vez. Pide uno nuevo y úsalo en cuanto te llegue.
        </p>
        <Link
          href="/portal/recuperar"
          className="pt-btn pt-btn-verde"
          style={{ width: "100%", justifyContent: "center", padding: "0.8rem", fontSize: "0.95rem" }}
        >
          Pedir un enlace nuevo <ArrowRight />
        </Link>
        <p style={{ textAlign: "center", fontSize: "0.85rem", color: "var(--mc-gris)", marginTop: "1.1rem" }}>
          <Link href="/portal/login" style={{ color: "var(--mc-verde-claro)", fontWeight: 600 }}>
            Volver a iniciar sesión
          </Link>
        </p>
      </Marco>
    );
  }

  return (
    <Marco>
      <h1>Crea tu contraseña</h1>
      <p>Escríbela dos veces para asegurarnos de que no hay ninguna errata.</p>

      {error && (
        <div className="pt-login-error" role="alert">
          <WarningCircle style={{ marginRight: 6, verticalAlign: "-2px" }} />
          {error}
        </div>
      )}

      <form onSubmit={guardar}>
        <CampoContrasena
          id="clave"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
        />
        <div className="pt-campo">
          <label htmlFor="repetida">Repite la contraseña</label>
          <input
            id="repetida"
            type="password"
            autoComplete="new-password"
            value={repetida}
            onChange={(e) => setRepetida(e.target.value)}
            required
          />
        </div>
        <button
          type="submit"
          className="pt-btn pt-btn-verde"
          style={{ width: "100%", justifyContent: "center", padding: "0.8rem", fontSize: "0.95rem" }}
          disabled={guardando}
        >
          {guardando ? "Guardando…" : <>Guardar y entrar <ArrowRight /></>}
        </button>
      </form>

      <p style={{ fontSize: "0.85rem", color: "var(--mc-gris)", marginTop: "1.1rem" }}>
        Con esta contraseña también puedes entrar desde la app de Morcast en tu
        teléfono.
      </p>
    </Marco>
  );
}
