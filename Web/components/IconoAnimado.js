"use client";

import { useEffect, useRef, useState } from "react";

/**
 * ICONO ANIMADO — quieto por omisión, se mueve cuando significa algo
 * ---------------------------------------------------------------------------
 * Los iconos los eligió Luis; el trabajo aquí fue hacerlos usables.
 *
 * DE QUÉ TAMAÑO ERA EL PROBLEMA
 * Llegaron como GIF de 640×640 con FONDO BLANCO OPACO y 23.5 MB entre los 19.
 * Sobre el panel oscuro se veían como bloques blancos, y el menú del cliente
 * solo habría cargado más de diez megas. Se les vació el fondo —solo el
 * blanco pegado a la orilla; el blanco de adentro, como la hoja del
 * manifiesto o el cuerpo del calendario, se respeta— y se pasaron a WebP
 * animado de 96 px: **2.35 MB, un 90% menos**.
 *
 * POR QUÉ NO SE MUEVEN TODO EL TIEMPO
 * Un menú donde diecinueve dibujos se agitan sin parar deja de ser un menú y
 * se vuelve un letrero de feria. Cansa a la semana, repinta sin descanso y
 * gasta batería en el teléfono del chofer.
 *
 * Así que por omisión se enseña **el primer cuadro quieto** (un PNG), y el
 * WebP animado entra solo en dos momentos donde el movimiento SIGNIFICA algo:
 *   · el renglón donde estás parado, y
 *   · aquel sobre el que pasas el cursor.
 *
 * Eso además arregla el peso de golpe: los 19 cuadros quietos juntos pesan
 * **108 KB**. La página carga eso, y el animado solo se pide cuando de verdad
 * se va a ver.
 *
 * ⚠️ NO SE PRECARGAN LOS ANIMADOS. Sería tentador para que el primer paso del
 * cursor no tenga demora, pero eso devuelve los 2.35 MB a la carga inicial y
 * mata justamente lo que se ganó.
 */
export default function IconoAnimado({
  nombre,
  activo = false,
  tam = 32,
  alt = "",
  className = "",
}) {
  const [encima, setEncima] = useState(false);
  const [quieto, setQuieto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const leer = () => setQuieto(mq.matches);
    leer();
    mq.addEventListener("change", leer);
    return () => mq.removeEventListener("change", leer);
  }, []);

  // Con movimiento reducido NUNCA se anima, ni activo ni con el cursor
  // encima: es una animación en bucle, que es exactamente lo que esa
  // preferencia existe para apagar.
  const anima = !quieto && (activo || encima);
  const base = `/img/iconos-animados/${nombre}`;

  return (
    <img
      ref={ref}
      src={anima ? `${base}.webp` : `${base}.png`}
      // El icono acompaña a un texto que ya dice lo mismo. Ponerle `alt`
      // repetiría cada renglón dos veces en un lector de pantalla.
      alt={alt}
      aria-hidden={alt ? undefined : "true"}
      width={tam}
      height={tam}
      className={`mc-icono-anim ${className}`}
      draggable={false}
      // El evento va en el <img> y no en el renglón: si estuviera en el
      // renglón, cada movimiento del cursor dentro de él dispararía un
      // re-render de la fila entera.
      onMouseEnter={() => setEncima(true)}
      onMouseLeave={() => setEncima(false)}
      // En un teléfono no hay cursor: el activo es el único que se mueve, y
      // eso basta. Tocar no lo enciende a propósito — el dedo va a navegar,
      // no a mirar el dibujo.
      style={{ width: tam, height: tam }}
    />
  );
}
