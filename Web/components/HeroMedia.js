"use client";

import { useEffect, useRef, useState } from "react";

/**
 * El fondo del hero: el logo se dibuja y de ahí encadenan los 4 videos.
 *
 * Cómo funciona la entrada, que es lo que más se preguntará quien lea esto:
 *
 *   1. El hero abre en BLANCO con toda la interfaz ya puesta (titular,
 *      botones, rótulo). No es una pantalla de carga que tape el sitio: el
 *      contenido se ve desde el primer instante.
 *   2. A la derecha corre el video del logotipo formándose.
 *   3. Cuando ESE video TERMINA, se cruza a blanco durante 2.5 s y arranca el
 *      video 1 de operación. De ahí siguen los cuatro, de 5 s cada uno.
 *
 * 🔴 Encadena con el evento `ended`, no con un temporizador: si el video del
 * logo tarda en cargar, un temporizador cortaría el logo a medio formar.
 *
 * 🔴 UNA SOLA VEZ por sesión. En la segunda visita la página abre directo en
 * el video: nadie quiere ver el mismo intro cada vez que entra.
 */

const VIDEOS = [1, 2, 3, 4];

export default function HeroMedia() {
  const capa = useRef(null);
  const vlogo = useRef(null);
  const refs = useRef([]);
  const [actual, setActual] = useState(0);

  // El intro sólo se salta a sí mismo; el carrusel corre siempre.
  useEffect(() => {
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let visto = false;
    try {
      visto = sessionStorage.getItem("mc-intro") === "1";
    } catch {}

    const seccion = capa.current?.closest(".mc-hero");

    const alVideo = () => {
      const c = capa.current;
      if (!c || c.dataset.fuera === "1") return;
      c.dataset.fuera = "1";
      c.classList.add("mc-hero-blanco-fuera");
      seccion?.classList.remove("mc-hero-en-blanco");
      // El navbar vive FUERA del hero, así que la marca va en <html>.
      document.documentElement.classList.remove("mc-intro-blanco");
      try {
        sessionStorage.setItem("mc-intro", "1");
      } catch {}
      // 2.6 s: un poco más que el cruce de 2.5 s, para no cortarlo a medias
      setTimeout(() => {
        if (c) c.style.display = "none";
      }, 2600);
      ir(0);
    };

    if (visto || quieto) {
      if (capa.current) capa.current.style.display = "none";
      seccion?.classList.remove("mc-hero-en-blanco");
      document.documentElement.classList.remove("mc-intro-blanco");
      if (quieto) refs.current[0]?.classList.add("mc-hero-video-vivo");
      else ir(0);
      return;
    }

    document.documentElement.classList.add("mc-intro-blanco");
    const v = vlogo.current;
    v?.addEventListener("ended", alVideo, { once: true });
    const p = v?.play();
    // Si el navegador bloquea la reproducción automática, no nos quedamos
    // atorados en blanco: se pasa al hero de inmediato.
    if (p && p.catch) p.catch(alVideo);
    // Red de seguridad por si el video nunca carga.
    const red = setTimeout(alVideo, 8000);

    const saltar = () => alVideo();
    const eventos = ["click", "keydown", "wheel", "touchstart"];
    eventos.forEach((e) =>
      window.addEventListener(e, saltar, { once: true, passive: true })
    );

    return () => {
      clearTimeout(red);
      eventos.forEach((e) => window.removeEventListener(e, saltar));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ir = (i) => {
    const n = (i + VIDEOS.length) % VIDEOS.length;
    setActual(n);
    refs.current.forEach((v, k) => {
      if (!v) return;
      v.classList.toggle("mc-hero-video-vivo", k === n);
      if (k !== n) {
        try {
          v.pause();
        } catch {}
      }
    });
    // El siguiente se precarga mientras se ve el actual: sin esto hay un
    // hueco negro al cambiar.
    const sig = refs.current[(n + 1) % VIDEOS.length];
    if (sig && sig.preload !== "auto") {
      sig.preload = "auto";
      sig.load();
    }
    const v = refs.current[n];
    if (v) {
      v.currentTime = 0;
      const p = v.play();
      if (p && p.catch) p.catch(() => {});
    }
  };

  // Ni datos ni batería con la pestaña escondida.
  useEffect(() => {
    const alCambiar = () => {
      const v = refs.current[actual];
      if (!v) return;
      if (document.hidden) v.pause();
      else {
        const p = v.play();
        if (p && p.catch) p.catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", alCambiar);
    return () => document.removeEventListener("visibilitychange", alCambiar);
  }, [actual]);

  return (
    <>
      <div className="mc-hero-foto" aria-hidden="true">
        {VIDEOS.map((n, i) => (
          <video
            key={n}
            ref={(el) => (refs.current[i] = el)}
            src={`/video/hero-${n}.mp4`}
            poster={`/img/hero-${n}.jpg`}
            muted
            playsInline
            preload={i === 0 ? "auto" : "metadata"}
            onEnded={() => ir(actual + 1)}
          />
        ))}
      </div>

      {/* El barrido de luz cruza justo al cambiar de video: el ojo sigue la
          luz y no registra el corte. */}
      <div className="mc-hero-barrido" aria-hidden="true" key={actual}>
        <i />
      </div>

      <div className="mc-hero-blanco" ref={capa} aria-hidden="true">
        <video
          ref={vlogo}
          src="/video/logo-video.mp4"
          poster="/img/logo-video.jpg"
          muted
          playsInline
          preload="auto"
        />
      </div>

      <div className="mc-hero-pasos" aria-hidden="true">
        {VIDEOS.map((n, i) => (
          <button
            key={n}
            type="button"
            className={`mc-hero-paso ${i === actual ? "activo" : ""}`}
            onClick={() => ir(i)}
            aria-label={`Ver video ${i + 1}`}
          >
            <i />
          </button>
        ))}
      </div>
    </>
  );
}
