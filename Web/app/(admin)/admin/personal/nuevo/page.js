"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { nombreCompleto } from "@/lib/personal.mjs";
import { listarPersonal } from "../acciones";
import FormEmpleado from "../FormEmpleado";
import s from "../personal.module.css";

/** Alta de un empleado. Al guardar se emite su gafete y se abre su ficha. */
export default function NuevoEmpleado() {
  const router = useRouter();
  const [jefes, setJefes] = useState([]);

  // Para el menú «Reporta a»: los administrativos activos.
  useEffect(() => {
    let vivo = true;
    listarPersonal().then((r) => {
      if (!vivo || !r.ok) return;
      setJefes(r.empleados
        .filter((e) => e.estado === "activo" && e.tipo === "administrativo")
        .map((e) => ({ id: e.id, nombre: nombreCompleto(e), puesto: e.puesto })));
    });
    return () => { vivo = false; };
  }, []);

  const alGuardar = (r) => {
    // Los avisos (no se pudo subir la foto, no se emitió el gafete) se
    // enseñan en la ficha, que es donde se arreglan.
    const avisos = r.avisos?.length ? `?avisos=${encodeURIComponent(r.avisos.join(" "))}` : "";
    router.push(`/admin/personal/${r.id}${avisos}`);
  };

  return (
    <div className={s.ficha}>
      <div className={`pt-page-head ${s.cabeza}`} style={{ margin: 0 }}>
        <div>
          <h1>Nuevo empleado</h1>
          <p>Al darlo de alta se emite su gafete, con su código y su PIN.</p>
        </div>
        <Link href="/admin/personal" className="pt-btn" prefetch={false}><ArrowLeft /> Personal</Link>
      </div>
      <div className="pt-card">
        <FormEmpleado jefes={jefes} alGuardar={alGuardar} alCancelar={() => router.push("/admin/personal")} />
      </div>
    </div>
  );
}
