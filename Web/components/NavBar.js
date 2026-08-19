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
import { FiPhone, FiMail, FiMapPin } from "react-icons/fi";
import { EMPRESA, NAVEGACION, enlaceWhatsApp } from "@/lib/datos";

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
                  <FiMapPin size={14} aria-hidden="true" />
                  {EMPRESA.ciudad}, {EMPRESA.estado}
                </span>
                <a href={`mailto:${EMPRESA.correos[0]}`}>
                  <FiMail size={14} aria-hidden="true" />
                  {EMPRESA.correos[0]}
                </a>
              </div>
              <div className="d-flex gap-4">
                {EMPRESA.telefonos.map((tel) => (
                  <a key={tel} href={`tel:+52${tel.replace(/\s/g, "")}`}>
                    <FiPhone size={14} aria-hidden="true" />
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
        } ${escondido ? "mc-nav-oculto" : ""}`}
        container={false}
      >
        <Container fluid className="mc-nav-cont px-3 px-lg-4">
          <Link href="/" className="navbar-brand mc-nav-logo p-0 m-0">
            <Image
              src={logoBlanco ? "/img/logo-h-blanco.png" : "/img/logo-h.png"}
              alt="Morcast del Norte — Manejo de Residuos"
              width={688}
              height={200}
              priority
              style={{ width: "auto", height: 64 }}
            />
          </Link>

          <NavbarToggler
            onClick={() => setAbierto(!abierto)}
            aria-label="Abrir menú de navegación"
          />

          <Collapse isOpen={abierto} navbar className="justify-content-lg-between">
            {/* Enlaces centrados */}
            <Nav className="mx-auto align-items-lg-center" navbar>
              {NAVEGACION.map((item) => {
                const activo =
                  item.href === "/" ? ruta === "/" : ruta.startsWith(item.href);
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
            {/* Acciones: "Cotizar ahora" (resalta) + "Iniciar sesión" en la esquina */}
            <Nav className="align-items-lg-center gap-2 gap-lg-2" navbar>
              <NavItem className="mt-3 mt-lg-0">
                <a
                  href={enlaceWhatsApp()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mc-btn mc-btn-verde"
                  style={{ padding: "0.65rem 1.4rem", fontSize: "0.88rem" }}
                >
                  Cotizar ahora
                </a>
              </NavItem>
              <NavItem className="mt-2 mt-lg-0">
                <Link
                  href="/portal/login"
                  className="mc-btn mc-btn-linea-blanca"
                  style={{ padding: "0.5rem 1.05rem", fontSize: "0.8rem" }}
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
