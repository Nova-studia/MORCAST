"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  List,
} from "@phosphor-icons/react/dist/ssr";
import { obtenerSesion, cerrarSesion } from "@/lib/portal-sesion";
import { CLIENTE } from "@/lib/portal-datos";
import IconoAnimado from "@/components/IconoAnimado";
import TransicionPagina from "@/components/TransicionPagina";
import AvisoHold from "@/components/AvisoHold";
import useCajonArrastrable from "@/lib/cajon-arrastrable";

const NAV = [
  { href: "/portal", texto: "Panel", gif: "panel", exacto: true },
  { href: "/portal/cobertura", texto: "Cobertura", gif: "cobertura" },
  { href: "/portal/agendar", texto: "Agendar", gif: "agendar" },
  { href: "/portal/agregar-saldo", texto: "Agregar saldo", gif: "agregar-saldo" },
  { href: "/portal/historial", texto: "Historial de servicios", gif: "historial-de-servicios" },
  { href: "/portal/reportes", texto: "Reportes", gif: "reportes" },
  { href: "/portal/documentos", texto: "Documentos", gif: "documentos" },
  { href: "/portal/cotizador", texto: "Cotizador", gif: "cotizar" },
];

/** Envoltura protegida del portal: sidebar + topbar. Redirige a login sin sesión. */
export default function PortalShell({ children }) {
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
        <aside ref={refCajon} className={`pt-sidebar ${abierto ? "abierto" : ""}`}>
          <div className="pt-side-logo">
            {/* El logo apunta al panel, que es donde ya estas parado:
                precargarlo es trabajo puro para nada. */}
            <Link href="/portal" prefetch={false}>
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
          </div>
          <nav className="pt-nav">
            {NAV.map((item) => {
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
            Portal de clientes · Fase 2<br />
            Morcast del Norte
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
              {/* En el teléfono este bloque decía exactamente lo mismo que
                  el <h1> de tres centímetros más abajo ("Reportes" / "Reportes")
                  y, para hacerle lugar, la barra escondía el nombre de la
                  empresa. O sea: repetía lo que ya se veía y ocultaba lo que
                  no. Abajo de 768 px se invierte — lo resuelve portal.css. */}
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
            <AvisoHold />
            <TransicionPagina>{children}</TransicionPagina>
          </main>
        </div>
      </div>
    </div>
  );
}
