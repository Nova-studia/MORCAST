"use client";

import "../(portal)/portal.css";
import { usePathname } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";

/** Layout del PANEL DE ADMINISTRACIÓN (Fase 2). Login sin shell; resto protegido. */
export default function AdminLayout({ children }) {
  const ruta = usePathname();
  // El login y el segundo paso van sin el menú del panel: en ninguno de los
  // dos la persona ha terminado de entrar.
  if (ruta === "/admin/login" || ruta === "/admin/verificacion" || ruta === "/admin/entrar") {
    return <div className="pt-body pt-admin">{children}</div>;
  }
  return <AdminShell>{children}</AdminShell>;
}
