"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { FiArrowRight, FiTruck } from "react-icons/fi";
import CampoContrasena from "@/components/CampoContrasena";
import OtrosAccesos from "@/components/OtrosAccesos";
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

      {/* Mismas clases que el login del cliente y el del admin. Antes esta
          pantalla usaba `pt-login-form`, `pt-login-sub` y `pt-login-pie`, que
          NO EXISTEN en portal.css: los tres eran nombres huérfanos. El
          resultado en el teléfono era un formulario sin un solo pixel de
          margen —el botón salía a sangre de lado a lado— y un "Soy cliente"
          en el azul de enlace de Bootstrap, que no es un color de la marca. */}
      <div className="pt-login-form-lado">
        <div className="pt-login-card">
          <h1>Acceso de chofer</h1>
          <p>Entra con la cuenta que te dio Morcast.</p>

          {/* El error va ARRIBA del formulario, como en los otros dos logins:
              abajo del botón queda fuera de vista con el teclado abierto. */}
          {error && <div className="pt-login-error">{error}</div>}

          <form onSubmit={entrar}>
            <div className="pt-campo">
              <label htmlFor="correo">Correo electrónico</label>
              <input
                id="correo"
                type="email"
                autoComplete="username"
                inputMode="email"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="tu@morcast.mx"
                required
              />
            </div>

            <CampoContrasena
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button type="submit" className="pt-btn pt-btn-verde ch-boton-grande" disabled={enviando}>
              {enviando ? "Entrando…" : <>Entrar <FiArrowRight /></>}
            </button>
          </form>

          <OtrosAccesos actual="chofer" />
        </div>
      </div>
    </div>
  );
}
