"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { FiArrowRight, FiTruck } from "react-icons/fi";
import { iniciarSesionChofer, obtenerSesionChofer } from "@/lib/chofer-sesion";

export default function LoginChofer() {
  const router = useRouter();
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let vivo = true;
    obtenerSesionChofer().then((s) => {
      if (vivo && s) router.replace("/chofer");
    });
    return () => {
      vivo = false;
    };
  }, [router]);

  const entrar = async (e) => {
    e.preventDefault();
    setError("");
    setEnviando(true);
    const r = await iniciarSesionChofer(correo, password);
    if (!r.ok) {
      setError(r.mensaje);
      setEnviando(false);
      return;
    }
    // refresh() antes de navegar: obliga al servidor a releer la cookie recién
    // creada. Sin esto, proxy.js todavía ve "sin sesión" y rebota al login.
    router.refresh();
    router.replace("/chofer");
  };

  return (
    <div className="pt-login">
      <div className="pt-login-lado">
        <Image
          src="/img/logo-h-blanco.png"
          alt="Morcast del Norte"
          width={688}
          height={200}
          style={{ height: 80, width: "auto", alignSelf: "flex-start" }}
          priority
        />
        <div className="pt-login-lema">
          <span className="ch-chip">
            <FiTruck aria-hidden="true" /> Chofer
          </span>
          <h2>Modo chofer</h2>
          <p>
            Consulta tu ruta del día y registra cada recolección con su
            evidencia: código del contenedor, foto antes y después, y el peso.
          </p>
        </div>
        <small>© {new Date().getFullYear()} Morcast del Norte, S.A. de C.V.</small>
      </div>

      <div className="pt-login-form">
        <form onSubmit={entrar}>
          <h1>Acceso de chofer</h1>
          <p className="pt-login-sub">Entra con la cuenta que te dio Morcast.</p>

          <div className="pt-campo">
            <label htmlFor="correo">Correo electrónico</label>
            <input
              id="correo"
              className="pt-input"
              type="email"
              autoComplete="username"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              required
            />
          </div>

          <div className="pt-campo">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              className="pt-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="pt-login-error">{error}</p>}

          <button type="submit" className="pt-btn pt-btn-verde ch-boton-grande" disabled={enviando}>
            {enviando ? "Entrando…" : "Entrar"} <FiArrowRight />
          </button>

          <p className="pt-login-pie">
            <Link href="/portal/login">Soy cliente</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
