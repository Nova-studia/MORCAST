"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Saca un modal del área de contenido y lo cuelga del marco del panel.
 *
 * POR QUÉ: la animación de entrada de cada página (`.mc-pagina`, en
 * globals.css) termina con `transform: none`, pero el navegador la deja
 * calculada como `matrix(1, 0, 0, 1, 0, 0)` — y un ancestro con transform se
 * vuelve el bloque contenedor de sus hijos `position: fixed`. El fondo del
 * modal dejaba de cubrir la ventana y se centraba en la PÁGINA entera: en el
 * teléfono, con la lista larga, el modal aparecía a media pantalla y el
 * aviso de arriba quedaba sin oscurecer. Se vio en /admin/viajes.
 *
 * Va a `.pt-shell` y no a `body` porque ahí viven las variables de color del
 * panel (portal.css); colgado de `body`, el modal saldría sin sus colores.
 */
export default function EnPortal({ children }) {
  const [destino, setDestino] = useState(null);
  useEffect(() => {
    setDestino(document.querySelector(".pt-shell") || document.body);
  }, []);
  return destino ? createPortal(children, destino) : null;
}
