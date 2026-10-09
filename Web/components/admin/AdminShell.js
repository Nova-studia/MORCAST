"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  List,
} from "@phosphor-icons/react/dist/ssr";
import { obtenerSesionAdmin, cerrarSesionAdmin, sesionPuede } from "@/lib/admin-sesion";
import { ADMIN_PERFIL } from "@/lib/admin-datos";
import IconoAnimado from "@/components/IconoAnimado";
import TransicionPagina from "@/components/TransicionPagina";
import AvisoHold from "@/components/AvisoHold";
import { pesoRealActivo } from "@/lib/estado-sistema";
import { seccionDeRuta, SECCIONES } from "@/lib/permisos.mjs";
import useCajonArrastrable from "@/lib/cajon-arrastrable";

const NAV = [
  { href: "/admin", texto: "Panel", gif: "panel", exacto: true },
  // Sólo cambian los renglones que nombran algo de ESTE negocio. Panel,
  // Clientes, Reportes, Usuarios y Bitácora se quedan con Feather: una
  // rejilla o un escudo significan lo mismo en cualquier empresa, y
  // dibujarlos a mano sería trabajo sin significado nuevo.
  // Rutas, Sectores y Puntos son un solo renglón desde el 6-oct-2026 (Luis):
  // las dos pantallas llevan arriba las pestañas de PestanasMapa, y el
  // renglón se ilumina en cualquiera de las dos (`tambien`).
  { href: "/admin/rutas", texto: "Rutas, sectores y puntos", gif: "cobertura", tambien: ["/admin/sectores"] },
  { href: "/admin/recolecciones", texto: "Recolecciones", gif: "programados" },
  // Lo que pidieron los dueños el 4-oct-2026; sus GIF los entregó Luis el
  // 6-oct-2026 (antes llevaban un icono de Phosphor provisional).
  { href: "/admin/incidentes", texto: "Incidentes", gif: "incidentes" },
  // Apagado por ahora (lib/estado-sistema.js, PESO_REAL): `soloSi` lo saca del menú.
  { href: "/admin/viajes", texto: "Peso real (relleno)", gif: "peso-real-relleno", soloSi: pesoRealActivo },
  { href: "/admin/avisos", texto: "Avisos a clientes", gif: "avisos-a-clientes" },
  { href: "/admin/unidades", texto: "Unidades", gif: "unidades" },
  { href: "/admin/contenedores", texto: "Contenedores", gif: "contenedores" },
  { href: "/admin/zonas-pedidas", texto: "Zonas pedidas", gif: "zonas-pedidas" },
  { href: "/admin/solicitudes", texto: "Solicitudes", gif: "solicitudes" },
  { href: "/admin/altas", texto: "Altas de clientes", gif: "altas-de-clientes" },
  // `trabaja-con-nosotros.png`/`.webp` son PROVISIONALES: hoy son una copia
  // de `cotizar` (mismo icono, otro nombre), porque no existe un icono
  // propio para esto todavía. Se reemplazan solos en cuanto Luis suelte los
  // dos archivos con ese mismo nombre en public/img/iconos-animados/. No se
  // reusa el nombre de OTRO renglón (p. ej. "documentos", que ya es de
  // Bitácora, o "usuarios-y-roles"): en el rail recogido el icono es lo
  // ÚNICO que se ve, y dos renglones con el mismo nombre de icono se vuelven
  // indistinguibles.
  { href: "/admin/empleo", texto: "Trabaja con nosotros", gif: "trabaja-con-nosotros" },
  { href: "/admin/clientes", texto: "Clientes", gif: "clientes" },
  { href: "/admin/saldos", texto: "Saldos de clientes", gif: "por-pagar" },
  // Precios reales (7-oct-2026): solo el dueño y quien tenga el permiso.
  { href: "/admin/precios", texto: "Precios", gif: "agregar-saldo" },
  { href: "/admin/servicios", texto: "Servicios", gif: "servicios" },
  { href: "/admin/reportes", texto: "Reportes", gif: "reportes" },
  { href: "/admin/usuarios", texto: "Usuarios y roles", gif: "usuarios-y-roles" },
  { href: "/admin/bitacora", texto: "Bitácora", gif: "documentos" },
];

// Los renglones que hoy se enseñan. `soloSi` es para lo que está apagado a
// propósito (p. ej. el peso real del relleno). El permiso de cada renglón
// sale de su página (lib/permisos.mjs, `seccionDeRuta`) y se resuelve con la
// sesión, dentro del componente: un admin solo ve las secciones de su rol.
const NAV_ENCENDIDO = NAV.filter((n) => !n.soloSi || n.soloSi());

export default function AdminShell({ children }) {
  const ruta = usePathname();
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [sesion, setSesion] = useState(null);
  const MENU = NAV_ENCENDIDO.filter((n) => sesionPuede(sesion, seccionDeRuta(n.href)));
  // ?sin_permiso=<sección> lo pone proxy.js al rebotar a alguien al Panel.
  const [sinPermiso, setSinPermiso] = useState(null);
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
    const p = new URLSearchParams(window.location.search).get("sin_permiso");
    setSinPermiso(SECCIONES.find((x) => x.id === p)?.texto || null);
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
    item.exacto
      ? ruta === item.href
      : [item.href, ...(item.tambien || [])].some((h) => ruta.startsWith(h));
  const seccion = MENU.find((n) => activo(n)) || MENU[0];

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
            {MENU.map((item) => {
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
                  {item.icono ? (
                    <item.icono size={30} weight={activo(item) ? "fill" : "duotone"} aria-hidden="true" className="mc-icono-anim" />
                  ) : (
                    <IconoAnimado nombre={item.gif} activo={activo(item)} tam={30} />
                  )}
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
            {sinPermiso && (
              <div className="pt-login-error" role="alert" style={{ marginBottom: "1rem" }}>
                Tu rol no incluye <strong>{sinPermiso}</strong>. Si lo necesitas, pídeselo al dueño.
              </div>
            )}
            <TransicionPagina>{children}</TransicionPagina>
          </main>
        </div>
      </div>
    </div>
  );
}
