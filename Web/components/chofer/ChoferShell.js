"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { FiLogOut, FiTruck } from "react-icons/fi";
import { obtenerSesionChofer, cerrarSesionChofer } from "@/lib/chofer-sesion";
import TransicionPagina from "@/components/TransicionPagina";

/**
 * Marco del modo chofer.
 *
 * A propósito NO lleva menú lateral como el panel o el portal: el chofer usa
 * esto con una mano, en la calle, muchas veces con guantes. Una sola pantalla
 * y botones grandes valen más que una navegación completa.
 */
export default function ChoferShell({ children }) {
  const router = useRouter();
  const [sesion, setSesion] = useState(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    let vivo = true;
    obtenerSesionChofer().then((s) => {
      if (!vivo) return;
      if (!s) {
        router.replace("/chofer/login");
        return;
      }
      setSesion(s);
      setListo(true);
    });
    return () => {
      vivo = false;
    };
  }, [router]);

  if (!listo) {
    return (
      <div className="pt-body">
        <div className="pt-cargando">Cargando tu ruta…</div>
      </div>
    );
  }

  const salir = async () => {
    await cerrarSesionChofer();
    router.refresh();
    router.replace("/chofer/login");
  };

  return (
    <div className="pt-body">
      <header className="ch-barra">
        <Link href="/chofer" className="ch-marca">
          <Image
            src="/img/logo-compacto-blanco.png"
            alt="Morcast del Norte"
            width={900}
            height={260}
            /* Version compacta (camion + MORCAST): a 26 px de alto las dos
               lineas chicas del logo completo no se leen, se ven como mancha. */
            style={{ height: 30, width: "auto" }}
          />
          <span className="ch-chip">
            <FiTruck aria-hidden="true" /> Chofer
          </span>
        </Link>
        <div className="ch-usuario">
          <span>{sesion?.nombre}</span>
          <button type="button" className="pt-btn" onClick={salir} aria-label="Salir">
            <FiLogOut />
          </button>
        </div>
      </header>
      <main className="ch-contenido">
        <TransicionPagina>{children}</TransicionPagina>
      </main>
    </div>
  );
}
