"use client";

import { useEffect, useRef } from "react";

/**
 * GESTO DE ARRASTRE DEL CAJÓN LATERAL (portal, admin)
 * ---------------------------------------------------------------------------
 * Antes el cajón solo abría y cerraba con el botón de hamburguesa: la curva
 * corría sola, siempre igual, ignorando lo que hicieras. Esto lo pega al dedo.
 *
 * Lo que hace, en orden de importancia:
 *
 *   1. SEGUIMIENTO 1:1. Mientras arrastras, el cajón se mueve exactamente lo
 *      que se movió el dedo, y respeta DESDE DÓNDE lo agarraste. Saltar al
 *      centro al tomarlo rompe la ilusión de inmediato.
 *
 *   2. SE PUEDE INTERRUMPIR. Si lo agarras a media animación, la animación se
 *      cancela y el arrastre arranca desde la posición que tiene EN PANTALLA
 *      en ese instante, no desde su destino lógico. Arrancar desde el destino
 *      es lo que produce el salto visible.
 *
 *   3. HEREDA LA VELOCIDAD. Al soltar, el resorte no arranca en reposo:
 *      arranca a la velocidad exacta que traía el dedo. Es la costura entre
 *      arrastrar y animar; si no se hereda, se ve el brinco.
 *
 *   4. PROYECTA EL IMPULSO. No decide por dónde quedó el dedo sino por dónde
 *      VA. Un empujón corto y rápido abre el cajón aunque lo hayas soltado a
 *      un tercio del camino, igual que un scroll con inercia.
 *
 *   5. RESISTE EN EL TOPE. Pasado el punto de abierto no se traba: cede cada
 *      vez menos. Un tope duro se lee como "se congeló"; la resistencia
 *      progresiva se lee como "responde, pero ya no hay más para allá".
 *
 * AQUÍ SÍ VA REBOTE, y en el botón no. La diferencia no es capricho: el
 * rebote es correcto cuando el movimiento traía impulso físico —lo trajo tu
 * dedo— y se siente mal cuando algo simplemente apareció. Por eso el botón
 * usa la curva sin sobrepaso de portal.css y el gesto usa este resorte con
 * amortiguación 0.8, que son los números que Apple publica para un cajón.
 *
 * No se agregó ninguna librería de animación al proyecto: son ~40 líneas de
 * integrador y no valía meter una dependencia nueva a un sistema en vivo.
 */

/** Debe coincidir con el ancho de .pt-sidebar en portal.css. */
const ANCHO = 264;
/** El cajón solo existe como cajón por debajo de este ancho (portal.css). */
const MOVIL = "(max-width: 767.98px)";
/** Franja desde el borde izquierdo de la pantalla que abre el cajón. */
const ZONA_BORDE = 24;
/** Cuánto hay que moverse antes de comprometerse a un eje. */
const UMBRAL = 10;
/** Velocidad (px/s) desde la cual el signo del gesto manda sobre la posición. */
const VELOCIDAD_DECISIVA = 150;

/**
 * A dónde llegaría algo que se suelta a esta velocidad y se deja frenar.
 * Es la forma de decaimiento exponencial que usa el scroll con inercia, no la
 * de v²/2a del libro de física.
 */
export function proyectar(velocidad, deceleracion = 0.998) {
  return ((velocidad / 1000) * deceleracion) / (1 - deceleracion);
}

/** Mientras más te pasas del tope, menos te sigue. */
export function gomaElastica(exceso, dimension, constante = 0.55) {
  return (
    (exceso * dimension * constante) / (dimension + constante * Math.abs(exceso))
  );
}

/**
 * Resorte con los dos parámetros que se piensan, no con masa/rigidez/roce:
 *   amortiguacion  1.0 = se asienta sin pasarse; menor a 1 se pasa y regresa.
 *   respuesta      segundos hasta llegar; más bajo = más seco.
 * No tiene duración fija: el tiempo de asentamiento sale de los parámetros.
 */
export function correrResorte({
  desde,
  hacia,
  velocidad,
  amortiguacion,
  respuesta,
  alPaso,
  alFinal,
}) {
  const w0 = (2 * Math.PI) / respuesta;
  let x = desde;
  let v = velocidad;
  let ultimo = null;
  let vivo = true;
  let id = 0;

  const paso = (ahora) => {
    if (!vivo) return;
    if (ultimo === null) ultimo = ahora;
    let dt = (ahora - ultimo) / 1000;
    ultimo = ahora;
    // Pestaña dormida o cuadro perdido: no dar un salto de medio segundo.
    if (dt > 1 / 30) dt = 1 / 30;

    // Sub-pasos fijos: con dt grande la integración se vuelve inestable y el
    // resorte "explota" en vez de asentarse.
    const trozos = Math.max(1, Math.ceil(dt * 240));
    const h = dt / trozos;
    for (let i = 0; i < trozos; i++) {
      const a = -w0 * w0 * (x - hacia) - 2 * amortiguacion * w0 * v;
      v += a * h;
      x += v * h;
    }

    if (Math.abs(x - hacia) < 0.5 && Math.abs(v) < 20) {
      vivo = false;
      alPaso(hacia);
      alFinal();
      return;
    }
    alPaso(x);
    id = requestAnimationFrame(paso);
  };

  id = requestAnimationFrame(paso);

  return {
    detener() {
      vivo = false;
      cancelAnimationFrame(id);
    },
    get vivo() {
      return vivo;
    },
  };
}

/**
 * ¿Abre o cierra al soltar? Devuelve la X de destino (0 abierto, -ANCHO cerrado).
 *
 * Con impulso decide el SIGNO de la velocidad, no dónde quedó el dedo: un
 * empujón corto y rápido hacia la derecha abre el cajón aunque lo hayas
 * soltado casi al principio, que es lo que uno espera de algo que se avienta.
 * Sin impulso ya no hay nada que heredar y manda la posición proyectada.
 */
export function decidirDestino(x, velocidad, ancho = ANCHO) {
  if (Math.abs(velocidad) > VELOCIDAD_DECISIVA) {
    return velocidad > 0 ? 0 : -ancho;
  }
  return x + proyectar(velocidad) > -ancho / 2 ? 0 : -ancho;
}

/**
 * @param {object}   opciones
 * @param {boolean}  opciones.abierto     estado actual del cajón
 * @param {Function} opciones.setAbierto  para sincronizar al terminar el gesto
 * @param {boolean}  opciones.listo       si el marco ya pintó el cajón
 *
 * `listo` NO es un detalle: los tres marcos devuelven una pantalla de
 * "Cargando…" mientras le preguntan la sesión a Supabase, y el `<aside>` del
 * cajón todavía no existe cuando este enganche se monta. Con la lista de
 * dependencias vacía el efecto corría esa única vez, encontraba las
 * referencias en `null`, se rendía, y no se volvía a ejecutar nunca: el gesto
 * quedaba muerto y solo funcionaba el botón. Por eso el efecto depende de
 * `listo` y se vuelve a montar en cuanto el cajón aparece.
 */
export default function useCajonArrastrable({ abierto, setAbierto, listo }) {
  const refCajon = useRef(null);
  const refVelo = useRef(null);
  // El efecto se monta una sola vez; lee el estado de aquí, no de la clausura.
  const refAbierto = useRef(abierto);
  refAbierto.current = abierto;
  const refSet = useRef(setAbierto);
  refSet.current = setAbierto;

  useEffect(() => {
    const cajon = refCajon.current;
    const velo = refVelo.current;
    if (!cajon || !velo) return;

    const movil = window.matchMedia(MOVIL);
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)");

    let resorte = null;
    let idPuntero = null;
    let eje = null; // null = sin decidir, "x" = nuestro, "y" = del scroll
    let partidaX = 0;
    let partidaY = 0;
    let xAlTomar = 0;
    let x = refAbierto.current ? 0 : -ANCHO;
    let historial = [];

    // El valor que se está VIENDO, no el destino lógico. Es lo que permite
    // agarrar el cajón a media animación sin que pegue un brinco.
    const posicionEnPantalla = () => {
      const m = new DOMMatrixReadOnly(getComputedStyle(cajon).transform);
      return m.m41;
    };

    const pintar = (nueva) => {
      x = nueva;
      const avance = Math.max(0, Math.min(1, 1 + x / ANCHO));
      cajon.style.transition = "none";
      cajon.style.transform = "translateX(" + x + "px)";
      velo.style.transition = "none";
      velo.style.visibility = avance > 0.002 ? "visible" : "hidden";
      velo.style.opacity = String(avance);
    };

    const devolverACss = () => {
      cajon.style.transition = "";
      cajon.style.transform = "";
      velo.style.transition = "";
      velo.style.visibility = "";
      velo.style.opacity = "";
    };

    const asentar = (destino, velocidadInicial) => {
      if (resorte) resorte.detener();
      resorte = correrResorte({
        desde: x,
        hacia: destino,
        velocidad: velocidadInicial,
        // Rebote leve: el dedo traía impulso y el cajón lo hereda. Con el
        // botón esto sería un error; aquí es lo que se espera.
        amortiguacion: quieto.matches ? 1 : 0.8,
        respuesta: quieto.matches ? 0.001 : 0.3,
        alPaso: pintar,
        alFinal: () => {
          resorte = null;
          refSet.current(destino === 0);
          // Dos cuadros: para el segundo, React ya puso o quitó la clase y el
          // transform de CSS coincide con el inline, así que soltarlo no
          // produce ningún salto.
          requestAnimationFrame(() =>
            requestAnimationFrame(devolverACss)
          );
        },
      });
    };

    // Ventana corta: la velocidad que importa es la del final del gesto, no
    // el promedio de todo el recorrido.
    const velocidadDelDedo = () => {
      const ahora = performance.now();
      const recientes = historial.filter((p) => ahora - p.t < 90);
      if (recientes.length < 2) return 0;
      const a = recientes[0];
      const b = recientes[recientes.length - 1];
      const dt = (b.t - a.t) / 1000;
      if (dt <= 0) return 0;
      return (b.x - a.x) / dt;
    };

    const terminar = () => {
      if (eje !== "x") {
        eje = null;
        idPuntero = null;
        return;
      }
      const v = velocidadDelDedo();
      const destino = decidirDestino(x, v);
      eje = null;
      idPuntero = null;
      asentar(destino, v);
    };

    const alMover = (e) => {
      if (idPuntero === null || e.pointerId !== idPuntero) return;
      const dx = e.clientX - partidaX;
      const dy = e.clientY - partidaY;

      if (eje === null) {
        // Los dos gestos plausibles se miden a la vez y se descarta el
        // perdedor en cuanto la intención es clara. Si gana el vertical
        // soltamos el puntero para no estorbarle al scroll del menú.
        if (Math.abs(dx) < UMBRAL && Math.abs(dy) < UMBRAL) return;
        eje = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        if (eje === "y") {
          idPuntero = null;
          return;
        }
        // Se descuenta el umbral para que el cajón no pegue un tirón de 10px
        // en el instante en que se decide el eje.
        partidaX += dx > 0 ? UMBRAL : -UMBRAL;
      }

      if (e.cancelable) e.preventDefault();

      let nueva = xAlTomar + (e.clientX - partidaX);
      // Topes blandos: pasado el límite cede cada vez menos, no se traba.
      if (nueva > 0) nueva = gomaElastica(nueva, ANCHO);
      if (nueva < -ANCHO) nueva = -ANCHO - gomaElastica(-(nueva + ANCHO), ANCHO);

      historial.push({ t: performance.now(), x: nueva });
      if (historial.length > 12) historial.shift();
      pintar(nueva);
    };

    const alTomar = (e) => {
      if (!movil.matches) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (idPuntero !== null) return;

      const estaAbierto = refAbierto.current;
      const dentroDelCajon = cajon.contains(e.target) || velo.contains(e.target);
      const enElBorde = !estaAbierto && e.clientX <= ZONA_BORDE;
      const animando = Boolean(resorte && resorte.vivo);

      // Cerrado solo se toma desde el borde; abierto, desde el cajón o el velo.
      if (!animando && !enElBorde && !(estaAbierto && dentroDelCajon)) return;

      // Interrupción: cancelar la animación y seguir DESDE DONDE SE VE.
      if (animando) {
        const visto = posicionEnPantalla();
        resorte.detener();
        resorte = null;
        x = visto;
      } else {
        x = estaAbierto ? 0 : -ANCHO;
      }

      idPuntero = e.pointerId;
      eje = null;
      partidaX = e.clientX;
      partidaY = e.clientY;
      xAlTomar = x;
      historial = [{ t: performance.now(), x: x }];
      try {
        cajon.setPointerCapture(e.pointerId);
      } catch {
        // El navegador puede negarlo; los listeners de window igual funcionan.
      }
    };

    const alSoltar = (e) => {
      if (idPuntero === null || e.pointerId !== idPuntero) return;
      terminar();
    };

    // passive:false en pointermove porque hay que poder cancelar el scroll
    // en cuanto el gesto se decidió horizontal.
    document.addEventListener("pointerdown", alTomar, { passive: true });
    window.addEventListener("pointermove", alMover, { passive: false });
    window.addEventListener("pointerup", alSoltar, { passive: true });
    window.addEventListener("pointercancel", alSoltar, { passive: true });

    return () => {
      if (resorte) resorte.detener();
      document.removeEventListener("pointerdown", alTomar);
      window.removeEventListener("pointermove", alMover);
      window.removeEventListener("pointerup", alSoltar);
      window.removeEventListener("pointercancel", alSoltar);
      devolverACss();
    };
    // Solo `listo`: el estado vivo (abierto, setAbierto) viaja por refs, y
    // volver a montar los listeners en cada cambio de `abierto` tiraría un
    // gesto a la mitad.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo]);

  return { refCajon, refVelo };
}
