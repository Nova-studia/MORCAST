"use client";

import IconoAnimado from "@/components/IconoAnimado";

import { useEffect, useMemo, useState } from "react";
import {
  DownloadSimple,
  TrendUp,
  Package,
  CurrencyDollar,
} from "@phosphor-icons/react/dist/ssr";
import {
  REPORTE_DIARIO,
  REPORTE_MENSUAL,
  REPORTE_ANUAL,
  pesos,
} from "@/lib/portal-datos";
import { reportes } from "@/lib/datos-reportes";
import { descargarReportePDF } from "@/lib/portal-pdf";
import { clienteActual } from "@/lib/portal-sesion";
import { enHold } from "@/lib/estado-sistema";

const VISTAS = {
  diario: { titulo: "Reporte diario", sub: "Últimos 14 días", datos: REPORTE_DIARIO, metrica: "monto" },
  mensual: { titulo: "Reporte mensual", sub: "Últimos 12 meses", datos: REPORTE_MENSUAL, metrica: "monto" },
  anual: { titulo: "Reporte anual", sub: "Últimos 4 años", datos: REPORTE_ANUAL, metrica: "monto" },
};

export default function ReportesPortal() {
  const [vista, setVista] = useState("mensual");
  // Arranca en PESO, no en dinero: el peso sale de lo que registro el chofer,
  // el dinero todavia no tiene de donde salir.
  const [metrica, setMetrica] = useState("volumen"); // monto | volumen
  const [bajando, setBajando] = useState(false);
  const [datosReales, setDatosReales] = useState(null);

  useEffect(() => {
    let vivo = true;
    reportes().then((r) => { if (vivo) setDatosReales(r); });
    return () => { vivo = false; };
  }, []);

  const cfg = VISTAS[vista];
  const datos = datosReales ? datosReales[vista] : cfg.datos;

  const max = useMemo(
    () => Math.max(...datos.map((d) => d[metrica]), 1),
    [datos, metrica]
  );
  const totales = useMemo(
    () => ({
      volumen: datos.reduce((a, d) => a + d.volumen, 0),
      monto: datos.reduce((a, d) => a + d.monto, 0),
    }),
    [datos]
  );
  const promedio = totales[metrica] / datos.length;

  const exportar = async () => {
    setBajando(true);
    try {
      const yo = await clienteActual();
      if (yo) await descargarReportePDF(cfg.titulo, datos, yo, totales);
    } finally {
      setBajando(false);
    }
  };

  return (
    <>
      <div className="pt-page-head">
        <h1>Reportes</h1>
        <p>Peso recolectado por periodo, tomado de lo que registra el chofer en cada servicio.</p>
      </div>

      <div className="pt-card-head" style={{ marginBottom: "1.1rem" }}>
        <div className="pt-segmento">
          <button className={vista === "diario" ? "activo" : ""} onClick={() => setVista("diario")}>Diario</button>
          <button className={vista === "mensual" ? "activo" : ""} onClick={() => setVista("mensual")}>Mensual</button>
          <button className={vista === "anual" ? "activo" : ""} onClick={() => setVista("anual")}>Anual</button>
        </div>
        {!enHold() && (
          <button className="pt-btn pt-btn-verde" onClick={exportar} disabled={bajando}>
            <DownloadSimple /> {bajando ? "Generando…" : "Exportar PDF"}
          </button>
        )}
      </div>

      {/* KPIs del periodo */}
      <div className="pt-grid pt-grid-3" style={{ marginBottom: "1.1rem" }}>
        <div className="pt-stat">
          {/* "Facturación" es el único KPI sin GIF propio: se usa el de
              "Por pagar", que es el mismo asunto —dinero de la cuenta— y
              así la fila no queda con dos dibujos y un icono de línea. */}
          <div className="pt-stat-icono desnudo"><IconoAnimado nombre="por-pagar" tam={44} /></div>
          <div className="pt-stat-etiqueta">Facturación</div>
          <div className="pt-stat-valor">{enHold() ? "—" : pesos(totales.monto)}</div>
          <div className="pt-stat-sub">{cfg.sub}</div>
        </div>
        <div className="pt-stat">
          <div className="pt-stat-icono desnudo"><IconoAnimado nombre="peso-total-recolectado" tam={44} /></div>
          <div className="pt-stat-etiqueta">Peso total recolectado</div>
          <div className="pt-stat-valor">{totales.volumen.toLocaleString("es-MX")} ton</div>
          <div className="pt-stat-sub">{cfg.sub}</div>
        </div>
        <div className="pt-stat">
          <div className="pt-stat-icono desnudo"><IconoAnimado nombre="promedio-por-periodo" tam={44} /></div>
          <div className="pt-stat-etiqueta">Promedio por periodo</div>
          <div className="pt-stat-valor">
            {metrica === "monto" ? (enHold() ? "—" : pesos(promedio)) : `${promedio.toFixed(2)} ton`}
          </div>
          <div className="pt-stat-sub">{datos.length} periodos</div>
        </div>
      </div>

      {/* Gráfica */}
      <div className="pt-card" style={{ marginBottom: "1.1rem" }}>
        <div className="pt-card-head">
          <h2>{cfg.titulo}</h2>
          <div className="pt-segmento">
            <button className={metrica === "monto" ? "activo" : ""} onClick={() => setMetrica("monto")} title="La facturacion todavia no esta en el sistema">Monto</button>
            <button className={metrica === "volumen" ? "activo" : ""} onClick={() => setMetrica("volumen")}>Peso</button>
          </div>
        </div>
        <div className="pt-bars">
          {datos.map((d) => (
            <div className="pt-bar-col" key={d.periodo}>
              <div className="pt-bar-track">
                <div
                  className="pt-bar"
                  style={{ height: `${(d[metrica] / max) * 100}%` }}
                  title={metrica === "monto" ? (enHold() ? "—" : pesos(d.monto)) : `${d.volumen} ton`}
                />
              </div>
              <div className="pt-bar-label">{d.periodo}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabla detalle. La nota usa el interruptor central `enHold()` en vez
          del `hayFacturacion` suelto que traía esta pantalla: son la misma
          idea, pero con el Hold ya no hace falta que cada pantalla decida
          por su cuenta si hay o no facturación. */}
      {enHold() && (
        <p className="pt-nota-demo">
          Los importes aparecerán aquí en cuanto empiece la facturación.
          Los servicios y sus fechas sí son reales.
        </p>
      )}

      <div className="pt-card">
        <div className="pt-card-head"><h2>Detalle</h2></div>
        <div className="pt-tabla-wrap">
          <table className="pt-tabla" style={{ minWidth: 420 }}>
            <thead>
              <tr>
                <th>Periodo</th>
                <th className="num">Peso (ton)</th>
                <th className="num">Monto</th>
              </tr>
            </thead>
            <tbody>
              {datos.map((d) => (
                <tr key={d.periodo}>
                  <td>{d.periodo}</td>
                  <td className="num">{d.volumen.toLocaleString("es-MX")}</td>
                  <td className="num">{enHold() ? "—" : pesos(d.monto)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700 }}>
                <td>Total</td>
                <td className="num">{totales.volumen.toLocaleString("es-MX")}</td>
                <td className="num">{enHold() ? "—" : pesos(totales.monto)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  );
}
