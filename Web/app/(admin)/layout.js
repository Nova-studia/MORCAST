"use client";

import "../(portal)/portal.css";
import { usePathname } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";

/** Layout del PANEL DE ADMINISTRACIÓN (Fase 2). Login sin shell; resto protegido. */
export default function AdminLayout({ children }) {
  const ruta = usePathname();
  if (ruta === "/admin/login") {
    return <div className="pt-body pt-admin">{children}</div>;
  }
  return <AdminShell>{children}</AdminShell>;
}
