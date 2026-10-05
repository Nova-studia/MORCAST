"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { supabaseNavegador, haySupabaseNavegador } from "@/lib/supabase-navegador";

/**
 * SEGUNDO PASO DEL PANEL (ver lib/mfa.mjs).
 *
 * Dos caminos, según la persona ya tenga o no su app de códigos:
 *   · Primera vez: se le muestra un QR para darlo de alta en Google
 *     Authenticator (o Authy, Microsoft Authenticator…) y se confirma con el
 *     primer código. A partir de ahí, cada entrada pide el código.
 *   · Las demás veces: solo el código de 6 dígitos.
 *
 * proxy.js manda aquí a todo dueño/admin cuya sesión sea de solo contraseña,
 * y saca de aquí a quien ya verificó.
 */

/** Solo se regresa a una página del panel: nunca a una dirección de afuera. */
function destinoSeguro(volver) {
  const v = String(volver || "");
  return v.startsWith("/admin") && !v.startsWith("//") && !v.includes("://") ? v : "/admin";
}

function VerificacionAdmin() {
  const router = useRouter();
  const params = useSearchParams();
  const [fase, setFase] = useState("cargando"); // cargando · alta · codigo
  const [factorId, setFactorId] = useState(null);
  const [qr, setQr] = useState("");
  const [secreto, setSecreto] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let vivo = true;
    // Modo prototipo (sin Supabase): no hay segundo paso que hacer.
    if (!haySupabaseNavegador()) {
      router.replace("/admin");
      return undefined;
    }
    (async () => {
      const supabase = supabaseNavegador();
      const { data, error: e } = await supabase.auth.mfa.listFactors();
      if (!vivo) return;
      if (e) {
        setError("No se pudo revisar tu cuenta. Vuelve a entrar.");
        setFase("codigo");
        return;
      }
      const verificado = data?.totp?.[0];
      if (verificado) {
        setFactorId(verificado.id);
        setFase("codigo");
        return;
      }
      // Un alta que se quedó a medias (cerraron la pestaña antes de poner el
      // código) estorba a la nueva: Supabase no deja dos con el mismo nombre.
      for (const f of data?.all || []) {
        if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data: alta, error: eAlta } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Panel Morcast",
        issuer: "Morcast del Norte",
      });
      if (!vivo) return;
      if (eAlta || !alta) {
        setError("No se pudo preparar la verificación en dos pasos. Avísale a soporte.");
        setFase("alta");
        return;
      }
      setFactorId(alta.id);
      setQr(alta.totp.qr_code);
      setSecreto(alta.totp.secret);
      setFase("alta");
    })();
    return () => {
      vivo = false;
    };
  }, [router]);

  const confirmar = async (e) => {
    e.preventDefault();
    setError("");
    const limpio = codigo.replace(/\D/g, "");
    if (limpio.length !== 6) {
      setError("El código tiene 6 dígitos.");
      return;
    }
    setEnviando(true);
    const { error: e2 } = await supabaseNavegador().auth.mfa.challengeAndVerify({
      factorId,
      code: limpio,
    });
    if (e2) {
      setError("Ese código no es válido o ya caducó. Escribe el que se ve ahora en tu app.");
      setEnviando(false);
      return;
    }
    // Igual que en el login: refresh() obliga al servidor a leer la sesión
    // nueva (ya con el segundo paso) antes de navegar.
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
            Además de tu contraseña, el panel pide un código de tu teléfono.
            Así, aunque alguien conozca tu contraseña, no puede entrar.
          </p>
        </div>
        <div style={{ position: "relative", zIndex: 1, fontSize: "0.82rem", color: "rgba(255,255,255,0.6)" }}>
          © {new Date().getFullYear()} Morcast del Norte, S.A. de C.V.
        </div>
      </div>

      <div className="pt-login-form-lado">
        <div className="pt-login-card">
          {fase === "cargando" && <p>Preparando la verificación…</p>}

          {fase === "alta" && (
            <>
              <h1>Activa tu segundo paso</h1>
              <p>Solo se hace una vez. Necesitas una app de códigos en tu teléfono.</p>
              <ol style={{ paddingLeft: "1.2rem", marginBottom: "1.2rem", lineHeight: 1.6 }}>
                <li>Instala <strong>Google Authenticator</strong> (o Authy, o Microsoft Authenticator).</li>
                <li>En la app, toca <strong>+</strong> y escanea este código.</li>
                <li>Escribe abajo los 6 dígitos que te muestra.</li>
              </ol>
              {qr && (
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "0.8rem" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- es un data: URL que genera Supabase */}
                  <img
                    src={qr}
                    alt="Código QR para dar de alta el panel en tu app de códigos"
                    width={180}
                    height={180}
                    style={{ background: "#fff", padding: 8, borderRadius: 8 }}
                  />
                </div>
              )}
              {secreto && (
                <p style={{ fontSize: "0.85rem", wordBreak: "break-all", marginBottom: "1.2rem" }}>
                  ¿No puedes escanear? Escribe esta clave en la app:{" "}
                  <code style={{ userSelect: "all", color: "inherit", fontWeight: 600 }}>{secreto}</code>
                </p>
              )}
            </>
          )}

          {fase === "codigo" && (
            <>
              <h1>Escribe tu código</h1>
              <p>Abre tu app de códigos y escribe los 6 dígitos de «Morcast del Norte».</p>
            </>
          )}

          {error && <div className="pt-login-error">{error}</div>}

          {fase !== "cargando" && factorId && (
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
                disabled={enviando}
              >
                {enviando ? "Verificando…" : <>{fase === "alta" ? "Activar y entrar" : "Entrar al panel"} <ArrowRight /></>}
              </button>
            </form>
          )}

          <p style={{ marginTop: "1.2rem", fontSize: "0.85rem", display: "flex", gap: "0.4rem", alignItems: "center" }}>
            <ShieldCheck aria-hidden="true" />
            ¿Perdiste tu teléfono? Pide a soporte que reinicie tu verificación.
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
