"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  CaretLeft,
  CaretRight,
} from "@phosphor-icons/react/dist/ssr";

/**
 * Ver una foto de comprobante en grande.
 *
 * POR QUÉ
 * Las fotos del antes y el después son la prueba de que el servicio se hizo.
 * Se enseñaban a 120 px de alto dentro de una tarjeta: a ese tamaño no se
 * distingue si el contenedor quedó vacío, que es exactamente lo único que
 * esas fotos existen para demostrar. Lo usan los tres: el cliente para
 * revisar, la oficina para resolver un reclamo, y el chofer para confirmar
 * que su foto salió bien antes de irse de la parada.
 *
 * DECISIONES
 *
 * · Se pasa entre "antes" y "después" sin cerrar. Cuando alguien abre una de
 *   las dos, casi siempre es para compararlas — obligar a cerrar y volver a
 *   abrir rompe justo lo que se venía a hacer.
 *
 * · Cierra con Escape, con el botón, y tocando fuera de la imagen. Tres
 *   salidas porque el visor tapa la pantalla completa: quedarse encerrado en
 *   algo que sólo sirve para mirar es de lo más molesto que hay.
 *
 * · Bloquea el scroll del fondo mientras está abierto. Sin eso, en el
 *   teléfono el gesto de arrastrar la foto desplaza la página de atrás y al
 *   cerrar apareces en otro lado.
 *
 * · Devuelve el foco a la foto que lo abrió. Quien navega con teclado, si no,
 *   vuelve al principio del documento.
 *
 * · NO hace zoom ni recorte. Es un visor, no un editor: el navegador y el
 *   teléfono ya saben hacer zoom sobre una imagen a pantalla completa.
 */
export default function VisorFoto({ fotos = [], indice = 0, alCerrar }) {
  const [actual, setActual] = useState(indice);
  const refCerrar = useRef(null);
  const refAbrio = useRef(null);

  const hayVarias = fotos.length > 1;
  const ir = useCallback(
    (d) => setActual((i) => (i + d + fotos.length) % fotos.length),
    [fotos.length]
  );

  useEffect(() => setActual(indice), [indice]);

  useEffect(() => {
    // Quién tenía el foco antes de abrir, para devolvérselo al cerrar.
    refAbrio.current = document.activeElement;
    refCerrar.current?.focus();

    const alTecla = (e) => {
      if (e.key === "Escape") { e.preventDefault(); alCerrar(); }
      else if (e.key === "ArrowRight" && hayVarias) ir(1);
      else if (e.key === "ArrowLeft" && hayVarias) ir(-1);
    };
    document.addEventListener("keydown", alTecla);

    // El fondo no se desplaza mientras el visor está encima.
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", alTecla);
      document.body.style.overflow = overflowPrevio;
      // `focus` puede fallar si el nodo ya no existe (se navegó mientras).
      try { refAbrio.current?.focus?.(); } catch { /* no pasa nada */ }
    };
  }, [alCerrar, ir, hayVarias]);

  const foto = fotos[actual];
  if (!foto) return null;

  return (
    <div
      className="pt-visor"
      role="dialog"
      aria-modal="true"
      aria-label={`Foto ${foto.etiqueta || ""}`}
      // Sólo cierra si el clic cayó en el fondo, no en la imagen ni en los
      // controles. Sin esta comprobación, soltar un arrastre sobre la foto
      // cerraría el visor.
      onClick={(e) => { if (e.target === e.currentTarget) alCerrar(); }}
    >
      <div className="pt-visor-barra">
        <span className="pt-visor-titulo">
          {foto.etiqueta}
          {foto.hora ? <small>{foto.hora}</small> : null}
        </span>
        <button
          type="button"
          ref={refCerrar}
          className="pt-visor-btn"
          onClick={alCerrar}
          aria-label="Cerrar la foto"
        >
          <X />
        </button>
      </div>

      {hayVarias && (
        <button
          type="button"
          className="pt-visor-btn pt-visor-nav izq"
          onClick={() => ir(-1)}
          aria-label="Foto anterior"
        >
          <CaretLeft />
        </button>
      )}

      {/* `alt` describe la foto, no el control: es la prueba del servicio. */}
      <img className="pt-visor-img" src={foto.url} alt={foto.etiqueta || "Foto del servicio"} />

      {hayVarias && (
        <button
          type="button"
          className="pt-visor-btn pt-visor-nav der"
          onClick={() => ir(1)}
          aria-label="Foto siguiente"
        >
          <CaretRight />
        </button>
      )}

      {hayVarias && (
        <div className="pt-visor-pie">
          {fotos.map((f, i) => (
            <button
              key={i}
              type="button"
              className={`pt-visor-punto ${i === actual ? "activo" : ""}`}
              onClick={() => setActual(i)}
              aria-label={`Ver ${f.etiqueta}`}
              aria-current={i === actual}
            />
          ))}
        </div>
      )}
    </div>
  );
}
