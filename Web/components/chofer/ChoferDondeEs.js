"use client";

import { useState } from "react";
import { MapPin, NavigationArrow, Crosshair, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { enlaceComoLlegar, tieneUbicacion } from "@/lib/mapas.mjs";
import { esConfiable } from "@/lib/ubicacion";
import { fijarUbicacionPunto } from "@/lib/datos-chofer";

/**
 * DÓNDE ES LA PARADA: la dirección completa, las referencias para llegar y
 * el botón "Cómo llegar" a Google Maps.
 *
 * Pedido de los dueños (4-oct-2026): que el chofer llegue al punto EXACTO.
 * Con lat/lng el enlace lleva al pin; sin ellas, a la dirección escrita, que
 * en un parque industrial puede dejarlo a una cuadra del portón.
 *
 * Por eso, si el punto todavía no tiene ubicación y `conGuardar` viene
 * puesto (solo en la pantalla de la parada, donde el chofer está parado
 * frente al cliente), se ofrece guardarla con su GPS. La lectura la pasa la
 * pantalla —ya la está vigilando para el sello de las fotos— en vez de abrir
 * aquí un segundo vigilante que gastaría batería por lo mismo.
 */
export default function ChoferDondeEs({
  parada,
  conGuardar = false,
  lectura = null,
  estadoGps = "inicial",
  alGuardar,
}) {
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState(null); // { ok, motivo }

  const punto = parada.punto;
  const conPin = tieneUbicacion(punto);
  const lecturaBuena = esConfiable(lectura);

  const guardar = async () => {
    if (!lecturaBuena || guardando) return;
    setGuardando(true);
    const r = await fijarUbicacionPunto(parada.id, lectura);
    setGuardando(false);
    setResultado(r);
    if (r.ok) alGuardar?.({ lat: lectura.lat, lng: lectura.lng });
  };

  if (!punto) {
    return (
      <div className="ch-donde">
        <div className="ch-direccion">
          <MapPin aria-hidden="true" weight="fill" /> Sin domicilio registrado. Pregunta a la oficina.
        </div>
      </div>
    );
  }

  return (
    <div className="ch-donde">
      <div className="ch-direccion">
        <MapPin aria-hidden="true" weight="fill" />
        <span>
          {punto.alias ? <strong>{punto.alias} · </strong> : null}
          {parada.direccionCompleta}
        </span>
      </div>

      {parada.referencias && (
        <div className="ch-referencias">
          <strong>Cómo encontrarlo:</strong> {parada.referencias}
        </div>
      )}

      <a
        className="ch-llegar"
        href={enlaceComoLlegar(punto)}
        target="_blank"
        rel="noopener noreferrer"
      >
        <NavigationArrow aria-hidden="true" weight="fill" /> Cómo llegar
      </a>
      {/* Que el chofer sepa a qué tan cerca lo va a dejar el mapa. Sin pin,
          llegar "a la dirección" no es llegar a la puerta. */}
      <div className="ch-llegar-nota">
        {conPin ? "Te lleva al punto exacto." : "Este punto no tiene pin: te lleva a la dirección escrita."}
      </div>

      {conGuardar && !conPin && !resultado?.ok && !abierto && (
        <button type="button" className="pt-btn ch-boton-sec" onClick={() => setAbierto(true)}>
          <Crosshair aria-hidden="true" /> Guardar la ubicación de este punto
        </button>
      )}

      {conGuardar && !conPin && !resultado?.ok && abierto && (
        <div className="ch-ubicar">
          <div>
            <strong>Hazlo solo parado en la entrada del cliente</strong>, donde
            se carga el contenedor. Esta ubicación es la que van a usar todos
            los choferes para llegar aquí.
          </div>
          {estadoGps === "pidiendo" && <div>Buscando tu ubicación…</div>}
          {lectura && !lecturaBuena && (
            <div>
              Señal débil (±{lectura.precision_m} m). Espera unos segundos al
              aire libre hasta que baje de 100 m.
            </div>
          )}
          {["negada", "sin-senal", "no-disponible"].includes(estadoGps) && !lectura && (
            <div>Sin GPS no se puede guardar. Revisa el permiso de ubicación.</div>
          )}
          {resultado && !resultado.ok && <div className="ch-error">{resultado.motivo}</div>}
          <button
            type="button"
            className="pt-btn ch-boton-sec"
            onClick={guardar}
            disabled={!lecturaBuena || guardando}
          >
            <Crosshair aria-hidden="true" />
            {guardando
              ? "Guardando…"
              : lecturaBuena
                ? `Estoy en la entrada: guardar (±${lectura.precision_m} m)`
                : "Esperando una buena señal…"}
          </button>
          <button type="button" className="pt-btn ch-boton-sec" onClick={() => setAbierto(false)}>
            Ahora no
          </button>
        </div>
      )}

      {resultado?.ok && (
        <div className="ch-ubicar-ok">
          <CheckCircle aria-hidden="true" weight="fill" /> Ubicación guardada. Desde hoy “Cómo llegar” trae a este punto.
        </div>
      )}
    </div>
  );
}
