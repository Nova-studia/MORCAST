"use client";

import "../(portal)/portal.css";
import "./chofer.css";
import { usePathname } from "next/navigation";
import ChoferShell from "@/components/chofer/ChoferShell";
import ChoferBotonReportar from "@/components/chofer/ChoferBotonReportar";

/**
 * Layout del MODO CHOFER. El login va sin el marco; el resto, protegido.
 *
 * El botón de "Reportar un problema" se cuelga aquí y no dentro del marco:
 * así queda en TODAS las pantallas del chofer (menos el login, donde todavía
 * no se sabe quién reporta) sin tocar el marco que comparten.
 */
export default function ChoferLayout({ children }) {
  const ruta = usePathname();
  if (ruta === "/chofer/login") {
    return <div className="pt-body">{children}</div>;
  }
  return (
    <ChoferShell>
      {children}
      <ChoferBotonReportar />
    </ChoferShell>
  );
}
