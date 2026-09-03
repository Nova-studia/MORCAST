"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Todo lo que reacciona al cursor, en un solo lugar.
 *
 * Luis probó varias tandas y solo notó las que están siempre vivas o las que
 * responden a ÉL. Una animación que pasa una vez y se acaba se la pierde
 * cualquiera. Por eso esto se concentra en la respuesta directa.
 *
 *   1. LUZ EN LAS TARJETAS   — se iluminan por donde pasa el cursor.
 *   2. BOTONES MAGNÉTICOS    — se recorren hacia el cursor al acercarte.
 *   3. PROFUNDIDAD DEL HERO  — la foto se va al lado contrario.
 *   4. GALERÍA QUE SE INCLINA— las fotos giran siguiendo al cursor.
 *   5. CURSOR PROPIO         — un punto que crece sobre lo clicable.
 *
 * UN SOLO listener para toda la página y UNA escritura por cuadro: mover el
 * ratón dispara cientos de eventos por segundo y no tiene caso pintar más
 * veces de las que la pantalla muestra.
 *
 * Cada efecto usa una propiedad distinta (transform / translate / rotate /
 * scale) precisamente para que no se pisen entre ellos ni con las
 * animaciones ligadas al scroll, que ya ocupan transform.
 */

const IMAN_ALCANCE = 90;
const IMAN_FUERZA = 0.14;  // 🔴 3-sep-2026: Luis pidió la MITAD de movimiento en los botones (era 0.28)
const INCLINACION_MAX = 9; // grados

const CLICABLE = "a, button, .mc-tarjeta, .mc-sector, .mc-cliente, .mc-faq-pregunta, input, select, textarea";

/**
 * Esto es de la web PÚBLICA. El portal, el panel de administración y el modo
 * chofer son herramientas de trabajo: ahí el cursor propio estorba —se pinta
 * encima del texto de las tarjetas— y el imán de los botones no ayuda a nadie
 * que lleve ocho horas capturando. Se apagan por completo en esas rutas.
 */
const HERRAMIENTAS = ["/portal", "/admin", "/chofer"];

export default function LuzCursor() {
  const punto = useRef(null);
  const ruta = usePathname() || "";
  const esHerramienta = HERRAMIENTAS.some((p) => ruta.startsWith(p));

  useEffect(() => {
    if (esHerramienta) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let pendiente = false;
    let ultimo = null;
    let imantados = [];
    let inclinable = null; // la foto que se está inclinando ahora

    const alMover = (e) => {
      ultimo = e;
      if (pendiente) return;
      pendiente = true;

      requestAnimationFrame(() => {
        pendiente = false;
        const ev = ultimo;
        if (!ev) return;

        // --- 5. Cursor propio ---
        const p = punto.current;
        if (p) {
          p.style.setProperty("--cx", `${ev.clientX}px`);
          p.style.setProperty("--cy", `${ev.clientY}px`);
          p.classList.add("visible");
          p.classList.toggle("sobre-clicable", Boolean(ev.target.closest?.(CLICABLE)));
        }

        // --- 1. Luz de la tarjeta ---
        const tarjeta = ev.target.closest?.(".mc-tarjeta, .mc-sector");
        if (tarjeta) {
          const r = tarjeta.getBoundingClientRect();
          tarjeta.style.setProperty("--mx", `${((ev.clientX - r.left) / r.width) * 100}%`);
          tarjeta.style.setProperty("--my", `${((ev.clientY - r.top) / r.height) * 100}%`);
        }

        // --- 4. Inclinación de las fotos de galería ---
        const foto = ev.target.closest?.(".mc-galeria-trabajos img, .mc-galeria-mosaico img");
        if (foto !== inclinable && inclinable) {
          inclinable.style.setProperty("--angulo", "0deg");
          inclinable = null;
        }
        if (foto) {
          inclinable = foto;
          const r = foto.getBoundingClientRect();
          const dx = (ev.clientX - (r.left + r.width / 2)) / (r.width / 2);   // -1..1
          const dy = (ev.clientY - (r.top + r.height / 2)) / (r.height / 2);
          // El eje de giro va perpendicular a hacia dónde apunta el cursor:
          // así la esquina más cercana al ratón se hunde y la opuesta sale.
          foto.style.setProperty("--eje-x", `${dy.toFixed(3)}`);
          foto.style.setProperty("--eje-y", `${(-dx).toFixed(3)}`);
          const fuerza = Math.min(1, Math.hypot(dx, dy));
          foto.style.setProperty("--angulo", `${(fuerza * INCLINACION_MAX).toFixed(2)}deg`);
        }

        // --- 2. Botones magnéticos ---
        for (const b of imantados) {
          const r = b.getBoundingClientRect();
          if (r.width === 0) continue;
          const dx = ev.clientX - (r.left + r.width / 2);
          const dy = ev.clientY - (r.top + r.height / 2);
          const fuera = Math.hypot(
            Math.max(0, Math.abs(dx) - r.width / 2),
            Math.max(0, Math.abs(dy) - r.height / 2)
          );
          if (fuera > IMAN_ALCANCE) {
            if (b.style.translate !== "") b.style.translate = "";
            continue;
          }
          const peso = (1 - fuera / IMAN_ALCANCE) * IMAN_FUERZA;
          b.style.translate = `${dx * peso}px ${dy * peso}px`;
        }

        // --- 3. Profundidad del hero — QUITADA el 3-sep-2026 ---
        // Luis pidio que la foto del hero se quede quieta. Siguen vivas la luz
        // de las tarjetas, los botones magneticos y la galeria que se inclina.
      });
    };

    const refrescar = () => {
      imantados = Array.from(document.querySelectorAll(".mc-btn"));
    };
    refrescar();

    // Al navegar entre páginas el contenido cambia: si no se vuelven a
    // recoger, el imán apuntaría a botones que ya no existen.
    const observador = new MutationObserver(refrescar);
    observador.observe(document.body, { childList: true, subtree: true });

    const alSalir = () => {
      for (const b of imantados) b.style.translate = "";
      if (inclinable) {
        inclinable.style.setProperty("--angulo", "0deg");
        inclinable = null;
      }
      punto.current?.classList.remove("visible");
    };

    document.addEventListener("pointermove", alMover, { passive: true });
    document.addEventListener("pointerleave", alSalir);

    return () => {
      document.removeEventListener("pointermove", alMover);
      document.removeEventListener("pointerleave", alSalir);
      observador.disconnect();
      alSalir();
    };
  }, [esHerramienta]);

  if (esHerramienta) return null;
  return <div ref={punto} className="mc-cursor" aria-hidden="true" />;
}
