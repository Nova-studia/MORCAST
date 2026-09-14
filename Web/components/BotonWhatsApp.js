"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaWhatsapp } from "react-icons/fa";

/**
 * Botón flotante de WhatsApp.
 *
 * Desde el 14-sep-2026 lleva al cuestionario de /cotizar en vez de abrir un
 * chat vacío: el dueño de Morcast perdía tiempo sacándole los datos a cada
 * cliente uno por uno. En el propio cuestionario no aparece, porque llevaría a
 * la misma página.
 */
export default function BotonWhatsApp() {
  const ruta = usePathname();
  if (ruta === "/cotizar") return null;

  return (
    <Link
      href="/cotizar"
      className="mc-wa"
      aria-label="Cotiza por WhatsApp"
      title="Cotiza por WhatsApp"
    >
      <FaWhatsapp aria-hidden="true" />
    </Link>
  );
}
