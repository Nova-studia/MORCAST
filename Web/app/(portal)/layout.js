"use client";

import "./portal.css";
import { usePathname } from "next/navigation";
import PortalShell from "@/components/portal/PortalShell";

/**
 * Layout del PORTAL DE CLIENTES (Fase 2). No lleva el navbar/footer público.
 * La pantalla de login se muestra sin el shell; el resto va protegido.
 */
export default function PortalLayout({ children }) {
  const ruta = usePathname();
  // El login y el alta los usa gente SIN sesión: van fuera del shell protegido.
  if (ruta === "/portal/login" || ruta === "/portal/alta") {
    return <div className="pt-body">{children}</div>;
  }
  return <PortalShell>{children}</PortalShell>;
}
