"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Collapse,
  Navbar,
  NavbarToggler,
  Nav,
  NavItem,
  Container,
} from "reactstrap";
import {
  Phone,
  Envelope,
  MapPin,
} from "@phosphor-icons/react/dist/ssr";
import { EMPRESA, NAVEGACION, enlaceWhatsApp } from "@/lib/datos";

// Ver DESIGN.md → Disposición. El logo va CENTRADO y hace de enlace a la
// portada, por eso "Inicio" no aparece en el menú: sería un enlace repetido.
// Los enlaces se reparten tres de cada lado del logo.
const SIN_INICIO = NAVEGACION.filter((i) => i.href !== "/");
const MITAD = Math.ceil(SIN_INICIO.length / 2);
const ENLACES_IZQ = SIN_INICIO.slice(0, MITAD);
const ENLACES_DER = [...SIN_INICIO.slice(MITAD), { texto: "Empleo", href: "/empleo" }];

export default function NavBar() {
  const [abierto, setAbierto] = useState(false);
  const [scroll, setScroll] = useState(false);
  const [oculto, setOculto] = useState(false);
  const ultimoY = useRef(0);
  const ruta = usePathname();

  // En el inicio el navbar flota transparente sobre el hero oscuro.
  const modoHero = ruta === "/";
  // Sólido cuando se baja o cuando el menú móvil está abierto (para legibilidad).
  const solido = scroll || abierto;
  // Tema oscuro: el navbar es oscuro en todas las páginas → logo blanco siempre.
  const logoBlanco = true;

  // Se oculta al bajar y reaparece al subir (estilo AMP). Nunca si el menú móvil está abierto.
  const escondido = oculto && !abierto;

  useEffect(() => {
    const alScroll = () => {
      const y = window.scrollY;
      setScroll(y > 12);
      if (y < 10) {
        setOculto(false); // arriba del todo: siempre visible
      } else if (y > ultimoY.current + 4 && y > 90) {
        setOculto(true); // bajando: ocultar
      } else if (y < ultimoY.current - 4) {
        setOculto(false); // subiendo: mostrar
      }
      ultimoY.current = y;
    };
    alScroll();
    window.addEventListener("scroll", alScroll, { passive: true });
    return () => window.removeEventListener("scroll", alScroll);
  }, []);

  // Cierra el menú móvil al cambiar de página
  useEffect(() => {
    setAbierto(false);
  }, [ruta]);

  return (
    <>
      {/* Barra superior de contacto (oculta en el inicio para un look más limpio) */}
      {!modoHero && (
        <div className="mc-nav-barra d-none d-lg-block">
          <Container>
            <div className="d-flex justify-content-between align-items-center">
              <div className="d-flex gap-4">
                <span className="d-inline-flex align-items-center gap-2">
                  <MapPin size={14} aria-hidden="true" />
                  {EMPRESA.ciudad}, {EMPRESA.estado}
                </span>
                <a href={`mailto:${EMPRESA.correos[0]}`}>
                  <Envelope size={14} aria-hidden="true" />
                  {EMPRESA.correos[0]}
                </a>
              </div>
              <div className="d-flex gap-4">
                {EMPRESA.telefonos.map((tel) => (
                  <a key={tel} href={`tel:+52${tel.replace(/\s/g, "")}`}>
                    <Phone size={14} aria-hidden="true" />
                    {tel}
                  </a>
                ))}
              </div>
            </div>
          </Container>
        </div>
      )}

      <Navbar
        expand="lg"
        className={`mc-nav py-2 ${modoHero ? "mc-nav-hero" : ""} ${
          solido ? "mc-nav-scroll" : ""
        } ${escondido ? "mc-nav-oculto" : ""} ${
          abierto ? "mc-nav-abierto" : ""
        }`}
        container={false}
      >
        <Container fluid className="mc-nav-cont px-3 px-lg-4">
          {/* Logo del móvil: abajo de lg el logo va a la izquierda y el
              botón de menú a la derecha, como siempre. */}
          <Link href="/" className="navbar-brand mc-nav-logo p-0 m-0 d-lg-none">
            <Image
              src="/img/logo-nuevo-barra.png"
              alt="Morcast del Norte — Manejo de Residuos"
              width={797}
              height={228}
              priority
              style={{ width: "auto", height: 46 }}
            />
          </Link>

          <NavbarToggler
            onClick={() => setAbierto(!abierto)}
            aria-label="Abrir menú de navegación"
          />

          <Collapse isOpen={abierto} navbar className="mc-nav-fila">
            {/* Izquierda del logo */}
            <Nav className="mc-nav-grupo mc-nav-grupo-izq align-items-lg-center" navbar>
              {ENLACES_IZQ.map((item) => {
                const activo = ruta.startsWith(item.href);
                return (
                  <NavItem key={item.href}>
                    <Link
                      href={item.href}
                      className={`nav-link mc-nav-link ${activo ? "activo" : ""}`}
                      aria-current={activo ? "page" : undefined}
                    >
                      {item.texto}
                    </Link>
                  </NavItem>
                );
              })}
            </Nav>

            {/* Logo CENTRADO (solo lg+). Hace de enlace a la portada, por eso
                no hay "Inicio" en el menú. 40px por decisión de Luis. */}
            <Link
              href="/"
              className="navbar-brand mc-nav-logo mc-nav-logo-centro p-0 m-0 d-none d-lg-block"
            >
              <Image
                src="/img/logo-nuevo-barra.png"
                alt="Morcast del Norte — Manejo de Residuos"
                width={797}
                height={228}
                priority
              />
            </Link>

            {/* Derecha del logo, más las acciones */}
            <Nav className="mc-nav-grupo mc-nav-grupo-der align-items-lg-center" navbar>
              {ENLACES_DER.map((item) => {
                const activo = ruta.startsWith(item.href);
                return (
                  <NavItem key={item.href}>
                    <Link
                      href={item.href}
                      className={`nav-link mc-nav-link ${activo ? "activo" : ""}`}
                      aria-current={activo ? "page" : undefined}
                    >
                      {item.texto}
                    </Link>
                  </NavItem>
                );
              })}
              {/* 🔴 "Cotizar ahora" salió del navbar el 3-sep-2026: con los dos
                  botones el logo centrado no cabe (el lado derecho medía 787px
                  de 1280). El hero y todas las páginas ya llevan la llamada a
                  cotizar, así que no se pierde la conversión. Ver DESIGN.md. */}
              <NavItem className="mt-2 mt-lg-0">
                <Link
                  href="/portal/login"
                  className="mc-btn mc-btn-vidrio"
                  style={{ padding: "0.62rem 1.2rem" }}
                >
                  Iniciar sesión
                </Link>
              </NavItem>
            </Nav>
          </Collapse>
        </Container>
      </Navbar>
    </>
  );
}
