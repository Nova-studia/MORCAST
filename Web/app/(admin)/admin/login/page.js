"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { FiArrowRight } from "react-icons/fi";
import CampoContrasena from "@/components/CampoContrasena";
import OtrosAccesos from "@/components/OtrosAccesos";
import { iniciarSesionAdmin, obtenerSesionAdmin } from "@/lib/admin-sesion";

export default function LoginAdmin() {
  const router = useRouter();
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let vivo = true;
    obtenerSesionAdmin().then((s) => {
      if (vivo && s) router.replace("/admin");
    });
    return () => {
      vivo = false;
    };
  }, [router]);

  const entrar = async (e) => {
    e.preventDefault();
    setError("");
    setEnviando(true);
    const r = await iniciarSesionAdmin(correo, password);
    if (!r.ok) {
      setError(r.mensaje);
      setEnviando(false);
      return;
    }
    // refresh() antes de navegar: obliga al servidor a releer la cookie recién
    // creada. Sin esto, proxy.js todavía ve "sin sesión" y rebota al login.
    router.refresh();
    router.replace("/admin");
  };

  return (
    <div className="pt-login">
      <div className="pt-login-lado pt-login-lado-admin">
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
          <span className="pt-admin-chip">Administración</span>
          <h2>Panel de administración</h2>
          <p>
            Gestiona las solicitudes de cotización, tus clientes, la agenda de
            servicios, los reportes del negocio y las cuentas de tu equipo.
          </p>
        </div>
        <div style={{ position: "relative", zIndex: 1, fontSize: "0.82rem", color: "rgba(255,255,255,0.6)" }}>
          © {new Date().getFullYear()} Morcast del Norte, S.A. de C.V.
        </div>
      </div>

      <div className="pt-login-form-lado">
        <div className="pt-login-card">
          <h1>Acceso de administrador</h1>
          <p>Ingresa con tu cuenta del equipo Morcast.</p>

          {error && <div className="pt-login-error">{error}</div>}

          <form onSubmit={entrar}>
            <div className="pt-campo">
              <label htmlFor="correo">Correo electrónico</label>
              <input id="correo" type="email" autoComplete="username" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="Tu correo de administración" required />
            </div>
            <CampoContrasena
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="submit" className="pt-btn pt-btn-naranja" style={{ width: "100%", justifyContent: "center", padding: "0.8rem", fontSize: "0.95rem" }} disabled={enviando}>
              {enviando ? "Entrando…" : <>Entrar al panel <FiArrowRight /></>}
            </button>
          </form>

          <OtrosAccesos actual="admin" />
        </div>
      </div>
    </div>
  );
}
