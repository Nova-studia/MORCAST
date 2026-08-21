"use client";

import { useEffect, useState } from "react";
import { FiDownload, FiFileText, FiFile } from "react-icons/fi";
import {
  fechaLarga,
} from "@/lib/portal-datos";
import { misServicios } from "@/lib/datos-solicitudes";
import { descargarManifiesto, descargarConstanciaFiscal } from "@/lib/portal-pdf";
import { clienteActual } from "@/lib/portal-sesion";

export default function DocumentosPortal() {
  const [bajando, setBajando] = useState(null);
  const [servicios, setServicios] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    misServicios({ conFotos: false }).then((l) => {
      if (!vivo) return;
      setServicios(l);
      setCargando(false);
    });
    return () => { vivo = false; };
  }, []);

  const manifiestos = servicios.filter((s) => s.manifiesto);

  const bajarConstancia = async () => {
    setBajando("csf");
    try {
      await descargarConstanciaFiscal();
    } finally {
      setBajando(null);
    }
  };

  const bajarManifiesto = async (s) => {
    setBajando(s.folio);
    try {
      const yo = await clienteActual();
      if (yo) await descargarManifiesto(s, yo);
    } finally {
      setBajando(null);
    }
  };

  return (
    <>
      <div className="pt-page-head">
        <h1>Documentos</h1>
        <p>Constancia fiscal y manifiestos de manejo de residuos en PDF.</p>
      </div>

      {/* Constancia fiscal */}
      <div className="pt-card" style={{ marginBottom: "1.1rem" }}>
        <div className="pt-card-head"><h2>Documentos fiscales</h2></div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            padding: "0.6rem 0",
          }}
        >
          <div className="pt-stat-icono teal" style={{ margin: 0 }}><FiFileText /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong>Constancia de Situación Fiscal</strong>
            <div style={{ color: "var(--mc-gris)", fontSize: "0.84rem" }}>
              Datos fiscales de Morcast del Norte, S.A. de C.V. para facturación.
            </div>
          </div>
          <button className="pt-btn pt-btn-verde" onClick={bajarConstancia} disabled={bajando === "csf"}>
            <FiDownload /> {bajando === "csf" ? "Generando…" : "Descargar PDF"}
          </button>
        </div>
      </div>

      {/* Manifiestos */}
      <div className="pt-card">
        <div className="pt-card-head">
          <h2>Manifiestos</h2>
          <span style={{ color: "var(--mc-gris)", fontSize: "0.85rem" }}>
            {manifiestos.length} documentos
          </span>
        </div>
        <div className="pt-tabla-wrap">
          <table className="pt-tabla" style={{ minWidth: 620 }}>
            <thead>
              <tr>
                <th>Manifiesto</th>
                <th>Fecha</th>
                <th>Servicio</th>
                <th>Peso</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {manifiestos.map((s) => (
                <tr key={s.manifiesto}>
                  <td className="folio"><FiFile style={{ verticalAlign: "-2px", marginRight: 6 }} />{s.manifiesto}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{fechaLarga(s.fecha)}</td>
                  <td>{s.tipo}</td>
                  <td>{s.peso}</td>
                  <td>
                    <button className="pt-btn" onClick={() => bajarManifiesto(s)} disabled={bajando === s.folio}>
                      <FiDownload /> {bajando === s.folio ? "Generando…" : "PDF"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
