"use client";

import { useState } from "react";
import {
  Plus,
} from "@phosphor-icons/react/dist/ssr";
import { PREGUNTAS } from "@/lib/datos";

/** Acordeón de preguntas frecuentes: abre una a la vez. */
export default function PreguntasFrecuentes() {
  const [abierta, setAbierta] = useState(0);

  return (
    <div className="mc-faq">
      {PREGUNTAS.map((p, i) => {
        const activa = abierta === i;
        return (
          <div key={p.q} className={`mc-faq-item ${activa ? "activa" : ""}`}>
            <button
              type="button"
              className="mc-faq-pregunta"
              aria-expanded={activa}
              onClick={() => setAbierta(activa ? -1 : i)}
            >
              <span>{p.q}</span>
              <Plus className="mc-faq-icono" aria-hidden="true" />
            </button>
            <div className="mc-faq-respuesta" hidden={!activa}>
              <p>{p.a}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
