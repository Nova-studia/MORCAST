"use client";

import { useEffect, useState } from "react";
import { DownloadSimple, EnvelopeSimple, WarningCircle } from "@phosphor-icons/react/dist/ssr";

/**
 * "¡ALTA EXITOSA!" — el cierre del alta firmada (y de la confirmación del
 * correo, con `titulo` propio).
 *
 * El movimiento sigue DESIGN.md ("intencional pero quieto"): el círculo y la
 * palomita se DIBUJAN una sola vez, el halo se apaga solo y el texto aparece
 * subiendo 12 px. Nada de escalas, giros ni confeti que se quede brincando:
 * a quien acaba de firmar un documento le toca una confirmación seria. Con
 * `prefers-reduced-motion` todo aparece ya terminado (ver el CSS).
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

export default function AltaExitosa({
  titulo = "¡Alta exitosa!",
  folio,
  pdfBase64,
  nombrePdf,
  textoDescarga = "Descargar mi solicitud (PDF)",
  aviso,          // { tipo: "correo" | "alerta", texto }
  children,       // detalle propio de cada pantalla (cobertura, siguientes pasos)
  acciones,       // botones secundarios
}) {
  const url = usarUrlPdf(pdfBase64);

  return (
    <div className="pt-card pt-exitosa">
      <div className="pt-exitosa-sello" aria-hidden="true">
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
