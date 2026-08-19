"use client";

import "../(portal)/portal.css";
import { usePathname } from "next/navigation";
import ChoferShell from "@/components/chofer/ChoferShell";

/** Layout del MODO CHOFER. El login va sin el marco; el resto, protegido. */
export default function ChoferLayout({ children }) {
  const ruta = usePathname();
  if (ruta === "/chofer/login") {
    return <div className="pt-body">{children}</div>;
  }
  return <ChoferShell>{children}</ChoferShell>;
}
