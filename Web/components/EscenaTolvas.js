"use client";

import { useEffect, useRef } from "react";

/**
 * La escena del pie: dos tolvas, la basura cayendo y el roll-off que se la
 * lleva. Idea de Luis (3-sep-2026).
 *
 * 🔴 Va en su PROPIA franja, DEBAJO de la línea del copyright. Antes iba
 * detrás del texto y esa línea cruzaba las tolvas y el camión por la mitad.
 *
 * 🔴 El camión mira a la IZQUIERDA y NO se voltea: al voltearlo, el logotipo
 * de la caja queda espejeado. Se invierte el recorrido en vez de la imagen,
 * así que entra por la derecha y sale por la izquierda.
 *
 * 🔴 Las bolsas de la caja van DENTRO del mismo bloque que el camión, por eso
 * viajan con él sin que haya que cuadrar dos recorridos distintos.
 *
 * Sólo se anima cuando está en pantalla: ni CPU ni batería de gratis.
 */

// Las de la tolva izquierda vuelan a la derecha (hacia donde se planta el
// camión) y las de la derecha vuelan a la izquierda.
const BOLSAS = [
  { lado: "left", pos: "8.5%", hacia: "270px", retraso: "0s" },
  { lado: "left", pos: "12%", hacia: "230px", retraso: "1.4s" },
  { lado: "left", pos: "15.5%", hacia: "190px", retraso: "2.6s" },
  { lado: "right", pos: "8.5%", hacia: "-250px", retraso: ".7s" },
  { lado: "right", pos: "12%", hacia: "-210px", retraso: "2s" },
  { lado: "right", pos: "15.5%", hacia: "-170px", retraso: "3.3s" },
];

const CARGA = [
  { x: "96px", retraso: "0s" },
  { x: "134px", retraso: ".12s" },
  { x: "172px", retraso: ".24s" },
];

export default function EscenaTolvas() {
  const nodo = useRef(null);

  useEffect(() => {
    const el = nodo.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    el.classList.add("mc-escena-quieta");
    const obs = new IntersectionObserver(
      ([e]) => el.classList.toggle("mc-escena-quieta", !e.isIntersecting),
      { threshold: 0.05 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div className="mc-escena" ref={nodo} aria-hidden="true">
      <div className="mc-escena-piso" />
      <img className="mc-escena-tolva izq" src="/img/escena/tolva.png" alt="" />
      <img className="mc-escena-tolva der" src="/img/escena/tolva.png" alt="" />

      {BOLSAS.map((b, i) => (
        <img
          key={i}
          className="mc-escena-bolsa cae"
          src="/img/escena/bolsa.png"
          alt=""
          style={{
            [b.lado]: b.pos,
            "--haciaX": b.hacia,
            animationDelay: b.retraso,
          }}
        />
      ))}

      <div className="mc-escena-camion-grupo">
        <img className="mc-escena-camion" src="/img/escena/camion.png" alt="" />
        {CARGA.map((c, i) => (
          <img
            key={i}
            className="mc-escena-carga"
            src="/img/escena/bolsa.png"
            alt=""
            style={{ left: c.x, animationDelay: c.retraso }}
          />
        ))}
      </div>
    </div>
  );
}
