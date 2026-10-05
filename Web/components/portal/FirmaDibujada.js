"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Eraser } from "@phosphor-icons/react/dist/ssr";

/**
 * RECUADRO PARA DIBUJAR LA FIRMA, con el dedo, la pluma o el mouse.
 *
 * Decisiones que importan:
 *
 * · **Pointer events y `touch-action: none`** (en el CSS de `.pt-firma`).
 *   Con eventos de mouse el dedo no dibuja, y con eventos táctiles sin
 *   `touch-action: none` el teléfono se pone a desplazar la página a medio
 *   trazo y la firma sale cortada. `setPointerCapture` sigue el trazo aunque
 *   el dedo se salga del recuadro.
 *
 * · **Se guardan los TRAZOS, no los pixeles.** Al girar el teléfono o cambiar
 *   el ancho de la ventana el lienzo se redimensiona, y un `<canvas>` se borra
 *   al cambiarle el tamaño. Con los trazos guardados se vuelve a pintar igual,
 *   y la imagen que se exporta sale a un tamaño acotado (no el de la pantalla
 *   de cada quien), dentro de lo que acepta el servidor (`validarFirmaPng`).
 *
 * · **"Papel" claro con tinta oscura** aunque el portal sea oscuro: la firma
 *   termina impresa en un PDF blanco, y así se ve en pantalla como va a salir.
 *
 * · Un toque suelto no es una firma: cuenta como firmado cuando el trazo
 *   suma cierta longitud (`LARGO_MINIMO`).
 *
 * API: `ref.current.exportarPng()` → Promise<Blob|null>, `ref.current.borrar()`.
 * `onCambio(firmado: boolean)` avisa cuando hay o deja de haber firma.
 */

const TINTA = "#1a2221";
const GROSOR = 2.4; // en px de pantalla
const LARGO_MINIMO = 40; // px de trazo para contar como firma
const ANCHO_EXPORTADO_MAX = 1400;

export default function FirmaDibujada({ ref, onCambio, etiquetaId }) {
  const lienzo = useRef(null);
  const caja = useRef(null);
  const trazos = useRef([]); // [[{x, y}], …] en px CSS
  const actual = useRef(null);
  const [firmado, setFirmado] = useState(false);

  const largoTotal = () =>
    trazos.current.reduce((suma, t) => {
      for (let i = 1; i < t.length; i++) suma += Math.hypot(t[i].x - t[i - 1].x, t[i].y - t[i - 1].y);
      return suma;
    }, 0);

  const firmadoRef = useRef(false);
  const avisar = useCallback(() => {
    const ahora = largoTotal() >= LARGO_MINIMO;
    if (ahora === firmadoRef.current) return;
    firmadoRef.current = ahora;
    setFirmado(ahora);
    onCambio?.(ahora);
  }, [onCambio]);

  /** Pinta los trazos en un contexto ya escalado. */
  const pintar = (ctx, lista) => {
    ctx.strokeStyle = TINTA;
    ctx.fillStyle = TINTA;
    ctx.lineWidth = GROSOR;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const t of lista) {
      if (t.length === 1) {
        ctx.beginPath();
        ctx.arc(t[0].x, t[0].y, GROSOR / 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(t[0].x, t[0].y);
      // Curvas por los puntos medios: el trazo sale liso y no en serrucho.
      for (let i = 1; i < t.length - 1; i++) {
        const mx = (t[i].x + t[i + 1].x) / 2;
        const my = (t[i].y + t[i + 1].y) / 2;
        ctx.quadraticCurveTo(t[i].x, t[i].y, mx, my);
      }
      const ult = t[t.length - 1];
      ctx.lineTo(ult.x, ult.y);
      ctx.stroke();
    }
  };

  /** Ajusta el lienzo a su caja (con la densidad de la pantalla) y repinta. */
  const ajustar = useCallback(() => {
    const c = lienzo.current;
    const b = caja.current;
    if (!c || !b) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const { width, height } = b.getBoundingClientRect();
    c.width = Math.round(width * dpr);
    c.height = Math.round(height * dpr);
    const ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    pintar(ctx, trazos.current);
  }, []);

  useEffect(() => {
    ajustar();
    const obs = new ResizeObserver(ajustar);
    if (caja.current) obs.observe(caja.current);
    return () => obs.disconnect();
  }, [ajustar]);

  const punto = (e) => {
    const r = lienzo.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const empezar = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    // Si el navegador no puede capturar ese puntero (raro, pero pasa con
    // algunos lápices), se dibuja igual: sólo se pierde el trazo que salga
    // del recuadro.
    try { lienzo.current.setPointerCapture(e.pointerId); } catch { /* sigue sin captura */ }
    actual.current = [punto(e)];
    trazos.current.push(actual.current);
    const ctx = lienzo.current.getContext("2d");
    pintar(ctx, [actual.current]);
  };

  const mover = (e) => {
    if (!actual.current) return;
    e.preventDefault();
    // Los eventos "coalescidos" traen los puntos intermedios que el navegador
    // juntó entre dos cuadros: sin ellos, un trazo rápido sale en rectas.
    // Safari no los tiene, y a veces la lista llega vacía: entonces vale el
    // evento mismo.
    const juntos = e.nativeEvent.getCoalescedEvents?.();
    const eventos = juntos && juntos.length ? juntos : [e.nativeEvent];
    const ctx = lienzo.current.getContext("2d");
    for (const ev of eventos) {
      const p = punto(ev);
      const prev = actual.current[actual.current.length - 1];
      if (Math.hypot(p.x - prev.x, p.y - prev.y) < 0.8) continue;
      actual.current.push(p);
      ctx.strokeStyle = TINTA;
      ctx.lineWidth = GROSOR;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
  };

  const terminar = () => {
    if (!actual.current) return;
    actual.current = null;
    ajustar(); // repinta con las curvas lisas
    avisar();
  };

  const borrar = useCallback(() => {
    trazos.current = [];
    actual.current = null;
    ajustar();
    avisar();
  }, [ajustar, avisar]);

  useImperativeHandle(ref, () => ({
    borrar,
    /** La firma en PNG sobre fondo blanco, a un tamaño acotado. */
    exportarPng: () =>
      new Promise((resolver) => {
        const b = caja.current;
        if (!b || largoTotal() < LARGO_MINIMO) return resolver(null);
        const { width, height } = b.getBoundingClientRect();
        const escala = Math.min(2, ANCHO_EXPORTADO_MAX / width);
        const fuera = document.createElement("canvas");
        fuera.width = Math.round(width * escala);
        fuera.height = Math.round(height * escala);
        const ctx = fuera.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, fuera.width, fuera.height);
        ctx.setTransform(escala, 0, 0, escala, 0, 0);
        pintar(ctx, trazos.current);
        fuera.toBlob((blob) => resolver(blob), "image/png");
      }),
  }), [borrar]);

  return (
    <div>
      <div className="pt-firma" ref={caja}>
        <canvas
          ref={lienzo}
          role="img"
          aria-labelledby={etiquetaId}
          onPointerDown={empezar}
          onPointerMove={mover}
          onPointerUp={terminar}
          onPointerCancel={terminar}
          onPointerLeave={(e) => { if (e.pointerType === "mouse" && e.buttons === 0) terminar(); }}
        />
        <div className="pt-firma-guia" aria-hidden="true"><span>×</span></div>
        {!firmado && (
          <div className="pt-firma-vacia" aria-hidden="true">Firma aquí con el dedo o el mouse</div>
        )}
      </div>
      <div className="pt-firma-pie">
        <span aria-live="polite">{firmado ? "Firma lista." : "Aún no hay firma."}</span>
        <button type="button" className="pt-btn" onClick={borrar}>
          <Eraser aria-hidden="true" /> Borrar
        </button>
      </div>
    </div>
  );
}
