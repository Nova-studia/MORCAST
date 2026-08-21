"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { FiDownload, FiSearch, FiCamera } from "react-icons/fi";
import { fechaLarga, estatusInfo } from "@/lib/portal-datos";
import { misServicios } from "@/lib/datos-solicitudes";
import { descargarManifiesto } from "@/lib/portal-pdf";
import EvidenciaServicio from "@/components/portal/EvidenciaServicio";
import { clienteActual } from "@/lib/portal-sesion";

const FILTROS = [
  { id: "todos", texto: "Todos" },
  { id: "completado", texto: "Completados" },
  { id: "programado", texto: "Programados" },
  { id: "en-ruta", texto: "En ruta" },
];

export default function HistorialPortal() {
  const [filtro, setFiltro] = useState("todos");
  const [busca, setBusca] = useState("");
  const [bajando, setBajando] = useState(null);
  const [abierto, setAbierto] = useState(null);
  const [servicios, setServicios] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Los enlaces de las fotos vienen firmados y caducan, así que se piden al
  // abrir la pantalla, no se guardan.
  useEffect(() => {
    let vivo = true;
    misServicios().then((lista) => {
      if (!vivo) return;
      setServicios(lista);
      setCargando(false);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const filas = useMemo(() => {
    return servicios.filter((s) => {
      const pasaFiltro = filtro === "todos" || s.estatus === filtro;
      const q = busca.trim().toLowerCase();
      const pasaBusca =
        !q ||
        s.folio.toLowerCase().includes(q) ||
        s.tipo.toLowerCase().includes(q) ||
        s.residuo.toLowerCase().includes(q);
      return pasaFiltro && pasaBusca;
    }).sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
  }, [filtro, busca, servicios]);

  const bajarManifiesto = async (s) => {
    setBajando(s.folio);
    try {
      // Los datos fiscales salen de la SESIÓN. Antes iba `CLIENTE`, el de
      // ejemplo: cada manifiesto que bajaba un cliente llevaba impreso el
      // nombre y el RFC de otra empresa.
      const yo = await clienteActual();
      if (yo) await descargarManifiesto(s, yo);
    } finally {
      setBajando(null);
    }
  };

  return (
    <>
      <div className="pt-page-head">
        <h1>Historial de servicios</h1>
        <p>Consulta y descarga el manifiesto de cada recolección.</p>
      </div>

      <div className="pt-card">
        <div className="pt-card-head" style={{ flexWrap: "wrap" }}>
          <div className="pt-segmento">
            {FILTROS.map((f) => (
              <button
                key={f.id}
                className={filtro === f.id ? "activo" : ""}
                onClick={() => setFiltro(f.id)}
              >
                {f.texto}
              </button>
            ))}
          </div>
          <div style={{ position: "relative", flex: "0 1 260px" }}>
            <FiSearch style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--mc-gris)" }} />
            <input
              className="pt-input"
              style={{ paddingLeft: 34 }}
              placeholder="Buscar folio o residuo…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>

        <div className="pt-tabla-wrap">
          <table className="pt-tabla" style={{ minWidth: 820 }}>
            <thead>
              <tr>
                <th>Folio</th>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Residuo</th>
                <th>Contenedor</th>
                <th className="num">Peso</th>
                <th>Estatus</th>
                <th>Manifiesto</th>
              </tr>
            </thead>
            <tbody>
              {cargando && (
                <tr>
                  <td colSpan={8} className="pt-vacio">Cargando tus servicios…</td>
                </tr>
              )}
              {!cargando && filas.length === 0 && (
                <tr>
                  <td colSpan={8} className="pt-vacio">
                    {servicios.length === 0
                      ? "Todavía no tienes recolecciones completadas. Aquí aparecerán con su comprobante fotográfico."
                      : "Sin servicios que coincidan."}
                  </td>
                </tr>
              )}
              {filas.map((s) => {
                const est = estatusInfo(s.estatus);
                const expandido = abierto === s.folio;
                return (
                  <Fragment key={s.folio}>
                    <tr>
                      <td className="folio">{s.folio}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{fechaLarga(s.fecha)}</td>
                      <td>{s.tipo}</td>
                      <td>{s.residuo}</td>
                      <td>{s.contenedor}</td>
                      <td className="num">{s.peso}</td>
                      <td><span className={`pt-badge ${est.clase}`}>{est.texto}</span></td>
                      <td>
                        <div style={{ display: "flex", gap: "0.4rem" }}>
                          {s.evidencia && (
                            <button
                              className={`pt-btn ${expandido ? "pt-btn-verde" : ""}`}
                              onClick={() => setAbierto(expandido ? null : s.folio)}
                              title="Ver comprobante fotográfico"
                            >
                              <FiCamera />
                            </button>
                          )}
                          {s.manifiesto ? (
                            <button
                              className="pt-btn"
                              onClick={() => bajarManifiesto(s)}
                              disabled={bajando === s.folio}
                            >
                              <FiDownload />
                              {bajando === s.folio ? "Generando…" : "PDF"}
                            </button>
                          ) : (
                            <span style={{ color: "var(--mc-gris-claro)", fontSize: "0.82rem", alignSelf: "center" }}>Pendiente</span>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandido && s.evidencia && (
                      <tr>
                        <td colSpan={8} style={{ background: "var(--mc-fondo, transparent)", padding: "0.9rem" }}>
                          <div style={{ maxWidth: 560 }}>
                            <EvidenciaServicio evidencia={s.evidencia} />
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
