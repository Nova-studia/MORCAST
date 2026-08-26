"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  MapPin,
  CheckCircle,
  CaretRight,
} from "@phosphor-icons/react/dist/ssr";
import { rutaDelDia, hoyISO } from "@/lib/datos-chofer";

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
  const hoy = hoyISO();

  useEffect(() => {
    let vivo = true;
    rutaDelDia(hoy).then((p) => {
      if (!vivo) return;
      setParadas(p);
      setCargando(false);
    });
    return () => {
      vivo = false;
    };
  }, [hoy]);

  const pendientes = paradas.filter((p) => p.estatus === "pendiente");
  const hechas = paradas.filter((p) => p.estatus === "completado");

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
            <strong>{hechas.length}</strong>
            <span>Hechas</span>
          </div>
          <div>
            <strong>{paradas.length}</strong>
            <span>Total</span>
          </div>
        </div>
      </div>

      {cargando && <div className="pt-vacio">Cargando tu ruta…</div>}

      {!cargando && paradas.length === 0 && (
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
            <Link key={p.id} href={`/chofer/recoleccion/${p.id}`} className="ch-parada">
              <div className="ch-parada-fila">
                <div className="ch-parada-texto">
                  <div className="ch-parada-cliente">{p.cliente}</div>
                  <div className="ch-parada-dato">
                    <MapPin aria-hidden="true" /> {p.direccion}
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
          ))}
        </>
      )}

      {hechas.length > 0 && (
        <>
          <h2 className="ch-seccion ch-seccion-2">Completadas</h2>
          {hechas.map((p) => (
            <div key={p.id} className="ch-parada hecha">
              <div className="ch-parada-cliente">
                <CheckCircle aria-hidden="true" color="#7cc576" /> {p.cliente}
              </div>
              <div className="ch-parada-dato">
                {p.folio}
                {p.evidencia?.peso_kg ? ` · ${p.evidencia.peso_kg} kg` : ""}
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );
}
