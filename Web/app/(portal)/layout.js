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
  // Fuera del shell protegido. El login y el alta los usa gente SIN sesión;
  // registro y pendiente los usa gente CON sesión pero SIN sello, y el shell
  // exige justamente ese sello: montarlo ahí las rebotaría al login.
  const SIN_SHELL = ["/portal/login", "/portal/alta", "/portal/registro", "/portal/pendiente"];
  if (SIN_SHELL.includes(ruta)) {
    return <div className="pt-body">{children}</div>;
  }
  return <PortalShell>{children}</PortalShell>;
}
