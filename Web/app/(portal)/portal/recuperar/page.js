"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CheckCircle, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { pedirRecuperacion } from "@/app/acciones-recuperar";

/**
 * "OLVIDÉ MI CONTRASEÑA" — pantalla pública.
 *
 * Contesta SIEMPRE lo mismo, tenga cuenta ese correo o no. Si dijera "ese
 * correo no existe", cualquiera podría averiguar quiénes son los clientes de
 * Morcast probando direcciones, que es justo lo que no queremos regalar.
 *
 * Va fuera del marco protegido del portal: quien llega aquí, por definición,
 * no puede entrar.
 */
export default function RecuperarPortal() {
  const [correo, setCorreo] = useState("");
  const [error, setError] = useState("");
  const [acuse, setAcuse] = useState("");
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setError("");
    setAcuse("");
    setEnviando(true);
    // try/finally: si la acción LANZA (red caída, tiempo agotado), sin esto
    // `setEnviando(false)` no corre nunca y el botón se queda en "Enviando…"
    // deshabilitado para siempre, sin decir nada. La única salida sería
    // recargar la página.
    try {
      const r = await pedirRecuperacion(correo);
      if (!r.ok) {
        setError(r.motivo);
        return;
      }
      setAcuse(r.mensaje);
    } catch (e) {
      console.error("[recuperar] la acción falló:", e?.message);
      setError("No se pudo procesar tu solicitud. Inténtalo en un momento.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="pt-login">
      <div
        className="pt-login-form-lado"
        /* `.pt-login` es una rejilla de DOS columnas (portal.css:592) y esta
           pantalla monta un solo hijo: sin esto la tarjeta se queda en la
           mitad izquierda con la derecha en blanco. */
        style={{ gridColumn: "1 / -1" }}
      >
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

          <h1>¿Olvidaste tu contraseña?</h1>
          <p>
            Escribe el correo de tu cuenta y te mandamos un enlace para crear una
            nueva.
          </p>

          {error && (
            <div className="pt-login-error" role="alert">
              <WarningCircle style={{ marginRight: 6, verticalAlign: "-2px" }} />
              {error}
            </div>
          )}

          {acuse ? (
            /* Al acusar recibo se retira el formulario: dejarlo invita a
               pulsar otra vez, y la segunda vez chocaría con el enfriamiento
               y parecería que algo falló. */
            <div style={{ margin: "1.2rem 0" }}>
              <p style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start", fontSize: "0.95rem" }}>
                <CheckCircle
                  weight="fill"
                  style={{ color: "var(--mc-verde-claro)", flexShrink: 0, marginTop: 2 }}
                />
                <span>{acuse}</span>
              </p>
            </div>
          ) : (
            <form onSubmit={enviar}>
              <div className="pt-campo">
                <label htmlFor="correo">Correo electrónico</label>
                <input
                  id="correo"
                  type="email"
                  autoComplete="username"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  placeholder="tu@empresa.com"
                  maxLength={160}
                  required
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="pt-btn pt-btn-verde"
                style={{ width: "100%", justifyContent: "center", padding: "0.8rem", fontSize: "0.95rem" }}
                disabled={enviando}
              >
                {enviando ? "Enviando…" : <>Mandarme el enlace <ArrowRight /></>}
              </button>
            </form>
          )}

          <p style={{ textAlign: "center", fontSize: "0.85rem", color: "var(--mc-gris)", marginTop: "1.1rem" }}>
            <Link href="/portal/login" style={{ color: "var(--mc-verde-claro)", fontWeight: 600 }}>
              Volver a iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
