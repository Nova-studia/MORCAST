"use client";

import { useEffect, useRef, useState } from "react";
import { DownloadSimple, EnvelopeSimple, WarningCircle } from "@phosphor-icons/react/dist/ssr";

/**
 * "¡ALTA EXITOSA!" — el cierre del alta firmada (y de la confirmación del
 * correo, con `titulo` propio).
 *
 * Celebración LLAMATIVA a propósito: la pidió el socio de Luis (5-oct-2026)
 * para que darse de alta se sienta como un logro. La palomita brota con
 * rebote, salen anillos, el título entra con un salto y cae confeti en TODA
 * la página (canvas-confetti: un lienzo fijo encima de todo que no estorba
 * los clics). La lluvia de confeti NO termina mientras la persona siga en
 * esta pantalla; se detiene en cuanto sale de ella.
 * Con `prefers-reduced-motion` no hay confeti y todo aparece ya terminado
 * (ver el CSS): el movimiento es para festejar, no para marear a nadie.
 *
 * El PDF llega en base64 en la misma respuesta de la acción de servidor: se
 * convierte en un Blob y se descarga de ahí, sin otro viaje ni un enlace
 * público que alguien pudiera reenviar.
 */

/** base64 → URL de un Blob (se revoca al desmontar). */
function usarUrlPdf(base64) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!base64) return undefined;
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const u = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [base64]);
  return url;
}

/** Colores de Morcast (DESIGN.md) más blanco y un amarillo de fiesta. */
const COLORES_CONFETI = ["#2a6a99", "#4eb34a", "#265421", "#8fc9ef", "#f2c230", "#ffffff"];

/**
 * El festejo: dos cañonazos desde las esquinas de abajo, un estallido al
 * centro y lluvia por toda la página que sigue mientras la pantalla esté
 * abierta. Al desmontar se cancela todo y se borra el lienzo.
 */
function usarConfeti(activo) {
  const yaFue = useRef(false);
  useEffect(() => {
    if (!activo || yaFue.current) return undefined;
    if (typeof window === "undefined") return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    yaFue.current = true;

    let vivo = true;
    const relojes = [];
    let lanzar = null;

    import("canvas-confetti").then(({ default: confetti }) => {
      if (!vivo) return;
      lanzar = confetti;
      const base = { colors: COLORES_CONFETI, disableForReducedMotion: true, zIndex: 9999 };

      // 1) Cañonazos cuando termina de dibujarse la palomita.
      relojes.push(setTimeout(() => {
        confetti({ ...base, particleCount: 140, angle: 60, spread: 70, startVelocity: 62, origin: { x: 0, y: 0.95 } });
        confetti({ ...base, particleCount: 140, angle: 120, spread: 70, startVelocity: 62, origin: { x: 1, y: 0.95 } });
      }, 550));

      // 2) Lluvia INFINITA (pedido de Luis y su socio, 5-oct): cae desde
      //    arriba en puntos al azar mientras la persona siga en esta
      //    pantalla. Se detiene al salir de ella (limpieza del efecto) y se
      //    pausa con la pestaña en segundo plano, para no gastar batería en
      //    algo que nadie está viendo. Pocas piezas por tanda: es lluvia, no
      //    tormenta, y así un teléfono modesto no se traba.
      relojes.push(setTimeout(function llover() {
        if (!vivo) return;
        if (!document.hidden) {
          confetti({
            ...base,
            particleCount: 7,
            startVelocity: 0,
            ticks: 420,
            gravity: 0.7,
            drift: Math.random() * 1.2 - 0.6,
            scalar: 1.05,
            origin: { x: Math.random(), y: -0.05 },
          });
        }
        relojes[1] = setTimeout(llover, 140); // reusa el lugar: la lista no crece sin fin
      }, 900));

      // 3) Estallido final al centro.
      relojes.push(setTimeout(() => {
        confetti({ ...base, particleCount: 180, spread: 120, startVelocity: 45, scalar: 1.15, origin: { x: 0.5, y: 0.45 } });
      }, 2600));
    });

    return () => {
      vivo = false;
      relojes.forEach(clearTimeout);
      lanzar?.reset?.();
    };
  }, [activo]);
}

export default function AltaExitosa({
  titulo = "¡Alta exitosa!",
  folio,
  pdfBase64,
  nombrePdf,
  textoDescarga = "Descargar mi solicitud (PDF)",
  aviso,          // { tipo: "correo" | "alerta", texto }
  children,       // detalle propio de cada pantalla (cobertura, siguientes pasos)
  acciones,       // botones secundarios
  celebrar = true, // confeti y animación grande
}) {
  const url = usarUrlPdf(pdfBase64);
  usarConfeti(celebrar);

  return (
    <div className={`pt-card pt-exitosa ${celebrar ? "pt-exitosa-fiesta" : ""}`}>
      <div className="pt-exitosa-sello" aria-hidden="true">
        <span className="pt-exitosa-anillo" />
        <span className="pt-exitosa-anillo dos" />
        <svg viewBox="0 0 56 56" width="72" height="72">
          <circle className="pt-exitosa-circulo" cx="28" cy="28" r="25" />
          <path className="pt-exitosa-check" d="M17 29.5l7.5 7.5L40 21" />
        </svg>
      </div>

      <div className="pt-exitosa-texto">
        {folio && <p className="pt-exitosa-folio">Folio {folio}</p>}
        <h2 role="status">{titulo}</h2>
        {children}
      </div>

      {pdfBase64 && (
        <a
          className="pt-btn pt-btn-verde pt-exitosa-descarga"
          href={url || undefined}
          download={nombrePdf || "solicitud.pdf"}
          aria-disabled={!url}
        >
          <DownloadSimple aria-hidden="true" /> {textoDescarga}
        </a>
      )}

      {aviso && (
        <p className={`pt-exitosa-aviso ${aviso.tipo === "alerta" ? "alerta" : ""}`}>
          {aviso.tipo === "alerta" ? <WarningCircle aria-hidden="true" /> : <EnvelopeSimple aria-hidden="true" />}
          <span>{aviso.texto}</span>
        </p>
      )}

      {acciones && <div className="pt-exitosa-acciones">{acciones}</div>}
    </div>
  );
}
