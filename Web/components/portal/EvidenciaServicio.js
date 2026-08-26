"use client";

import { useState } from "react";
import {
  Camera,
  Clock,
  CheckCircle,
  PencilSimple,
  ArrowsOut,
  MapPin,
  Prohibit,
} from "@phosphor-icons/react/dist/ssr";
import VisorFoto from "@/components/VisorFoto";
import { comoTexto, comoEnlaceMapa, esConfiable } from "@/lib/ubicacion";

/**
 * Comprobante fotográfico ANTES / DESPUÉS de una recolección.
 * El chofer escanea el QR del contenedor y la app le pide una foto al llegar
 * (contenedor lleno) y otra al terminar (contenedor vacío). Ambas quedan
 * selladas con la hora. Este comprobante lo ven chofer, administrador y
 * cliente. En el demo las fotos son marcadores; en la app real son las tomas
 * de la cámara del chofer.
 *
 * EL SELLO DE UBICACIÓN, AHORA CON ALGO ATRÁS
 * Durante un tiempo cada foto llevaba un sello "GPS" y había un renglón
 * "Ubicación" que con datos reales decía el texto fijo "Registrado en la
 * recolección": no existían columnas de coordenadas ni la app las pedía.
 * Se quitó, y la migración 016 más `lib/ubicacion.js` lo devolvieron con
 * lecturas de verdad.
 *
 * AHORA HAY TRES ESTADOS Y LOS TRES SE DICEN:
 *   · Con lectura buena  → coordenadas, margen de error y enlace al mapa.
 *   · Con lectura floja  → las coordenadas Y el margen, marcado como que no
 *                          alcanza para respaldar el domicilio. No se
 *                          esconde: se enseña de qué tamaño es la afirmación.
 *   · Sin lectura        → "Sin ubicación". Sin señal o sin permiso, y eso
 *                          es un hecho del servicio, no algo que disimular.
 *
 * Este comprobante es lo que el cliente puede usar como respaldo de que el
 * camión estuvo en su domicilio. Un sello que a veces miente vale menos que
 * no tener sello.
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
          {dato.ubicacion ? (
            <span
              className={esConfiable(dato.ubicacion) ? "ok" : "flojo"}
              title={`${comoTexto(dato.ubicacion)} · precisión ±${dato.ubicacion.precision_m} m`}
            >
              <MapPin aria-hidden="true" weight={esConfiable(dato.ubicacion) ? "fill" : "regular"} />
              ±{dato.ubicacion.precision_m} m
            </span>
          ) : (
            <span className="sin"><Prohibit aria-hidden="true" /> sin ubicación</span>
          )}
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
          <div>
            <span>Ubicación del servicio</span>
            <strong>{(() => {
              // Manda la del DESPUÉS: es la que prueba que el contenedor se
              // vació ahí. La del antes sólo prueba que llegó.
              const u = despues.ubicacion || antes.ubicacion;
              if (!u) return <><Prohibit aria-hidden="true" /> Sin ubicación</>;
              return (
                <a href={comoEnlaceMapa(u)} target="_blank" rel="noopener noreferrer" className="pt-evi-mapa">
                  <MapPin aria-hidden="true" weight={esConfiable(u) ? "fill" : "regular"} />
                  {comoTexto(u)}
                  <em>±{u.precision_m} m</em>
                </a>
              );
            })()}</strong>
          </div>
          <div><span>Estatus</span><strong className="ok"><CheckCircle aria-hidden="true" /> Servicio concretado</strong></div>
        </div>
      )}

      {viendo !== null && viendo >= 0 && (
        <VisorFoto fotos={galeria} indice={viendo} alCerrar={() => setViendo(null)} />
      )}
    </div>
  );
}
