"use client";

import { useEffect, useState } from "react";
import { FiCheck, FiX } from "react-icons/fi";
import { ESTADOS_SOLICITUD_REC } from "@/lib/rutas-datos";
import { listarSolicitudes } from "@/lib/datos-solicitudes";
import { cambiarEstadoSolicitudAuditado } from "@/app/acciones-auditadas";

export default function RecoleccionesAdmin() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [filtro, setFiltro] = useState("todas");
  const [motivo, setMotivo] = useState({});
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(null); // folio en proceso
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    listarSolicitudes().then((lista) => {
      if (!vivo) return;
      setSolicitudes(lista);
      setCargando(false);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const badge = (id) => ESTADOS_SOLICITUD_REC.find((e) => e.id === id) || { texto: id, clase: "prog" };

  /**
   * Se guarda PRIMERO y se pinta después.
   *
   * Lo contrario (pintar y guardar en segundo plano) es más ágil, pero aquí
   * se está comprometiendo un camión a una fecha: si la escritura falla,
   * Morcast se habría quedado creyendo que confirmó un servicio que nadie
   * registró.
   */
  const aplicar = async (s, accion, cambiosLocales) => {
    setOcupado(s.folio);
    setError("");
    const r = await accion();
    if (!r.ok) {
      setError(`No se pudo guardar (${s.folio}). ${r.motivo || "Vuelve a intentarlo."}`);
      setOcupado(null);
      return;
    }
    setSolicitudes((lista) =>
      lista.map((x) => (x.folio === s.folio ? { ...x, ...cambiosLocales } : x))
    );
    setOcupado(null);
  };

  // Van por el servidor (no por el navegador) para que queden en la bitácora
  // y para que se cuenten las filas que devolvió la base: un UPDATE que el
  // RLS bloquea no da error, actualiza cero y responde que todo bien.
  const confirmar = (s) =>
    aplicar(
      s,
      () =>
        cambiarEstadoSolicitudAuditado(
          s.id,
          { estado: "confirmada", fecha_confirmada: s.fechaConfirmada || s.fechaPedida },
          "confirmar_recoleccion"
        ),
      { estado: "confirmada", fechaConfirmada: s.fechaPedida }
    );

  const rechazar = (s) => {
    const texto = motivo[s.folio] || "Sin cupo en la ruta.";
    return aplicar(
      s,
      () =>
        cambiarEstadoSolicitudAuditado(
          s.id,
          { estado: "rechazada", motivo_rechazo: texto },
          "rechazar_recoleccion"
        ),
      { estado: "rechazada", motivoRechazo: texto }
    );
  };

  const lista = filtro === "todas" ? solicitudes : solicitudes.filter((s) => s.estado === filtro);
  const porConfirmar = solicitudes.filter((s) => s.estado === "solicitada").length;

  return (
    <>
      <div className="pt-page-head">
        <h1>Recolecciones</h1>
        <p>
          {porConfirmar === 0
            ? "No hay solicitudes por confirmar."
            : `${porConfirmar} solicitud${porConfirmar === 1 ? "" : "es"} por confirmar.`}
        </p>
      </div>

      {error && (
        <div
          className="pt-card"
          style={{ borderColor: "#ef8080", color: "#ef8080", marginBottom: "1rem", fontSize: "0.9rem" }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1rem" }}>
        <button type="button" className={`pt-btn ${filtro === "todas" ? "pt-btn-naranja" : ""}`} onClick={() => setFiltro("todas")}>
          Todas
        </button>
        {ESTADOS_SOLICITUD_REC.map((e) => (
          <button
            key={e.id}
            type="button"
            className={`pt-btn ${filtro === e.id ? "pt-btn-naranja" : ""}`}
            onClick={() => setFiltro(e.id)}
          >
            {e.texto}
          </button>
        ))}
      </div>

      <div className="pt-card">
        {cargando ? (
          <div className="pt-vacio">Cargando recolecciones…</div>
        ) : lista.length === 0 ? (
          <div className="pt-vacio">No hay solicitudes con ese estado.</div>
        ) : (
          lista.map((s) => {
            const b = badge(s.estado);
            return (
              <div key={s.folio} style={{ borderTop: "1px solid var(--mc-linea)", padding: "0.9rem 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.7rem", flexWrap: "wrap" }}>
                  <div>
                    <strong>{s.folio}</strong>
                    <span style={{ color: "var(--mc-gris)", marginLeft: 8, fontSize: "0.88rem" }}>
                      {s.cliente}
                    </span>
                  </div>
                  <span className={`pt-badge ${b.clase}`}>{b.texto}</span>
                </div>

                <div style={{ fontSize: "0.84rem", color: "var(--mc-gris)", marginTop: 5 }}>
                  {s.domicilio} · {s.rutaNombre} · pedida para {s.fechaPedida} ·{" "}
                  {s.origen === "extra" ? "Extra" : "De ruta"}
                </div>

                {s.nota && (
                  <div style={{ fontSize: "0.84rem", color: "var(--mc-gris)", marginTop: 5, fontStyle: "italic" }}>
                    “{s.nota}”
                  </div>
                )}

                {s.motivoRechazo && (
                  <div style={{ fontSize: "0.84rem", color: "#f0895c", marginTop: 5 }}>
                    Rechazada: {s.motivoRechazo}
                  </div>
                )}

                {s.estado === "solicitada" && (
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.7rem", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="pt-btn pt-btn-verde"
                      onClick={() => confirmar(s)}
                      disabled={ocupado === s.folio}
                    >
                      <FiCheck /> {ocupado === s.folio ? "Guardando…" : "Confirmar"}
                    </button>
                    <input
                      className="pt-input"
                      placeholder="Motivo del rechazo"
                      value={motivo[s.folio] || ""}
                      onChange={(e) => setMotivo({ ...motivo, [s.folio]: e.target.value })}
                      style={{ flex: 1, minWidth: 180 }}
                    />
                    <button
                      type="button"
                      className="pt-btn"
                      onClick={() => rechazar(s)}
                      disabled={ocupado === s.folio}
                    >
                      <FiX /> Rechazar
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
