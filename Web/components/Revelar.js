"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Revela su contenido cuando entra en el viewport (estilo RTS).
 *
 * - Usa IntersectionObserver: sin librerías, sin listeners de scroll.
 * - Repetible: se anima cada vez que entra al viewport y se oculta al salir,
 *   así la animación se repite al subir y volver a bajar.
 * - Respeta prefers-reduced-motion: si el usuario desactivó animaciones,
 *   el contenido aparece de inmediato sin movimiento.
 *
 * @param {number} retraso  ms de retraso (para escalonar tarjetas)
 * @param {string} desde    "abajo" | "izq" | "der" | "escala"
 */
export default function Revelar({
  children,
  retraso = 0,
  desde = "abajo",
  className = "",
  as: Tag = "div",
}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const nodo = ref.current;
    if (!nodo) return;

    // Sin animación si el usuario la desactivó, o si el navegador no soporta IO
    const sinMovimiento = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (sinMovimiento || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const obs = new IntersectionObserver(
      ([entrada]) => {
        // Repetible: visible al entrar, oculto al salir (anima ida y vuelta)
        setVisible(entrada.isIntersecting);
      },
      // Dispara un poco antes de que llegue al borde inferior
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    obs.observe(nodo);
    return () => obs.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`rv rv-${desde} ${visible ? "rv-on" : ""} ${className}`}
      style={retraso ? { transitionDelay: `${retraso}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
