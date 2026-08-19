"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { FiArrowRight, FiArrowLeft } from "react-icons/fi";
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
        <Image
          src="/img/logo-h-blanco.png"
          alt="Morcast del Norte"
          width={688}
          height={200}
          style={{ height: 80, width: "auto", alignSelf: "flex-start" }}
          priority
        />
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
            <div className="pt-campo">
              <label htmlFor="password">Contraseña</label>
              <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            <button type="submit" className="pt-btn pt-btn-naranja" style={{ width: "100%", justifyContent: "center", padding: "0.8rem", fontSize: "0.95rem" }} disabled={enviando}>
              {enviando ? "Entrando…" : <>Entrar al panel <FiArrowRight /></>}
            </button>
          </form>

          <Link href="/portal/login" className="pt-login-admin">
            <FiArrowLeft /> Volver al portal de clientes
          </Link>
        </div>
      </div>
    </div>
  );
}
