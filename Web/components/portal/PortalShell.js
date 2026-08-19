"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  FiGrid,
  FiMap,
  FiCalendar,
  FiClock,
  FiBarChart2,
  FiFileText,
  FiFilePlus,
  FiPlusCircle,
  FiLogOut,
  FiMenu,
} from "react-icons/fi";
import { obtenerSesion, cerrarSesion } from "@/lib/portal-sesion";
import { CLIENTE } from "@/lib/portal-datos";
import TransicionPagina from "@/components/TransicionPagina";

const NAV = [
  { href: "/portal", texto: "Panel", icono: FiGrid, exacto: true },
  { href: "/portal/cobertura", texto: "Cobertura", icono: FiMap },
  { href: "/portal/agendar", texto: "Agendar", icono: FiCalendar },
  { href: "/portal/agregar-saldo", texto: "Agregar saldo", icono: FiPlusCircle },
  { href: "/portal/historial", texto: "Historial de servicios", icono: FiClock },
  { href: "/portal/reportes", texto: "Reportes", icono: FiBarChart2 },
  { href: "/portal/documentos", texto: "Documentos", icono: FiFileText },
  { href: "/portal/cotizador", texto: "Cotizador", icono: FiFilePlus },
];

/** Envoltura protegida del portal: sidebar + topbar. Redirige a login sin sesión. */
export default function PortalShell({ children }) {
  const ruta = usePathname();
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [sesion, setSesion] = useState(null);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    // `vivo` evita tocar el estado si la pantalla ya se desmontó mientras
    // esperábamos la respuesta de Supabase.
    let vivo = true;
    obtenerSesion().then((s) => {
      if (!vivo) return;
      if (!s) {
        router.replace("/portal/login");
        return;
      }
      setSesion(s);
      setListo(true);
    });
    return () => {
      vivo = false;
    };
  }, [router]);

  useEffect(() => {
    setAbierto(false);
  }, [ruta]);

  if (!listo) {
    return (
      <div className="pt-body">
        <div className="pt-cargando">Cargando portal…</div>
      </div>
    );
  }

  const salir = async () => {
    await cerrarSesion();
    router.refresh();
    router.replace("/portal/login");
  };

  const activo = (item) =>
    item.exacto ? ruta === item.href : ruta.startsWith(item.href);
  const seccion = NAV.find((n) => activo(n)) || NAV[0];

  // Datos de quien entró. CLIENTE solo entra cuando NO hay sesión, que es el
  // modo demostración. Antes se caía a él con `||` en cuanto un campo venía
  // vacío, y a todos los clientes les aparecía el plan del cliente de ejemplo.
  const empresa = sesion?.empresa ?? CLIENTE.empresa;
  const folio = sesion?.clienteId ?? CLIENTE.id;
  const cuenta = sesion ? sesion.cuenta : CLIENTE.cuenta;

  const iniciales = empresa
    .replace(/[^A-Za-zÁÉÍÓÚÑ ]/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <div className="pt-body">
      <div className="pt-shell">
        <aside className={`pt-sidebar ${abierto ? "abierto" : ""}`}>
          <div className="pt-side-logo">
            {/* El logo apunta al panel, que es donde ya estas parado:
                precargarlo es trabajo puro para nada. */}
            <Link href="/portal" prefetch={false}>
              <Image
                src="/img/logo-h-blanco.png"
                alt="Morcast del Norte"
                width={688}
                height={200}
                style={{ height: 42, width: "auto" }}
                priority
              />
            </Link>
          </div>
          <nav className="pt-nav">
            {NAV.map((item) => {
              const Ico = item.icono;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  // `prefetch={false}` a propósito. Next precarga los enlaces
                  // que están EN PANTALLA, y este menú tiene sus 8 links
                  // siempre visibles: al abrir el panel salían 32 peticiones
                  // de precarga —cada link 4 y hasta 6 veces, porque se
                  // repiten en cada re-render— que tenían la red ocupada
                  // hasta el segundo 1.7, compitiendo con las consultas de
                  // los datos que el cliente sí está esperando ver.
                  prefetch={false}
                  className={`pt-nav-item ${activo(item) ? "activo" : ""}`}
                >
                  <Ico aria-hidden="true" />
                  {item.texto}
                </Link>
              );
            })}
            <button
              type="button"
              className="pt-nav-item"
              onClick={salir}
              style={{ marginTop: "auto", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
            >
              <FiLogOut aria-hidden="true" />
              Cerrar sesión
            </button>
          </nav>
          <div className="pt-side-pie">
            Portal de clientes · Fase 2<br />
            Morcast del Norte
          </div>
        </aside>

        {abierto && (
          <div className="pt-overlay" onClick={() => setAbierto(false)} />
        )}

        <div className="pt-main">
          <header className="pt-topbar">
            <div style={{ display: "flex", alignItems: "center", gap: "0.9rem" }}>
              <button
                type="button"
                className="pt-menu-btn"
                onClick={() => setAbierto(true)}
                aria-label="Abrir menú"
              >
                <FiMenu />
              </button>
              <div className="pt-topbar-titulo">
                {seccion.texto}
                <small>{cuenta}</small>
              </div>
            </div>
            <div className="pt-user">
              <div className="pt-user-datos" style={{ textAlign: "right" }}>
                <strong>{empresa}</strong>
                <span>{folio}</span>
              </div>
              <div className="pt-avatar">{iniciales}</div>
            </div>
          </header>
          <main className="pt-content">
            <TransicionPagina>{children}</TransicionPagina>
          </main>
        </div>
      </div>
    </div>
  );
}
