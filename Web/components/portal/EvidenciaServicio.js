"use client";

import { FiCamera, FiMapPin, FiClock, FiCheckCircle, FiEdit3 } from "react-icons/fi";

/**
 * Comprobante fotográfico ANTES / DESPUÉS de una recolección.
 * El chofer escanea el QR del contenedor y la app le pide una foto al llegar
 * (contenedor lleno) y otra al terminar (contenedor vacío). Ambas quedan
 * selladas con hora y GPS. Este comprobante lo ven chofer, administrador y
 * cliente. En el demo las fotos son marcadores; en la app real son las tomas
 * de la cámara del chofer.
 */
export default function EvidenciaServicio({ evidencia, compacto = false }) {
  if (!evidencia || !evidencia.antes || !evidencia.despues) return null;
  const { contenedor, gps, antes, despues } = evidencia;

  const Foto = ({ tipo, dato }) => {
    const esAntes = tipo === "antes";
    return (
      <div className={`pt-evi-foto ${esAntes ? "antes" : "despues"}`}>
        <span className="pt-evi-tag">{esAntes ? "Antes" : "Después"}</span>
        <div className="pt-evi-lente">
          {/* Si hay foto de verdad se muestra; si no, el marcador de siempre.
              El enlace viene firmado y caduca: no es una dirección que se
              pueda reenviar por ahí. */}
          {dato?.url ? (
            <img
              src={dato.url}
              alt={dato.etiqueta}
              style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }}
            />
          ) : (
            <>
              <FiCamera aria-hidden="true" />
              <small>{dato?.etiqueta}</small>
            </>
          )}
        </div>
        <div className="pt-evi-sello">
          <span><FiClock aria-hidden="true" /> {dato.hora}</span>
          <span><FiMapPin aria-hidden="true" /> GPS</span>
        </div>
      </div>
    );
  };

  return (
    <div className="pt-evi">
      <div className="pt-evi-cab">
        <FiCamera aria-hidden="true" />
        <div>
          <strong>Comprobante de servicio</strong>
          <span>{contenedor}</span>
        </div>
      </div>

      <div className="pt-evi-fotos">
        <Foto tipo="antes" dato={antes} />
        <Foto tipo="despues" dato={despues} />
      </div>

      {!compacto && (
        <div className="pt-evi-datos">
          <div><span>Peso recolectado</span><strong>{despues.peso || "—"}</strong></div>
          <div><span>Firma del operador</span><strong><FiEdit3 aria-hidden="true" /> {despues.firma || "—"}</strong></div>
          <div><span>Ubicación</span><strong><FiMapPin aria-hidden="true" /> {gps}</strong></div>
          <div><span>Estatus</span><strong className="ok"><FiCheckCircle aria-hidden="true" /> Servicio concretado</strong></div>
        </div>
      )}
    </div>
  );
}
