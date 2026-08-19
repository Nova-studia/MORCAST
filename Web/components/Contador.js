"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Número que cuenta hasta su valor cuando entra en pantalla.
 *
 * Acepta lo que ya había escrito a mano: "3", "11+", "24/7". Solo anima la
 * parte numérica y respeta lo que la rodea, así que "11+" cuenta hasta 11 y
 * conserva el signo, y "24/7" se queda quieto porque no es una cantidad que
 * crezca: es un horario.
 *
 * La curva desacelera al final (easeOutExpo). Un contador lineal se siente
 * mecánico; este llega rápido y se acomoda, que es como se lee un marcador.
 */
export default function Contador({ valor, duracion = 1400 }) {
  const [texto, setTexto] = useState(valor);
  const nodo = useRef(null);
  const yaCorrio = useRef(false);

  useEffect(() => {
    // "24/7" y similares: dos números separados por algo que no es un sufijo.
    // No son cantidades, no se animan.
    const m = String(valor).match(/^(\d+)(\D*)$/);
    if (!m) {
      setTexto(valor);
      return;
    }
    const destino = Number(m[1]);
    const sufijo = m[2] || "";

    // Sin pintar nada raro antes de tiempo: arranca en 0 solo cuando va a animar.
    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducido) {
      setTexto(valor);
      return;
    }
    setTexto("0" + sufijo);

    const el = nodo.current;
    if (!el) return;

    const observador = new IntersectionObserver(
      (entradas) => {
        const visible = entradas[0]?.isIntersecting;
        if (!visible || yaCorrio.current) return;
        yaCorrio.current = true;
        observador.disconnect();

        const inicio = performance.now();
        const paso = (ahora) => {
          const t = Math.min(1, (ahora - inicio) / duracion);
          const suave = 1 - Math.pow(2, -10 * t); // easeOutExpo
          setTexto(Math.round(destino * suave) + sufijo);
          if (t < 1) requestAnimationFrame(paso);
          else setTexto(destino + sufijo);
        };
        requestAnimationFrame(paso);
      },
      { threshold: 0.4 }
    );

    observador.observe(el);
    return () => observador.disconnect();
  }, [valor, duracion]);

  // tabular-nums evita que el número "baile" de ancho mientras cuenta.
  return (
    <span ref={nodo} style={{ fontVariantNumeric: "tabular-nums" }}>
      {texto}
    </span>
  );
}
