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
import { pesoRealActivo } from "@/lib/estado-sistema";

/** Toneladas, no pesos. Formatear un peso recolectado como dinero era decir
 *  "$1.25" para 1.25 toneladas: un dato correcto con la etiqueta equivocada. */
const ton = (n) => `${Number(n || 0).toLocaleString("es-MX", { maximumFractionDigits: 2 })} ton`;

export default function ReportesAdmin() {
  const [bajando, setBajando] = useState(false);
  const [rep, setRep] = useState(null);
  const [cotizaciones, setCotizaciones] = useState([]);

  useEffect(() => {
    let vivo = true;
    Promise.all([reportes({ sinPruebas: true }), listarCotizaciones()]).then(([r, c]) => {
      if (!vivo) return;
      setRep(r);
      setCotizaciones(c);
    });
    return () => { vivo = false; };
  }, []);

  // Se grafica el PESO recolectado por mes, no los ingresos: el peso lo
  // registra el chofer en cada servicio; la facturacion todavia no vive en el
  // sistema y graficar ceros con etiqueta de dinero solo confunde.
  //
  // Cada mes trae qué parte de su peso es REAL (báscula del relleno, por
  // viaje o por recolección) y qué parte es el ESTIMADO del chofer. Se
  // enseñan las dos: un total que mezcla las dos sin decirlo se lee como si
  // todo fuera de báscula, y el dueño cobra por tonelada.
  const serie = rep
    ? rep.mensual.map((d) => ({ periodo: d.periodo, monto: d.volumen, real: d.real || 0, estimado: d.estimado || 0 }))
    : ADMIN_INGRESOS;
  const max = Math.max(...serie.map((d) => d.monto), 1);
  const total = serie.reduce((a, d) => a + d.monto, 0);
  const totalReal = serie.reduce((a, d) => a + (d.real || 0), 0);
  const totalEstimado = serie.reduce((a, d) => a + (d.estimado || 0), 0);
  const pctReal = total ? Math.round((totalReal / total) * 100) : 0;
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
          <p>
            Peso recolectado y desempeño comercial de los últimos 12 meses. El peso es
            el real de la báscula del relleno donde ya se registró; donde no, el
            estimado del chofer.
          </p>
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
          {total > 0 && (
            <div className="pt-stat-sub">
              {pctReal}% real de báscula · {ton(totalEstimado)} estimado
            </div>
          )}
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
        {/* Doce columnas vacias sin una palabra parecen una grafica rota. El
            Panel ya resolvia esto mismo con una linea; aqui faltaba. */}
        {total === 0 && (
          <p style={{ fontSize: "0.82rem", color: "var(--mc-gris)", marginTop: "-0.2rem" }}>
            Todavía no hay recolecciones con peso registrado, por eso las barras
            salen en cero.
          </p>
        )}
        {/* Barra apilada: abajo lo real, arriba (más tenue) lo estimado. El
            mismo tono en las dos porque es la misma cosa —peso recolectado—
            medida con distinta certeza; dos colores harían pensar en dos
            residuos distintos. */}
        <div className="pt-bars">
          {serie.map((d) => (
            <div className="pt-bar-col" key={d.periodo}>
              <div className="pt-bar-track">
                {d.monto > 0 ? (
                  <div
                    style={{ height: `${(d.monto / max) * 100}%`, width: "100%", display: "flex", flexDirection: "column" }}
                    title={`${ton(d.monto)} · real ${ton(d.real)} · estimado ${ton(d.estimado)}`}
                  >
                    {d.estimado > 0 && (
                      <div className="pt-bar naranja" style={{ flex: d.estimado, minHeight: 0, opacity: 0.38 }} />
                    )}
                    {d.real > 0 && (
                      <div
                        className="pt-bar naranja"
                        style={{ flex: d.real, minHeight: 0, borderRadius: d.estimado > 0 ? 0 : undefined }}
                      />
                    )}
                  </div>
                ) : (
                  <div className="pt-bar naranja" style={{ height: 0 }} title={ton(0)} />
                )}
              </div>
              <div className="pt-bar-label">{d.periodo}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: "1.2rem", flexWrap: "wrap", marginTop: "0.9rem", fontSize: "0.8rem", color: "var(--mc-gris)" }}>
          {pesoRealActivo() && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span className="pt-bar naranja" style={{ width: 12, height: 12, minHeight: 0, borderRadius: 3 }} />
              Real: báscula del relleno
            </span>
          )}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span className="pt-bar naranja" style={{ width: 12, height: 12, minHeight: 0, borderRadius: 3, opacity: 0.38 }} />
            {pesoRealActivo() ? "Estimado del chofer (aún sin peso real)" : "Estimado del chofer"}
          </span>
        </div>
      </div>

      <div className="pt-card">
        <div className="pt-card-head"><h2>Detalle</h2></div>
        <div className="pt-tabla-wrap">
          <table className="pt-tabla" style={{ minWidth: 420 }}>
            <thead>
              <tr>
                <th>Periodo</th>
                <th className="num">Real</th>
                <th className="num">Estimado</th>
                <th className="num">Recolectado</th>
              </tr>
            </thead>
            <tbody>
              {serie.map((d) => (
                <tr key={d.periodo}>
                  <td>{d.periodo}</td>
                  <td className="num">{ton(d.real)}</td>
                  <td className="num" style={{ color: "var(--mc-gris)" }}>{ton(d.estimado)}</td>
                  <td className="num">{ton(d.monto)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700 }}>
                <td>Total</td>
                <td className="num">{ton(totalReal)}</td>
                <td className="num">{ton(totalEstimado)}</td>
                <td className="num">{ton(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  );
}
