"use client";

import { useState } from "react";
import { CheckCircle, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { confirmarCorreoAlta } from "@/app/acciones-alta";
import AltaExitosa from "@/components/portal/AltaExitosa";

/** Lo que se le dice a quien abre un enlace que ya no sirve. */
const TEXTO_ESTADO = {
  invalido: "Este enlace ya se usó o no es válido. Si ya confirmaste tu solicitud, no tienes que hacer nada más.",
  vencido: "Este enlace venció (dura 7 días). Escríbenos a contacto@morcast.mx o llámanos al 868 384 9478 y te mandamos otro.",
  confirmado: "Tu correo ya estaba confirmado. No tienes que hacer nada más.",
  error: "No pudimos revisar el enlace ahora. Vuelve a abrirlo en un momento.",
};

/**
 * El botón "Confirmar mi solicitud" y lo que pasa después. Ver por qué es un
 * botón y no se confirma al abrir la página en `alta/confirmar/page.js`.
 */
export default function ConfirmarAlta({ token, estado, folio, empresa, demo }) {
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState("");

  if (resultado) {
    return (
      <AltaExitosa
        titulo="¡Correo confirmado!"
        folio={resultado.folio}
        pdfBase64={resultado.pdfBase64}
        nombrePdf={resultado.nombrePdf}
        textoDescarga="Descargar la versión final (PDF)"
        aviso={
          demo
            ? { tipo: "alerta", texto: "Modo de prueba: en este entorno no se guarda nada ni se mandan correos." }
            : resultado.pdfBase64
              ? { tipo: "correo", texto: "También te mandamos la versión final del PDF a tu correo." }
              : { tipo: "correo", texto: "Tu confirmación quedó registrada. Morcast te mandará la versión final de tu solicitud." }
        }
      >
        <p>
          Tu Solicitud de alta quedó <strong>firmada y confirmada</strong>. El siguiente paso lo damos
          nosotros: revisamos tu alta y te contactamos para confirmar el precio y el día de arranque.
        </p>
      </AltaExitosa>
    );
  }

  if (estado !== "vigente") {
    return (
      <div className="pt-card pt-confirmar">
        <p className="pt-exito" style={{ background: "var(--pt-alerta-tinte)", borderColor: "rgba(214, 164, 74, 0.35)" }}>
          <WarningCircle aria-hidden="true" style={{ color: "var(--pt-alerta)" }} />
          <span>{TEXTO_ESTADO[estado] || TEXTO_ESTADO.invalido}</span>
        </p>
      </div>
    );
  }

  const confirmar = async () => {
    setError("");
    setEnviando(true);
    let r;
    try {
      r = await confirmarCorreoAlta(token);
    } catch {
      r = { ok: false, motivo: "No se pudo confirmar. Revisa tu conexión e inténtalo de nuevo." };
    }
    setEnviando(false);
    if (!r?.ok) {
      setError(r?.motivo || "No se pudo confirmar. Inténtalo de nuevo.");
      return;
    }
    setResultado(r);
  };

  return (
    <div className="pt-card pt-confirmar">
      <p className="pt-exitosa-folio">Folio {folio}</p>
      <p style={{ margin: "0 0 1.2rem" }}>
        Vas a confirmar la Solicitud de alta de <strong>{empresa}</strong>. Al confirmar te mandamos la versión
        final del PDF, con la confirmación de tu correo en la hoja de evidencia.
      </p>
      {error && <div className="pt-login-error" role="alert" style={{ marginBottom: "1rem" }}>{error}</div>}
      <button type="button" className="pt-btn pt-btn-verde pt-btn-ancho" onClick={confirmar} disabled={enviando}>
        {enviando ? "Confirmando…" : <><CheckCircle aria-hidden="true" /> Confirmar mi solicitud</>}
      </button>
    </div>
  );
}
