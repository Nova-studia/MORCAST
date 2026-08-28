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
import { mensajeDeError } from "@/lib/errores-login.mjs";
import { iniciarSesion, obtenerSesion } from "@/lib/portal-sesion";
import { supabaseNavegador } from "@/lib/supabase-navegador";
import BotonGoogle from "@/components/BotonGoogle";

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

  /**
   * Aviso de vuelta de /auth/callback (o de la sala de espera) cuando algo
   * salió mal.
   *
   * La URL trae un CÓDIGO CORTO y el texto lo pone `lib/errores-login.mjs`.
   * Antes se pintaba literal lo que viniera en `?error=`: React escapa, así
   * que no había XSS, pero `morcast.mx/portal/login?error=Tu cuenta fue
   * bloqueada, llama al 555…` era una trampa de phishing creíble SOBRE EL
   * DOMINIO REAL de la empresa. Un código que no esté en el diccionario cae
   * en el mensaje genérico.
   *
   * Y el parámetro se BORRA de la barra en cuanto se lee: si se queda, el
   * aviso sobrevive a las recargas y al botón de atrás, y el enlace se puede
   * seguir copiando y reenviando. `replaceState` no navega ni recarga: sólo
   * reescribe lo que se ve en la barra.
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codigo = params.get("error");
    if (!codigo) return;
    setError(mensajeDeError(codigo));
    params.delete("error");
    const cola = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (cola ? `?${cola}` : ""));
  }, []);

  /**
   * Entrar con Google.
   *
   * `redirectTo` apunta a nuestro `/auth/callback`, que es quien escribe la
   * sesión en cookies. Se arma con `window.location.origin` y no con una URL
   * escrita a mano: así funciona igual en morcast.mx, en localhost y en las
   * vistas previas de Vercel. Esas tres direcciones tienen que estar dadas de
   * alta en Supabase (Authentication → URL Configuration).
   */
  const entrarConGoogle = async () => {
    setError("");
    setEnviando(true);
    const { error: err } = await supabaseNavegador().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (err) {
      setError("No se pudo abrir la entrada con Google. Inténtalo de nuevo.");
      setEnviando(false);
    }
    // Si no hubo error el navegador ya se está yendo a Google: no se apaga
    // `enviando`, para que no parpadee el botón mientras navega.
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

          {/* El botón de Google, dibujado por Google en esta misma página.
              Va primero porque es el camino bueno: la pantalla de permisos
              dice "morcast.mx" en vez del dominio de Supabase. */}
          <BotonGoogle onError={setError} />

          {/* RESPALDO, a propósito. Si el guion de Google no carga —una
              extensión que lo bloquea, un navegador viejo, la red— el de
              arriba no aparece y éste sigue funcionando: manda por el camino
              de redirección de toda la vida, que pasa por Supabase. Se ve
              feo el nombre del dominio, pero se entra. */}
          <button
            type="button"
            className="pt-btn"
            style={{ width: "100%", justifyContent: "center", padding: "0.8rem", fontSize: "0.95rem", marginTop: "0.7rem" }}
            onClick={entrarConGoogle}
            disabled={enviando}
          >
            {/* El logotipo de Google va como SVG en línea: la CSP del sitio no
                deja traer imágenes de otros dominios, y Phosphor no trae la G
                de cuatro colores. */}
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/>
              <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"/>
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
            </svg>
            Continuar con Google
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "0.8rem", margin: "1.1rem 0" }}>
            <span style={{ flex: 1, height: 1, background: "currentColor", opacity: 0.15 }} />
            <span style={{ fontSize: "0.8rem", color: "var(--mc-gris)" }}>o con tu correo</span>
            <span style={{ flex: 1, height: 1, background: "currentColor", opacity: 0.15 }} />
          </div>

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
