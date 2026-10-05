"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, EnvelopeSimple } from "@phosphor-icons/react/dist/ssr";
import { supabaseNavegador, haySupabaseNavegador } from "@/lib/supabase-navegador";
import { mandarCodigoPanel, verificarCodigoPanel } from "@/app/acciones-segundo-paso";

/**
 * SEGUNDO PASO DEL PANEL: el código que llega por correo (ver lib/mfa.mjs).
 *
 * Al abrir la pantalla se manda el código solo; si la persona recarga, el
 * servidor no manda otro hasta que pase un minuto. proxy.js manda aquí a
 * todo dueño/admin sin pase, y saca de aquí a quien ya lo tiene.
 */

/** Solo se regresa a una página del panel: nunca a una dirección de afuera. */
function destinoSeguro(volver) {
  const v = String(volver || "");
  return v.startsWith("/admin") && !v.startsWith("//") && !v.includes("://") ? v : "/admin";
}

function VerificacionAdmin() {
  const router = useRouter();
  const params = useSearchParams();
  const [correo, setCorreo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mandando, setMandando] = useState(true);
  const [espera, setEspera] = useState(0);
  // En desarrollo React corre los efectos dos veces: sin esto se pedirían
  // dos correos al abrir la pantalla.
  const yaPedido = useRef(false);

  const pedirCodigo = async () => {
    setError("");
    setAviso("");
    setMandando(true);
    const r = await mandarCodigoPanel();
    setMandando(false);
    if (!r.ok) {
      setError(r.motivo);
      return;
    }
    setCorreo(r.correo);
    setEspera(r.espera || 0);
    setAviso(r.yaEnviado ? "Ya te mandamos un código hace un momento: revisa tu correo." : "");
  };

  useEffect(() => {
    if (!haySupabaseNavegador()) {
      router.replace("/admin");
      return;
    }
    if (yaPedido.current) return;
    yaPedido.current = true;
    pedirCodigo();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se pide UNA vez al abrir
  }, []);

  // Cuenta regresiva para poder reenviar.
  useEffect(() => {
    if (espera <= 0) return undefined;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  const confirmar = async (e) => {
    e.preventDefault();
    setError("");
    setAviso("");
    setEnviando(true);
    const r = await verificarCodigoPanel(codigo);
    if (!r.ok) {
      setError(r.motivo);
      setEnviando(false);
      return;
    }
    // Igual que en el login: refresh() obliga al servidor a leer el pase
    // recién guardado antes de navegar.
    router.refresh();
    router.replace(destinoSeguro(params.get("volver")));
  };

  const salir = async () => {
    await supabaseNavegador().auth.signOut();
    router.replace("/admin/login");
  };

  return (
    <div className="pt-login">
      <div className="pt-login-lado pt-login-lado-admin">
        <Link href="/" className="pt-login-marca" aria-label="Ir a la página de Morcast del Norte">
          <Image
            src="/img/logo-h-blanco.png"
            alt="Morcast del Norte"
            width={688}
            height={200}
            style={{ width: "auto" }}
            priority
          />
        </Link>
        <div className="pt-login-lema">
          <span className="pt-admin-chip">Administración</span>
          <h2>Verificación en dos pasos</h2>
          <p>
            Además de tu contraseña, el panel pide un código que llega a tu
            correo. Así, aunque alguien conozca tu contraseña, no puede entrar.
          </p>
        </div>
        <div style={{ position: "relative", zIndex: 1, fontSize: "0.82rem", color: "rgba(255,255,255,0.6)" }}>
          © {new Date().getFullYear()} Morcast del Norte, S.A. de C.V.
        </div>
      </div>

      <div className="pt-login-form-lado">
        <div className="pt-login-card">
          <h1>Revisa tu correo</h1>
          {mandando ? (
            <p>Mandando tu código…</p>
          ) : correo ? (
            <p style={{ display: "flex", gap: "0.45rem", alignItems: "flex-start" }}>
              <EnvelopeSimple aria-hidden="true" style={{ flexShrink: 0, marginTop: "0.2rem" }} />
              <span>Te mandamos un código de 6 dígitos a <strong>{correo}</strong>. Vence en 10 minutos.</span>
            </p>
          ) : (
            <p>No pudimos mandarte el código.</p>
          )}

          {aviso && <p style={{ fontSize: "0.9rem" }}>{aviso}</p>}
          {error && <div className="pt-login-error">{error}</div>}

          <form onSubmit={confirmar}>
            <div className="pt-campo">
              <label htmlFor="codigo">Código de 6 dígitos</label>
              <input
                id="codigo"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]*"
                maxLength={7}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="123 456"
                autoFocus
                required
              />
            </div>
            <button
              type="submit"
              className="pt-btn pt-btn-naranja"
              style={{ width: "100%", justifyContent: "center", padding: "0.8rem", fontSize: "0.95rem" }}
              disabled={enviando || mandando}
            >
              {enviando ? "Verificando…" : <>Entrar al panel <ArrowRight /></>}
            </button>
          </form>

          <p style={{ marginTop: "1.2rem", fontSize: "0.85rem" }}>
            ¿No te llegó? Revisa la carpeta de spam o{" "}
            {espera > 0 ? (
              <span>pide otro en {espera} s.</span>
            ) : (
              <button
                type="button"
                onClick={pedirCodigo}
                disabled={mandando}
                style={{ background: "none", border: 0, padding: 0, color: "inherit", textDecoration: "underline", cursor: "pointer", font: "inherit" }}
              >
                manda otro código
              </button>
            )}
            {espera > 0 ? "" : "."}
          </p>
          <button type="button" className="pt-btn" onClick={salir} style={{ marginTop: "0.4rem" }}>
            Salir
          </button>
        </div>
      </div>
    </div>
  );
}

// useSearchParams() necesita un Suspense alrededor o la compilación falla
// al pre-renderizar la página.
export default function PaginaVerificacion() {
  return (
    <Suspense fallback={null}>
      <VerificacionAdmin />
    </Suspense>
  );
}
