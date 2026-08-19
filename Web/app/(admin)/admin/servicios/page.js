"use client";

import { useEffect, useMemo, useState } from "react";
import { FiX, FiCamera } from "react-icons/fi";
import { AGENDA_SERVICIOS, agendaDesdeBase } from "@/lib/admin-datos";
import { listarSolicitudes, misServicios } from "@/lib/datos-solicitudes";
import { estatusInfo, fechaLarga } from "@/lib/portal-datos";
import { haySupabaseNavegador } from "@/lib/supabase-navegador";
import EvidenciaServicio from "@/components/portal/EvidenciaServicio";

const FILTROS = [
  { id: "todos", texto: "Todos" },
  { id: "programado", texto: "Programados" },
  { id: "en-ruta", texto: "En ruta" },
  { id: "completado", texto: "Completados" },
];

export default function ServiciosAdmin() {
  const [filtro, setFiltro] = useState("todos");
  const [sel, setSel] = useState(null);

  const [solicitudes, setSolicitudes] = useState([]);
  const [conEvidencia, setConEvidencia] = useState([]);

  useEffect(() => {
    let vivo = true;
    Promise.all([listarSolicitudes(), misServicios()]).then(([l, ev]) => {
      if (!vivo) return;
      setSolicitudes(l);
      setConEvidencia(ev);
    });
    return () => {
      vivo = false;
    };
  }, []);

  // La agenda sale de la base. `AGENDA_SERVICIOS` solo entra en modo
  // demostración (sin variables de Supabase).
  //
  // Antes se pegaba SIEMPRE, con el argumento de que solo los servicios de
  // ejemplo traían evidencia fotográfica. Eso ya no es cierto —la evidencia
  // real se engancha aquí abajo— y el resultado era que la agenda de Morcast
  // mostraba media docena de servicios de empresas que no existen, mezclados
  // con los de verdad.
  const agenda = useMemo(() => {
    // Se le pega a cada servicio su comprobante fotográfico. Sin esto, el
    // admin veía las filas reales pero no podía abrir las fotos del chofer.
    const porFolio = Object.fromEntries(conEvidencia.map((s) => [s.folio, s]));
    const base = agendaDesdeBase(solicitudes).map((s) => {
      const ev = porFolio[s.folio];
      return ev ? { ...s, evidencia: ev.evidencia, peso: ev.peso } : s;
    });
    return haySupabaseNavegador() ? base : [...base, ...AGENDA_SERVICIOS];
  }, [solicitudes, conEvidencia]);

  const filas = useMemo(
    () =>
      agenda.filter((s) => filtro === "todos" || s.estatus === filtro).sort((a, b) => {
        // Mas reciente arriba. Cuando dos caen el MISMO dia se desempata por
        // folio, que es correlativo: sin eso, el servicio que acaba de
        // registrar el chofer aparecia hasta abajo de su propio dia y parecia
        // que no se habia guardado.
        if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
        return String(a.folio) < String(b.folio) ? 1 : -1;
      }),
    [agenda, filtro]
  );

  return (
    <>
      <div className="pt-page-head">
        <h1>Agenda de servicios</h1>
        <p>Todos los servicios programados y realizados de la flota. Abre un servicio completado para ver el comprobante fotográfico del chofer.</p>
      </div>

      <div className="pt-segmento" style={{ marginBottom: "1.1rem", flexWrap: "wrap" }}>
        {FILTROS.map((f) => (
          <button key={f.id} className={filtro === f.id ? "activo" : ""} onClick={() => { setFiltro(f.id); setSel(null); }}>
            {f.texto}
          </button>
        ))}
      </div>

      <div className={`pt-grid ${sel ? "pt-grid-detalle" : ""}`} style={{ gap: "1.1rem" }}>
        <div className="pt-card">
          <div className="pt-tabla-wrap">
            <table className="pt-tabla" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Servicio</th>
                  <th>Unidad</th>
                  <th>Operador</th>
                  <th>Estatus</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((s) => {
                  const est = estatusInfo(s.estatus);
                  const conEvi = !!s.evidencia;
                  return (
                    <tr
                      key={s.folio}
                      onClick={() => conEvi && setSel(s)}
                      style={{ cursor: conEvi ? "pointer" : "default", background: sel?.folio === s.folio ? "rgba(219,101,45,0.08)" : undefined }}
                    >
                      <td className="folio">{s.folio}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{fechaLarga(s.fecha)}</td>
                      <td>{s.cliente}</td>
                      <td>{s.tipo}</td>
                      <td>{s.unidad}</td>
                      <td>{s.operador}</td>
                      <td>
                        <span className={`pt-badge ${est.clase}`}>{est.texto}</span>
                        {conEvi && (
                          <FiCamera title="Con comprobante fotográfico" style={{ marginLeft: 8, verticalAlign: "-2px", color: "var(--mc-verde-claro)" }} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Panel de comprobante */}
        {sel && (
          <div className="pt-card" style={{ position: "sticky", top: 90 }}>
            <div className="pt-card-head">
              <h2>{sel.folio}</h2>
              <button className="pt-btn" onClick={() => setSel(null)} aria-label="Cerrar"><FiX /></button>
            </div>
            <div style={{ fontSize: "0.86rem", marginBottom: "0.9rem" }}>
              <strong style={{ display: "block", fontSize: "1rem" }}>{sel.cliente}</strong>
              <span style={{ color: "var(--mc-gris)" }}>{sel.tipo} · {sel.unidad} · Chofer {sel.operador}</span>
            </div>
            <EvidenciaServicio evidencia={sel.evidencia} />
            <p style={{ color: "var(--mc-gris)", fontSize: "0.78rem", marginTop: "0.8rem", marginBottom: 0 }}>
              Este comprobante también lo ve el cliente en su reporte diario.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
