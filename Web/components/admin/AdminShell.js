"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  SquaresFour,
  Tray,
  Users,
  UserPlus,
  ChartBar,
  ShieldCheck,
  CurrencyDollar,
  FileText,
  SignOut,
  List,
  Path,
  Trash,
  MapTrifold,
  Truck,
  Wallet,
  ClipboardText,
} from "@phosphor-icons/react/dist/ssr";
import { obtenerSesionAdmin, cerrarSesionAdmin } from "@/lib/admin-sesion";
import { ADMIN_PERFIL } from "@/lib/admin-datos";
import TransicionPagina from "@/components/TransicionPagina";
import useCajonArrastrable from "@/lib/cajon-arrastrable";

const NAV = [
  { href: "/admin", texto: "Panel", icono: SquaresFour, exacto: true },
  // Sólo cambian los renglones que nombran algo de ESTE negocio. Panel,
  // Clientes, Reportes, Usuarios y Bitácora se quedan con Feather: una
  // rejilla o un escudo significan lo mismo en cualquier empresa, y
  // dibujarlos a mano sería trabajo sin significado nuevo.
  { href: "/admin/rutas", texto: "Rutas", icono: Path },
  { href: "/admin/recolecciones", texto: "Recolecciones", icono: Trash },
  { href: "/admin/zonas-pedidas", texto: "Zonas pedidas", icono: MapTrifold },
  { href: "/admin/solicitudes", texto: "Solicitudes", icono: Tray },
  { href: "/admin/altas", texto: "Altas de clientes", icono: UserPlus },
  { href: "/admin/clientes", texto: "Clientes", icono: Users },
  { href: "/admin/saldos", texto: "Saldos de clientes", icono: Wallet },
  { href: "/admin/servicios", texto: "Servicios", icono: Truck },
  { href: "/admin/reportes", texto: "Reportes", icono: ChartBar },
  { href: "/admin/usuarios", texto: "Usuarios y roles", icono: ShieldCheck },
  { href: "/admin/bitacora", texto: "Bitácora", icono: ClipboardText },
];

export default function AdminShell({ children }) {
  const ruta = usePathname();
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [sesion, setSesion] = useState(null);
  const [abierto, setAbierto] = useState(false);

  // El cajon tambien se arrastra con el dedo: deslizar desde el borde
  // izquierdo lo abre, deslizar sobre el o sobre el velo lo cierra. El
  // boton de hamburguesa sigue funcionando igual.
  const { refCajon, refVelo } = useCajonArrastrable({ abierto, setAbierto, listo });

  useEffect(() => {
    // `vivo` evita tocar el estado si la pantalla ya se desmontó mientras
    // esperábamos la respuesta de Supabase.
    let vivo = true;
    obtenerSesionAdmin().then((s) => {
      if (!vivo) return;
      if (!s) {
        router.replace("/admin/login");
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
        <div className="pt-cargando">Cargando panel…</div>
      </div>
    );
  }

  const salir = async () => {
    await cerrarSesionAdmin();
    router.refresh();
    router.replace("/admin/login");
  };

  const activo = (item) =>
    item.exacto ? ruta === item.href : ruta.startsWith(item.href);
  const seccion = NAV.find((n) => activo(n)) || NAV[0];

  const nombre = sesion?.nombre || ADMIN_PERFIL.nombre;
  const iniciales = nombre
    .replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ ]/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase() || "M";

  return (
    <div className="pt-body pt-admin">
      <div className="pt-shell">
        <aside ref={refCajon} className={`pt-sidebar ${abierto ? "abierto" : ""}`}>
          <div className="pt-side-logo">
            <Link href="/admin" style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <Image
                src="/img/logo-h-blanco.png"
                alt="Morcast del Norte"
                width={688}
                height={200}
                style={{ height: 38, width: "auto" }}
                priority
              />
            </Link>
            <span className="pt-admin-tag">Panel de administración</span>
          </div>
          <nav className="pt-nav">
            {NAV.map((item) => {
              const Ico = item.icono;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  // Igual que en el portal: son 12 enlaces siempre en
                  // pantalla, y Next precarga todo lo que ve. Esas precargas
                  // compiten con las consultas de los datos del panel.
                  prefetch={false}
                  className={`pt-nav-item ${activo(item) ? "activo" : ""}`}
                >
                  {/* EL PESO SIGUE AL ESTADO, no sólo el color.
                      Phosphor trae seis pesos del mismo dibujo, así que el
                      renglón donde estás parado va RELLENO y el resto en
                      trazo normal. Antes lo único que separaba al activo era
                      el color, y el color por sí solo es la señal más débil
                      que hay: se pierde con poca luz, a contraluz, y no
                      existe para quien no lo distingue. */}
                  <Ico aria-hidden="true" weight={activo(item) ? "fill" : "regular"} />
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
              <SignOut aria-hidden="true" />
              Cerrar sesión
            </button>
          </nav>
          <div className="pt-side-pie">
            Morcast del Norte<br />
            Administración · Fase 2
          </div>
        </aside>

        {/* Se monta SIEMPRE, aunque este cerrado. Antes iba con
            `{abierto && ...}` y el nodo nacia y moria con el cajon, asi que
            no habia nada que desvanecer: aparecia y desaparecia de un cuadro
            al siguiente. Cerrado queda en `visibility: hidden` (portal.css),
            o sea fuera del tabulador y sin recibir clicks. */}
        <div
          ref={refVelo}
          className="pt-overlay"
          onClick={() => setAbierto(false)}
          aria-hidden="true"
        />

        <div className="pt-main">
          <header className="pt-topbar">
            <div style={{ display: "flex", alignItems: "center", gap: "0.9rem" }}>
              <button
                type="button"
                className="pt-menu-btn"
                onClick={() => setAbierto(true)}
                aria-label="Abrir menú"
              >
                <List />
              </button>
              <div className="pt-topbar-titulo">
                {seccion.texto}
                <small>Panel de administración</small>
              </div>
            </div>
            <div className="pt-user">
              <div className="pt-user-datos" style={{ textAlign: "right" }}>
                <strong>{nombre}</strong>
                <span>{sesion?.rol || ADMIN_PERFIL.rol}</span>
              </div>
              {/* Iban "RC" fijas, de "Ramón Cázares", el administrador de
                  ejemplo. Al dueño le aparecían las iniciales de otra
                  persona en su propia sesión. */}
              <div className="pt-avatar pt-avatar-admin">{iniciales}</div>
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
