"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  CheckCircle,
  ArrowRight,
} from "@phosphor-icons/react/dist/ssr";
import CampoContrasena from "@/components/CampoContrasena";
import OtrosAccesos from "@/components/OtrosAccesos";
import { iniciarSesion, obtenerSesion } from "@/lib/portal-sesion";

export default function LoginPortal() {
  const router = useRouter();
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Si ya hay sesión, entra directo.
  useEffect(() => {
    let vivo = true;
    obtenerSesion().then((s) => {
      if (vivo && s) router.replace("/portal");
    });
    return () => {
      vivo = false;
    };
  }, [router]);

  const entrar = async (e) => {
    e.preventDefault();
    setError("");
    setEnviando(true);
    const r = await iniciarSesion(correo, password);
    if (!r.ok) {
      setError(r.mensaje);
      setEnviando(false);
      return;
    }
    // refresh() antes de navegar: obliga al servidor a releer la cookie recién
    // creada. Sin esto, proxy.js todavía ve "sin sesión" y rebota al login.
    router.refresh();
    router.replace("/portal");
  };

  return (
    <div className="pt-login">
      <div className="pt-login-lado">
        {/* El logotipo lleva al sitio público. Se usa `/` y no la URL
            absoluta a morcast.mx a propósito: los tres logins VIVEN en
            morcast.mx, así que `/` es la misma portada, y además sigue
            funcionando en desarrollo y en las vistas previas de Vercel, donde
            una URL escrita a mano te sacaría del entorno que estás probando. */}
        <Link href="/" className="pt-login-marca" aria-label="Ir a la página de Morcast del Norte">
          <Image
            src="/img/logo-h-blanco.png"
            alt="Morcast del Norte"
            width={688}
            height={200}
            /* Sin `style` de alto: el tamaño lo manda portal.css, que lo baja
               a 46 px en pantallas angostas. Puesto en línea le ganaba a la
               media query y el logo se quedaba en 80 px en el teléfono. Es el
               MISMO tropiezo que ya está anotado para `.pt-grid-detalle`. */
            style={{ width: "auto" }}
            priority
          />
        </Link>
        <div className="pt-login-lema">
          <h2>Portal de clientes</h2>
          <p>
            Consulta tu saldo, historial de servicios, reportes y descarga tus
            manifiestos y constancia fiscal en un solo lugar.
          </p>
          <ul className="pt-login-checks">
            <li><CheckCircle /> Saldo y estado de cuenta en tiempo real</li>
            <li><CheckCircle /> Historial completo de servicios</li>
            <li><CheckCircle /> Reportes diarios, mensuales y anuales</li>
            <li><CheckCircle /> Manifiestos y constancia fiscal en PDF</li>
          </ul>
        </div>
        <div style={{ position: "relative", zIndex: 1, fontSize: "0.82rem", color: "rgba(255,255,255,0.6)" }}>
          © {new Date().getFullYear()} Morcast del Norte, S.A. de C.V.
        </div>
      </div>

      <div className="pt-login-form-lado">
        <div className="pt-login-card">
          <h1>Iniciar sesión</h1>
          <p>Accede con las credenciales de tu empresa.</p>

          {error && <div className="pt-login-error">{error}</div>}

          <form onSubmit={entrar}>
            <div className="pt-campo">
              <label htmlFor="correo">Correo electrónico</label>
              <input
                id="correo"
                type="email"
                autoComplete="username"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="tu@empresa.com"
                required
              />
            </div>
            <CampoContrasena
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="submit"
              className="pt-btn pt-btn-verde"
              style={{ width: "100%", justifyContent: "center", padding: "0.8rem", fontSize: "0.95rem" }}
              disabled={enviando}
            >
              {enviando ? "Entrando…" : <>Entrar al portal <ArrowRight /></>}
            </button>
          </form>

          <p style={{ textAlign: "center", fontSize: "0.85rem", color: "var(--mc-gris)", marginTop: "1.1rem" }}>
            ¿Aún no eres cliente?{" "}
            <Link href="/portal/alta" style={{ color: "var(--mc-verde-claro)", fontWeight: 600 }}>
              Cotización/Alta
            </Link>
          </p>

          <OtrosAccesos actual="cliente" />
        </div>
      </div>
    </div>
  );
}
