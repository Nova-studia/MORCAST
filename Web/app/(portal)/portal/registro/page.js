"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { supabaseNavegador, haySupabaseNavegador } from "@/lib/supabase-navegador";
import { registrarConGoogle } from "@/app/acciones-registro";

/**
 * CAPTURA MÍNIMA después de entrar con Google.
 *
 * Google entrega nombre y correo, nada más. Sin empresa y sin teléfono
 * Morcast no puede ni identificar quién tocó la puerta ni contactarlo por
 * WhatsApp, que es como trabaja. Son los dos únicos campos a propósito: todo
 * lo demás (domicilio, residuos, RFC) se levanta al contactarlo.
 *
 * Va FUERA del shell protegido: quien llega aquí tiene sesión pero no tiene
 * sello, y el shell exige el sello.
 */
export default function RegistroPortal() {
  const router = useRouter();
  const [quien, setQuien] = useState(null);
  const [empresa, setEmpresa] = useState("");
  const [telefono, setTelefono] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let vivo = true;
    if (!haySupabaseNavegador()) {
      setQuien({ nombre: "Modo demostración", correo: "demo@morcast.mx" });
      return;
    }
    supabaseNavegador().auth.getUser().then(({ data: { user } }) => {
      if (!vivo) return;
      if (!user) {
        router.replace("/portal/login");
        return;
      }
      setQuien({
        nombre: user.user_metadata?.full_name || user.user_metadata?.name || "",
        correo: user.email || "",
      });
    });
    return () => {
      vivo = false;
    };
  }, [router]);

  const enviar = async (e) => {
    e.preventDefault();
    setError("");
    setEnviando(true);
    const r = await registrarConGoogle({ empresa, telefono });
    if (!r.ok) {
      setError(r.motivo);
      setEnviando(false);
      return;
    }
    // refresh() antes de navegar: obliga al servidor a releer la sesión.
    router.refresh();
    router.replace("/portal/pendiente");
  };

  if (!quien) {
    return (
      <div className="pt-login">
        <div className="pt-cargando">Cargando…</div>
      </div>
    );
  }

  return (
    <div className="pt-login">
      <div className="pt-login-form-lado" style={{ margin: "0 auto" }}>
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

          <h1>Un paso más</h1>
          <p>
            Ya te identificamos como <strong>{quien.correo}</strong>. Sólo nos faltan dos
            datos para poder contactarte.
          </p>

          {error && (
            <div className="pt-login-error" role="alert">
              <WarningCircle style={{ marginRight: 6, verticalAlign: "-2px" }} />
              {error}
            </div>
          )}

          <form onSubmit={enviar}>
            <div className="pt-campo">
              <label htmlFor="empresa">Nombre de tu empresa</label>
              <input
                id="empresa"
                type="text"
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                placeholder="Industrias del Golfo, S.A. de C.V."
                maxLength={120}
                required
                autoFocus
              />
            </div>

            <div className="pt-campo">
              <label htmlFor="telefono">Teléfono o WhatsApp</label>
              <input
                id="telefono"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="868 384 9478"
                maxLength={30}
                required
              />
            </div>

            <button
              type="submit"
              className="pt-btn pt-btn-verde"
              style={{ width: "100%", justifyContent: "center", padding: "0.8rem", fontSize: "0.95rem" }}
              disabled={enviando}
            >
              {enviando ? "Enviando…" : <>Enviar mi registro <ArrowRight /></>}
            </button>
          </form>

          <p style={{ textAlign: "center", fontSize: "0.85rem", color: "var(--mc-gris)", marginTop: "1.1rem" }}>
            Registrarte no te da acceso todavía. Morcast revisa tus datos y activa tu cuenta.
          </p>
        </div>
      </div>
    </div>
  );
}
