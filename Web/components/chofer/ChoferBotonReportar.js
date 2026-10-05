"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Warning } from "@phosphor-icons/react/dist/ssr";

/**
 * "REPORTAR UN PROBLEMA", siempre a la mano.
 *
 * Pedido de los dueños (4-oct-2026): que el chofer pueda avisar de un
 * accidente, un retraso o un contenedor dañado desde cualquier pantalla.
 * Va fijo abajo, donde llega el pulgar, y no en el menú: en un accidente
 * nadie se pone a buscar.
 *
 * Si el chofer está dentro de una parada, el reporte se abre ya amarrado a
 * ella, para que no tenga que volver a decir dónde está.
 *
 * ⚠️ Se dibuja con un portal en <body>. El contenido del chofer va dentro de
 * TransicionPagina, que anima con `transform`, y un ancestro con transform
 * se vuelve el bloque contenedor de sus hijos `position: fixed`: la barra
 * se despegaba de la ventana y subía con la página en cada cambio de
 * pantalla (lo mismo que le pasó al sidebar, ver TransicionPagina.js).
 */
export default function ChoferBotonReportar() {
  const ruta = usePathname() || "";
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  if (!montado || ruta.startsWith("/chofer/reportar")) return null;

  const enParada = ruta.match(/^\/chofer\/recoleccion\/([^/]+)/);
  const href = enParada
    ? `/chofer/reportar?parada=${encodeURIComponent(enParada[1])}`
    : "/chofer/reportar";

  return createPortal(
    <div className="ch-reportar-barra">
      <Link href={href} className="ch-reportar-boton">
        <Warning aria-hidden="true" weight="fill" /> Reportar un problema
      </Link>
    </div>,
    document.body
  );
}
