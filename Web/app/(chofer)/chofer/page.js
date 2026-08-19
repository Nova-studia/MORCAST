"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FiMapPin, FiCheckCircle, FiChevronRight } from "react-icons/fi";
import { rutaDelDia, hoyISO } from "@/lib/datos-chofer";

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
      <div className="pt-page-head">
        <h1>Mi ruta de hoy</h1>
        <p>{hoy}</p>
      </div>

      <div className="ch-resumen">
        <div>
          <strong>{pendientes.length}</strong>
          <span>Por recolectar</span>
        </div>
        <div>
          <strong style={{ color: "var(--mc-verde-claro)" }}>{hechas.length}</strong>
          <span>Completadas</span>
        </div>
        <div>
          <strong>{paradas.length}</strong>
          <span>Total</span>
        </div>
      </div>

      {cargando && <div className="pt-vacio">Cargando tu ruta…</div>}

      {!cargando && paradas.length === 0 && (
        <div className="pt-card">
          <div className="pt-vacio">
            No tienes paradas asignadas para hoy. Si esperabas alguna, avisa a la
            oficina: puede que la recolección todavía no esté confirmada.
          </div>
        </div>
      )}

      {pendientes.length > 0 && (
        <>
          <h2 style={{ fontSize: "0.95rem", margin: "0.4rem 0 0.6rem" }}>Por recolectar</h2>
          {pendientes.map((p) => (
            <Link key={p.id} href={`/chofer/recoleccion/${p.id}`} className="ch-parada">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.6rem" }}>
                <div style={{ minWidth: 0 }}>
                  <div className="ch-parada-cliente">{p.cliente}</div>
                  <div className="ch-parada-dato">
                    <FiMapPin aria-hidden="true" /> {p.direccion}
                  </div>
                  <div className="ch-parada-dato">
                    {p.folio} · {p.unidad}
                  </div>
                  {p.nota && (
                    <div className="ch-parada-dato" style={{ fontStyle: "italic" }}>
                      “{p.nota}”
                    </div>
                  )}
                </div>
                <FiChevronRight aria-hidden="true" style={{ flexShrink: 0 }} />
              </div>
            </Link>
          ))}
        </>
      )}

      {hechas.length > 0 && (
        <>
          <h2 style={{ fontSize: "0.95rem", margin: "1.2rem 0 0.6rem" }}>Completadas</h2>
          {hechas.map((p) => (
            <div key={p.id} className="ch-parada hecha">
              <div className="ch-parada-cliente">
                <FiCheckCircle aria-hidden="true" color="#7cc576" /> {p.cliente}
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
