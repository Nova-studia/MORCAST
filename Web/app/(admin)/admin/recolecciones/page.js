"use client";

import { useEffect, useState } from "react";
import { FiCheck, FiX } from "react-icons/fi";
import { ESTADOS_SOLICITUD_REC } from "@/lib/rutas-datos";
import { listarSolicitudes } from "@/lib/datos-solicitudes";
import { listarOperadores } from "@/lib/datos-clientes";
import { cambiarEstadoSolicitudAuditado } from "@/app/acciones-auditadas";

export default function RecoleccionesAdmin() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [filtro, setFiltro] = useState("todas");
  const [motivo, setMotivo] = useState({});
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(null); // folio en proceso
  const [error, setError] = useState("");
  const [choferes, setChoferes] = useState([]);
  // Lo que el admin decide al confirmar, por folio: { fecha, hora, choferId }.
  // Antes no se decidía nada: se confirmaba con la fecha que hubiera pedido el
  // cliente, sin hora y con el chofer que trajera la ruta.
  const [plan, setPlan] = useState({});

  const planDe = (s) => plan[s.folio] || { fecha: s.fechaConfirmada || s.fechaPedida, hora: "", choferId: "" };
  const setPlanDe = (folio, patch) =>
    setPlan((p) => ({ ...p, [folio]: { ...(p[folio] || {}), ...patch } }));

  useEffect(() => {
    let vivo = true;
    listarOperadores().then((o) => { if (vivo) setChoferes(o); });
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
  const confirmar = (s) => {
    const p = planDe(s);
    const chofer = choferes.find((c) => c.id === p.choferId);
    return aplicar(
      s,
      () =>
        cambiarEstadoSolicitudAuditado(
          s.id,
          {
            estado: "confirmada",
            fecha_confirmada: p.fecha || s.fechaPedida,
            // Nulos a propósito cuando no se eligen: "sin hora" y "el de la
            // ruta" son respuestas válidas, no campos a medio llenar.
            hora_confirmada: p.hora || null,
            chofer_id: p.choferId || null,
          },
          "confirmar_recoleccion"
        ),
      {
        estado: "confirmada",
        fechaConfirmada: p.fecha || s.fechaPedida,
        horaConfirmada: p.hora || "",
        choferId: p.choferId || null,
        choferAsignado: chofer?.nombre || "",
        choferEfectivo: chofer?.nombre || s.chofer,
      }
    );
  };

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

                {s.fechaConfirmada && (
                  <div style={{ fontSize: "0.84rem", color: "#8fd18c", marginTop: 5 }}>
                    Acordado: {s.fechaConfirmada}
                    {s.horaConfirmada ? ` a las ${String(s.horaConfirmada).slice(0, 5)}` : " (sin hora)"}
                    {" · "}
                    {s.choferAsignado ? `${s.choferAsignado} (asignado)` : `${s.chofer} (de la ruta)`}
                  </div>
                )}

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
                  <>
                  {/* Qué día, a qué hora y con quién. Antes esto no se
                      preguntaba: se confirmaba con la fecha que hubiera
                      puesto el cliente y el chofer que trajera la ruta. */}
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.7rem", flexWrap: "wrap", alignItems: "center" }}>
                    <label style={{ fontSize: "0.8rem", color: "var(--mc-gris)" }}>
                      Día
                      <input
                        type="date"
                        className="pt-input"
                        value={planDe(s).fecha || ""}
                        onChange={(e) => setPlanDe(s.folio, { fecha: e.target.value })}
                        style={{ marginLeft: 6, width: 150 }}
                      />
                    </label>
                    <label style={{ fontSize: "0.8rem", color: "var(--mc-gris)" }}>
                      Hora
                      <input
                        type="time"
                        className="pt-input"
                        value={planDe(s).hora || ""}
                        onChange={(e) => setPlanDe(s.folio, { hora: e.target.value })}
                        style={{ marginLeft: 6, width: 120 }}
                      />
                      <span style={{ marginLeft: 4 }}>(opcional)</span>
                    </label>
                    <label style={{ fontSize: "0.8rem", color: "var(--mc-gris)" }}>
                      Chofer
                      <select
                        className="pt-input"
                        value={planDe(s).choferId || ""}
                        onChange={(e) => setPlanDe(s.folio, { choferId: e.target.value })}
                        style={{ marginLeft: 6, minWidth: 190 }}
                      >
                        <option value="">El de la ruta ({s.chofer})</option>
                        {choferes.map((c) => (
                          <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                      </select>
                    </label>
                  </div>
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
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
