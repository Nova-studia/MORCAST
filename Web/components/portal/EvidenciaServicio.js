"use client";

import { useState } from "react";
import {
  Camera,
  Clock,
  CheckCircle,
  PencilSimple,
  ArrowsOut,
} from "@phosphor-icons/react/dist/ssr";
import VisorFoto from "@/components/VisorFoto";

/**
 * Comprobante fotográfico ANTES / DESPUÉS de una recolección.
 * El chofer escanea el QR del contenedor y la app le pide una foto al llegar
 * (contenedor lleno) y otra al terminar (contenedor vacío). Ambas quedan
 * selladas con la hora. Este comprobante lo ven chofer, administrador y
 * cliente. En el demo las fotos son marcadores; en la app real son las tomas
 * de la cámara del chofer.
 *
 * ⚠️ SE QUITÓ EL SELLO DE "GPS" Y EL RENGLÓN DE "UBICACIÓN".
 * Decían que la foto estaba geolocalizada y NO LO ESTÁ: la tabla
 * `recolecciones` no tiene columnas de coordenadas, la app del chofer nunca
 * las pide, y con datos reales el renglón mostraba el texto fijo "Registrado
 * en la recolección". Sólo se veían coordenadas de verdad en los datos de
 * demostración, que las traen escritas a mano.
 *
 * Este comprobante es lo que el cliente puede usar como respaldo de que el
 * camión estuvo en su domicilio. Afirmar una verificación que no existe es
 * peor que no ofrecerla. Cuando el chofer capture coordenadas de verdad
 * (permiso del navegador + dos columnas en la tabla), el sello vuelve.
 */
export default function EvidenciaServicio({ evidencia, compacto = false }) {
  // Los ganchos van antes de cualquier salida temprana: React exige que se
  // llamen siempre en el mismo orden.
  const [viendo, setViendo] = useState(null);

  if (!evidencia || !evidencia.antes || !evidencia.despues) return null;
  const { contenedor, antes, despues } = evidencia;

  // Las dos fotos viajan juntas al visor para poder comparar sin cerrarlo:
  // el antes y el después sólo dicen algo el uno al lado del otro.
  const galeria = [
    { url: antes?.url, etiqueta: "Antes · contenedor lleno", hora: antes?.hora },
    { url: despues?.url, etiqueta: "Después · contenedor vacío", hora: despues?.hora },
  ].filter((f) => f.url);

  const Foto = ({ tipo, dato }) => {
    const esAntes = tipo === "antes";
    const abrible = Boolean(dato?.url);
    // Sin foto real no hay nada que agrandar: se queda como estaba, sin
    // fingir que es un botón.
    const Contenedor = abrible ? "button" : "div";
    return (
      <Contenedor
        type={abrible ? "button" : undefined}
        className={`pt-evi-foto ${esAntes ? "antes" : "despues"} ${abrible ? "abrible" : ""}`}
        onClick={abrible ? () => setViendo(galeria.findIndex((f) => f.url === dato.url)) : undefined}
        aria-label={abrible ? `Ver en grande la foto de ${esAntes ? "antes" : "después"}` : undefined}
      >
        <span className="pt-evi-tag">{esAntes ? "Antes" : "Después"}</span>
        {abrible && <span className="pt-evi-lupa" aria-hidden="true"><ArrowsOut /></span>}
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
              <Camera aria-hidden="true" />
              <small>{dato?.etiqueta}</small>
            </>
          )}
        </div>
        <div className="pt-evi-sello">
          <span><Clock aria-hidden="true" /> {dato.hora}</span>
        </div>
      </Contenedor>
    );
  };

  return (
    <div className="pt-evi">
      <div className="pt-evi-cab">
        <Camera aria-hidden="true" />
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
          <div><span>Firma del operador</span><strong><PencilSimple aria-hidden="true" /> {despues.firma || "—"}</strong></div>
          <div><span>Estatus</span><strong className="ok"><CheckCircle aria-hidden="true" /> Servicio concretado</strong></div>
        </div>
      )}

      {viendo !== null && viendo >= 0 && (
        <VisorFoto fotos={galeria} indice={viendo} alCerrar={() => setViendo(null)} />
      )}
    </div>
  );
}
