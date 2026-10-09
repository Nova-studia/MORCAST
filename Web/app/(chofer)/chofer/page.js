"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  MapPin,
  CheckCircle,
  CaretRight,
  NavigationArrow,
  Recycle,
  Signpost,
  Prohibit,
  Truck,
} from "@phosphor-icons/react/dist/ssr";
import { rutaDelDia, hoyISO } from "@/lib/datos-chofer";
import { avisarEventoParada } from "@/app/acciones-chofer";
import { enlaceComoLlegar } from "@/lib/mapas.mjs";
import { textoEnCamino } from "@/lib/chofer-cierre.mjs";

/**
 * La fecha se le enseña al chofer como se dice, no como la guarda la base.
 * "2026-08-26" es un formato de máquina; en un teléfono, en la calle, hay que
 * traducirlo mentalmente para saber si es hoy. Se arma con la fecha local a
 * mediodía para que el desfase horario no la corra un día.
 */
function fechaLegible(iso) {
  const [a, m, d] = iso.split("-").map(Number);
  if (!a || !m || !d) return iso;
  const texto = new Date(a, m - 1, d, 12).toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export default function RutaChofer() {
  const [paradas, setParadas] = useState([]);
  const [cargando, setCargando] = useState(true);
  // "En camino" en curso o con error, por parada: { [id]: "enviando" | texto de error }.
  const [camino, setCamino] = useState({});
  // Si el aviso de "En camino" salió de verdad, por parada (true/false); sin
  // dato (se cargó ya en camino) no se promete nada.
  const [avisado, setAvisado] = useState({});
  const [errorCarga, setErrorCarga] = useState("");
  const [intento, setIntento] = useState(0);
  const hoy = hoyISO();

  /**
   * "En camino" (6-oct-2026, Luis): la parada pasa a "En ruta" y al cliente
   * le llega el aviso por correo y al teléfono. Lo decide el servidor
   * (app/acciones-chofer.js), que comprueba que la parada sea de este chofer.
   */
  const enCamino = async (p) => {
    setCamino((c) => ({ ...c, [p.id]: "enviando" }));
    const r = await avisarEventoParada(p.id, "en-camino");
    if (r.ok || r.estado === "en-ruta") {
      setParadas((lista) => lista.map((x) => (x.id === p.id ? { ...x, estado: "en-ruta" } : x)));
      setCamino((c) => ({ ...c, [p.id]: undefined }));
      if (r.ok) setAvisado((a) => ({ ...a, [p.id]: Boolean(r.avisado) }));
      return;
    }
    setCamino((c) => ({ ...c, [p.id]: r.motivo || "No se pudo avisar. Revisa tu señal y vuelve a intentar." }));
  };

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setErrorCarga("");
    rutaDelDia(hoy, { lanzar: true })
      .then((p) => {
        if (!vivo) return;
        setParadas(p);
        setCargando(false);
      })
      .catch((e) => {
        if (!vivo) return;
        setErrorCarga(e?.message || "No se pudo cargar tu ruta.");
        setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [hoy, intento]);

  const pendientes = paradas.filter((p) => p.estatus === "pendiente");
  const hechas = paradas.filter((p) => p.estatus === "completado");
  const noProcedieron = paradas.filter((p) => p.estatus === "no-procedio");

  return (
    <>
      <div className="pt-page-head ch-encabezado">
        <h1>Mi ruta de hoy</h1>
        <p>{fechaLegible(hoy)}</p>
      </div>

      {/* Los tres números pesaban igual y ocupaban el mejor espacio de la
          pantalla. Al chofer lo único que le urge saber es CUÁNTAS LE FALTAN;
          lo hecho y el total son referencia. Ahora eso se lee en la jerarquía
          y no hay que compararlos para entenderlo. */}
      <div className="ch-resumen">
        <div className="ch-resumen-principal">
          <strong>{pendientes.length}</strong>
          <span>{pendientes.length === 1 ? "parada por hacer" : "paradas por hacer"}</span>
        </div>
        <div className="ch-resumen-lado">
          <div>
            {/* Un "No procedió" también es una parada resuelta: sin
                sumarlo, por hacer + hechas no daba el total. */}
            <strong>{hechas.length + noProcedieron.length}</strong>
            <span>Hechas</span>
          </div>
          <div>
            <strong>{paradas.length}</strong>
            <span>Total</span>
          </div>
        </div>
      </div>

      {cargando && <div className="pt-vacio">Cargando tu ruta…</div>}

      {!cargando && errorCarga && (
        <div className="pt-card ch-vacio" role="alert">
          <strong>No se pudo cargar tu ruta</strong>
          <span>{errorCarga}</span>
          <button type="button" className="pt-btn pt-btn-verde" style={{ marginTop: "0.8rem" }} onClick={() => setIntento((n) => n + 1)}>
            Reintentar
          </button>
        </div>
      )}

      {!cargando && !errorCarga && paradas.length === 0 && (
        <div className="pt-card ch-vacio">
          <CheckCircle aria-hidden="true" />
          <strong>Sin paradas para hoy</strong>
          <span>
            Si esperabas alguna, avisa a la oficina: puede que todavía no esté
            confirmada.
          </span>
        </div>
      )}

      {pendientes.length > 0 && (
        <>
          <h2 className="ch-seccion">Por recolectar</h2>
          {pendientes.map((p) => (
            <div key={p.id} className="ch-parada">
              <Link href={`/chofer/recoleccion/${p.id}`} className="ch-parada-enlace">
                <div className="ch-parada-fila">
                  <div className="ch-parada-texto">
                    <div className="ch-parada-cliente">{p.cliente}</div>
                    {/* La dirección COMPLETA, no solo el alias: es lo que el
                        chofer lee para saber a dónde va. */}
                    <div className="ch-parada-dato ch-parada-dir">
                      <MapPin aria-hidden="true" />
                      <span>
                        {p.punto?.alias ? `${p.punto.alias} · ` : ""}
                        {p.direccionCompleta || p.direccion}
                      </span>
                    </div>
                    {p.referencias && (
                      <div className="ch-parada-dato ch-parada-ref">
                        <Signpost aria-hidden="true" /> <span>{p.referencias}</span>
                      </div>
                    )}
                    <div className="ch-parada-dato ch-parada-residuo">
                      <Recycle aria-hidden="true" /> {p.tipoResiduo || "Residuo sin especificar"}
                    </div>
                    <div className="ch-parada-dato">
                      {p.folio} · {p.unidad}
                    </div>
                    {p.nota && (
                      <div className="ch-parada-dato ch-parada-nota">“{p.nota}”</div>
                    )}
                  </div>
                  <CaretRight aria-hidden="true" className="ch-parada-flecha" />
                </div>
              </Link>
              {/* Primero "En camino" y después "Cómo llegar": es el orden en
                  que el chofer los usa al arrancar hacia el cliente. */}
              {p.estado === "confirmada" && (
                <button
                  type="button"
                  className="ch-en-camino"
                  onClick={() => enCamino(p)}
                  disabled={camino[p.id] === "enviando"}
                >
                  <Truck aria-hidden="true" weight="fill" />
                  {camino[p.id] === "enviando" ? "Avisando al cliente…" : "En camino"}
                </button>
              )}
              {p.estado === "en-ruta" && (
                <p className="ch-en-camino-listo" role="status">
                  <CheckCircle aria-hidden="true" weight="fill" /> {textoEnCamino(avisado[p.id])}
                </p>
              )}
              {camino[p.id] && camino[p.id] !== "enviando" && (
                <p className="ch-error" role="alert">{camino[p.id]}</p>
              )}
              {p.punto && (
                <a
                  className="ch-llegar"
                  href={enlaceComoLlegar(p.punto)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <NavigationArrow aria-hidden="true" weight="fill" /> Cómo llegar
                </a>
              )}
            </div>
          ))}
        </>
      )}

      {hechas.length > 0 && (
        <>
          <h2 className="ch-seccion ch-seccion-2">Completadas</h2>
          {hechas.map((p) => (
            <div key={p.id} className="ch-parada hecha">
              <div className="ch-parada-cliente">
                <CheckCircle aria-hidden="true" color="var(--mc-ok)" /> {p.cliente}
              </div>
              <div className="ch-parada-dato">
                {p.folio}
                {p.evidencia?.peso_kg ? ` · ${p.evidencia.peso_kg} kg` : ""}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Las que no procedieron también se ven: el chofer tiene que poder
          confirmar que el motivo quedó guardado antes de irse. */}
      {noProcedieron.length > 0 && (
        <>
          <h2 className="ch-seccion ch-seccion-2">No procedieron</h2>
          {noProcedieron.map((p) => (
            <div key={p.id} className="ch-parada hecha">
              <div className="ch-parada-cliente">
                <Prohibit aria-hidden="true" color="var(--mc-error)" /> {p.cliente}
              </div>
              <div className="ch-parada-dato">
                {p.folio}
                {p.motivoNoProcedio ? ` · ${p.motivoNoProcedio}` : ""}
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );
}
