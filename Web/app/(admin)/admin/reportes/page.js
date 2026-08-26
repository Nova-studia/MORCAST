"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DownloadSimple,
  CurrencyDollar,
  TrendUp,
  Medal,
} from "@phosphor-icons/react/dist/ssr";
import { ADMIN_INGRESOS, embudoSolicitudes } from "@/lib/admin-datos";
import { reportes } from "@/lib/datos-reportes";
import { listarCotizaciones } from "@/lib/datos-cotizaciones";
import { pesos } from "@/lib/portal-datos";
import { descargarReporteNegocio } from "@/lib/portal-pdf";

/** Toneladas, no pesos. Formatear un peso recolectado como dinero era decir
 *  "$1.25" para 1.25 toneladas: un dato correcto con la etiqueta equivocada. */
const ton = (n) => `${Number(n || 0).toLocaleString("es-MX", { maximumFractionDigits: 2 })} ton`;

export default function ReportesAdmin() {
  const [bajando, setBajando] = useState(false);
  const [rep, setRep] = useState(null);
  const [cotizaciones, setCotizaciones] = useState([]);

  useEffect(() => {
    let vivo = true;
    Promise.all([reportes(), listarCotizaciones()]).then(([r, c]) => {
      if (!vivo) return;
      setRep(r);
      setCotizaciones(c);
    });
    return () => { vivo = false; };
  }, []);

  // Se grafica el PESO recolectado por mes, no los ingresos: el peso lo
  // registra el chofer en cada servicio; la facturacion todavia no vive en el
  // sistema y graficar ceros con etiqueta de dinero solo confunde.
  const serie = rep ? rep.mensual.map((d) => ({ periodo: d.periodo, monto: d.volumen })) : ADMIN_INGRESOS;
  const max = Math.max(...serie.map((d) => d.monto), 1);
  const total = serie.reduce((a, d) => a + d.monto, 0);
  const promedio = serie.length ? total / serie.length : 0;
  const mejor = serie.length
    ? serie.reduce((a, d) => (d.monto > a.monto ? d : a), serie[0])
    : { periodo: "—", monto: 0 };
  const embudo = useMemo(() => embudoSolicitudes(cotizaciones), [cotizaciones]);
  const ganadas = embudo.find((e) => e.id === "ganada")?.total || 0;
  // Iba `SOLICITUDES.length`, y esa variable NO EXISTE en este archivo: la
  // pantalla entera reventaba al pintarse ("This page couldn't load"), sin
  // dejar ni un mensaje en la consola. `next build` no lo detecta.
  // Son las solicitudes de cotización que ya están cargadas aquí arriba.
  const totalSol = cotizaciones.length;
  const conversion = totalSol ? Math.round((ganadas / totalSol) * 100) : 0;

  const exportar = async () => {
    setBajando(true);
    try {
      await descargarReporteNegocio("Reporte de peso recolectado por mes (toneladas)", serie, total);
    } finally {
      setBajando(false);
    }
  };

  return (
    <>
      <div className="pt-page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1>Reportes del negocio</h1>
          <p>Peso recolectado y desempeño comercial de los últimos 12 meses.</p>
        </div>
        <button className="pt-btn pt-btn-naranja" onClick={exportar} disabled={bajando}>
          <DownloadSimple /> {bajando ? "Generando…" : "Exportar PDF"}
        </button>
      </div>

      <div className="pt-grid pt-grid-3" style={{ marginBottom: "1.1rem" }}>
        <div className="pt-stat">
          <div className="pt-stat-icono"><CurrencyDollar /></div>
          <div className="pt-stat-etiqueta">Recolectado 12 meses</div>
          <div className="pt-stat-valor">{ton(total)}</div>
          <div className="pt-stat-sub">Promedio {ton(promedio)} / mes</div>
        </div>
        <div className="pt-stat">
          <div className="pt-stat-icono teal"><Medal /></div>
          <div className="pt-stat-etiqueta">Mejor mes</div>
          <div className="pt-stat-valor">{mejor.periodo}</div>
          <div className="pt-stat-sub">{ton(mejor.monto)}</div>
        </div>
        <div className="pt-stat">
          <div className="pt-stat-icono naranja"><TrendUp /></div>
          <div className="pt-stat-etiqueta">Conversión</div>
          <div className="pt-stat-valor">{conversion}%</div>
          <div className="pt-stat-sub">{ganadas} de {totalSol} solicitudes ganadas</div>
        </div>
      </div>

      <div className="pt-card" style={{ marginBottom: "1.1rem" }}>
        <div className="pt-card-head"><h2>Peso recolectado por mes</h2></div>
        <div className="pt-bars">
          {serie.map((d) => (
            <div className="pt-bar-col" key={d.periodo}>
              <div className="pt-bar-track">
                <div className="pt-bar naranja" style={{ height: `${(d.monto / max) * 100}%` }} title={ton(d.monto)} />
              </div>
              <div className="pt-bar-label">{d.periodo}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-card">
        <div className="pt-card-head"><h2>Detalle</h2></div>
        <div className="pt-tabla-wrap">
          <table className="pt-tabla" style={{ minWidth: 360 }}>
            <thead>
              <tr><th>Periodo</th><th className="num">Recolectado</th></tr>
            </thead>
            <tbody>
              {serie.map((d) => (
                <tr key={d.periodo}><td>{d.periodo}</td><td className="num">{ton(d.monto)}</td></tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700 }}><td>Total</td><td className="num">{ton(total)}</td></tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  );
}
