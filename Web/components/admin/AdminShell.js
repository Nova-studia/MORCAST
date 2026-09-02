"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  List,
} from "@phosphor-icons/react/dist/ssr";
import { obtenerSesionAdmin, cerrarSesionAdmin } from "@/lib/admin-sesion";
import { ADMIN_PERFIL } from "@/lib/admin-datos";
import IconoAnimado from "@/components/IconoAnimado";
import TransicionPagina from "@/components/TransicionPagina";
import AvisoHold from "@/components/AvisoHold";
import useCajonArrastrable from "@/lib/cajon-arrastrable";

const NAV = [
  { href: "/admin", texto: "Panel", gif: "panel", exacto: true },
  // Sólo cambian los renglones que nombran algo de ESTE negocio. Panel,
  // Clientes, Reportes, Usuarios y Bitácora se quedan con Feather: una
  // rejilla o un escudo significan lo mismo en cualquier empresa, y
  // dibujarlos a mano sería trabajo sin significado nuevo.
  { href: "/admin/rutas", texto: "Rutas", gif: "cobertura" },
  { href: "/admin/recolecciones", texto: "Recolecciones", gif: "programados" },
  { href: "/admin/zonas-pedidas", texto: "Zonas pedidas", gif: "zonas-pedidas" },
  { href: "/admin/solicitudes", texto: "Solicitudes", gif: "solicitudes" },
  { href: "/admin/altas", texto: "Altas de clientes", gif: "altas-de-clientes" },
  // "documentos" es PROVISIONAL: no existe un icono propio para esto. Si
  // Luis entrega trabaja-con-nosotros.png/.webp en public/img/iconos-
  // animados/, se cambia esa palabra y ya. No se reusa "usuarios-y-roles":
  // en el rail recogido el icono es lo ÚNICO que se ve, y dos iguales se
  // vuelven indistinguibles.
  { href: "/admin/empleo", texto: "Trabaja con nosotros", gif: "documentos" },
  { href: "/admin/clientes", texto: "Clientes", gif: "clientes" },
  { href: "/admin/saldos", texto: "Saldos de clientes", gif: "por-pagar" },
  { href: "/admin/servicios", texto: "Servicios", gif: "servicios" },
  { href: "/admin/reportes", texto: "Reportes", gif: "reportes" },
  { href: "/admin/usuarios", texto: "Usuarios y roles", gif: "usuarios-y-roles" },
  { href: "/admin/bitacora", texto: "Bitácora", gif: "documentos" },
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
              {/* Dos archivos, no uno, a proposito: `logo-h-blanco.png` es
                  horizontal (el simbolo pegado al texto) y no hay forma de
                  recortarlo para quedarse solo con el camion+hoja sin cortar
                  la mitad de la hoja o dejar un pedazo de flecha suelto —eso
                  fue justo el bug que se vio en el rail recogido. La version
                  vertical (`logo-morcast-blanco.png`) trae el simbolo
                  COMPLETO arriba y el texto abajo, asi que recortando desde
                  arriba sale el simbolo entero. Desplegado sigue con la
                  horizontal porque ahi si cabe el logo completo con texto.
                  Verlas como "dos logos redundantes" y dejar solo uno rompe
                  el rail recogido de nuevo. */}
              <Image
                src="/img/logo-h-blanco.png"
                alt="Morcast del Norte"
                width={688}
                height={200}
                className="pt-logo-desplegado"
                // El tamano ya NO va aqui: en el rail recogido (portal.css,
                // min-width 768px) la imagen se recorta a solo el simbolo, y
                // un `style` en linea le ganaria a esa regla y la dejaria sin
                // efecto.
                priority
              />
              {/* `background-image` y no `<Image>`/`<img>` a proposito: con
                  `next/image` el ancho renderizado de este logo no
                  coincidia con el `width` puesto en portal.css (quedaba
                  mas angosto de lo pedido, aun con el object-fit/position
                  correctos) — probablemente por como next/image calcula su
                  propio tamano a partir de `sizes`/`srcset`. Un fondo le da
                  control directo en pixeles vía `background-size` y
                  `background-position`, sin ese intermediario. */}
              <span
                className="pt-logo-recogido"
                role="img"
                aria-label="Morcast del Norte"
              />
            </Link>
            <span className="pt-admin-tag">Panel de administración</span>
          </div>
          <nav className="pt-nav">
            {NAV.map((item) => {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  // Igual que en el portal: son 12 enlaces siempre en
                  // pantalla, y Next precarga todo lo que ve. Esas precargas
                  // compiten con las consultas de los datos del panel.
                  prefetch={false}
                  className={`pt-nav-item ${activo(item) ? "activo" : ""}`}
                  // Recogido, el rail solo enseña el icono: el `title` es lo
                  // unico que le dice a quien pasa el mouse que renglon es
                  // cada uno (portal.css, rail de iconos).
                  title={item.texto}
                >
                  {/* Quieto por omisión; se mueve sólo en el renglón donde
                      estás y en el que traes el cursor encima. Diecinueve
                      dibujos agitándose a la vez dejan de ser un menú. */}
                  <IconoAnimado nombre={item.gif} activo={activo(item)} tam={30} />
                  <span className="pt-nav-texto">{item.texto}</span>
                </Link>
              );
            })}
            <button
              type="button"
              className="pt-nav-item"
              onClick={salir}
              title="Cerrar sesión"
              style={{ marginTop: "auto", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
            >
              <IconoAnimado nombre="cerra-sesion" tam={30} />
              <span className="pt-nav-texto">Cerrar sesión</span>
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
            <AvisoHold lado="admin" />
            <TransicionPagina>{children}</TransicionPagina>
          </main>
        </div>
      </div>
    </div>
  );
}
