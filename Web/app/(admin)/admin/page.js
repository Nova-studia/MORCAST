"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FiDollarSign, FiInbox, FiUsers, FiTruck, FiArrowRight, FiTrendingUp } from "react-icons/fi";
import {
  ADMIN_KPIS,
  embudoSolicitudes,
  infoEstado,
} from "@/lib/admin-datos";
import { listarCotizaciones } from "@/lib/datos-cotizaciones";
import { kpisAdmin, cobranza12Meses } from "@/lib/datos-panel";
import { pesos, fechaLarga, folioCorto } from "@/lib/portal-datos";

export default function PanelAdmin() {
  const [kpis, setKpis] = useState(ADMIN_KPIS);
  const [solicitudes, setSolicitudes] = useState([]);
  const [cobranza, setCobranza] = useState({ serie: [], hayDatos: false });

  useEffect(() => {
    let vivo = true;
    Promise.all([kpisAdmin(), listarCotizaciones(), cobranza12Meses()]).then(([k, c, co]) => {
      if (!vivo) return;
      setKpis(k);
      setSolicitudes(c);
      setCobranza(co);
    });
    return () => { vivo = false; };
  }, []);

  const max = Math.max(...cobranza.serie.map((d) => d.monto), 1);
  const totalCobrado = cobranza.serie.reduce((a, d) => a + d.monto, 0);
  const embudo = embudoSolicitudes(solicitudes);
  const maxEmbudo = Math.max(...embudo.map((e) => e.total), 1);
  const recientes = [...solicitudes].sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0)).slice(0, 5);
  // Sin mes anterior con que comparar, el cambio porcentual no significa nada.
  const delta = kpis.ingresosMesAnterior
    ? ((kpis.ingresosMes - kpis.ingresosMesAnterior) / kpis.ingresosMesAnterior) * 100
    : 0;

  return (
    <>
      <div className="pt-page-head">
        <h1>Panel del negocio</h1>
        <p>Resumen de la operación de Morcast del Norte.</p>
      </div>

      {/* KPIs */}
      <div className="pt-grid pt-grid-4" style={{ marginBottom: "1.1rem" }}>
        <div className="pt-stat">
          <div className="pt-stat-icono"><FiDollarSign /></div>
          <div className="pt-stat-etiqueta">Ingresos del mes</div>
          <div className="pt-stat-valor">{pesos(kpis.ingresosMes)}</div>
          <div className="pt-stat-sub" style={{ color: delta >= 0 ? "#6fce69" : "#f0895c" }}>
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}% vs mes anterior
          </div>
        </div>
        <div className="pt-stat">
          <div className="pt-stat-icono naranja"><FiInbox /></div>
          <div className="pt-stat-etiqueta">Solicitudes nuevas</div>
          <div className="pt-stat-valor">{kpis.solicitudesNuevas}</div>
          <div className="pt-stat-sub">Sin atender</div>
        </div>
        <div className="pt-stat">
          <div className="pt-stat-icono teal"><FiUsers /></div>
          <div className="pt-stat-etiqueta">Clientes activos</div>
          <div className="pt-stat-valor">{kpis.clientesActivos}</div>
          <div className="pt-stat-sub">Con contrato vigente</div>
        </div>
        <div className="pt-stat">
          <div className="pt-stat-icono"><FiTruck /></div>
          <div className="pt-stat-etiqueta">Servicios del mes</div>
          <div className="pt-stat-valor">{kpis.serviciosMes}</div>
          <div className="pt-stat-sub">Por cobrar {pesos(kpis.porCobrar)}</div>
        </div>
      </div>

      {/* Ingresos + embudo */}
      <div className="pt-grid pt-grid-2" style={{ marginBottom: "1.1rem", gridTemplateColumns: "2fr 1.2fr" }}>
        <div className="pt-card">
          <div className="pt-card-head">
            <h2>Cobranza (12 meses)</h2>
            <span className="pt-badge ok"><FiTrendingUp style={{ marginRight: 2 }} /> {pesos(totalCobrado)}</span>
          </div>
          {!cobranza.hayDatos && (
            <p style={{ fontSize: "0.82rem", color: "var(--mc-gris)", marginTop: "-0.2rem" }}>
              Son los depósitos que Morcast ya verificó. Todavía no hay ninguno aplicado,
              por eso las barras salen en cero.
            </p>
          )}
          <div className="pt-bars">
            {cobranza.serie.map((d, i) => (
              <div className="pt-bar-col" key={`${d.periodo}-${i}`}>
                <div className="pt-bar-track">
                  <div className="pt-bar naranja" style={{ height: `${(d.monto / max) * 100}%` }} title={pesos(d.monto)} />
                </div>
                <div className="pt-bar-label">{d.periodo}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-card">
          <div className="pt-card-head"><h2>Embudo de solicitudes</h2></div>
          {embudo.map((e) => (
            <div key={e.id} style={{ marginBottom: "0.85rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "0.3rem" }}>
                <span><span className={`pt-badge ${e.clase}`}>{e.texto}</span></span>
                <strong>{e.total}</strong>
              </div>
              <div className="pt-saldo-barra" style={{ margin: 0, background: "rgba(255,255,255,0.06)" }}>
                <span style={{ width: `${(e.total / maxEmbudo) * 100}%`, background: "var(--mc-teal-claro)" }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Solicitudes recientes */}
      <div className="pt-card">
        <div className="pt-card-head">
          <h2>Solicitudes recientes</h2>
          <Link href="/admin/solicitudes" className="pt-btn">Ver todas <FiArrowRight /></Link>
        </div>
        <div className="pt-tabla-wrap">
          <table className="pt-tabla" style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th>Folio</th>
                <th>Fecha</th>
                <th>Empresa</th>
                <th>Servicio</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {recientes.map((s) => {
                const est = infoEstado(s.estado);
                return (
                  <tr key={s.id}>
                    <td className="folio" title={s.id}>{folioCorto(s.id)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{fechaLarga(s.fecha)}</td>
                    <td>{s.empresa}</td>
                    <td>{s.servicio}</td>
                    <td><span className={`pt-badge ${est.clase}`}>{est.texto}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
