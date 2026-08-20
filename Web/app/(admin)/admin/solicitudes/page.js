"use client";

import { useEffect, useMemo, useState } from "react";
import { FiMail, FiPhone, FiX, FiMessageSquare, FiUserCheck, FiKey, FiRefreshCw, FiCheckCircle } from "react-icons/fi";
import { ESTADOS_SOLICITUD, infoEstado } from "@/lib/admin-datos";
import { listarCotizaciones, cambiarEstadoCotizacion } from "@/lib/datos-cotizaciones";
import { fechaLarga, folioCorto } from "@/lib/portal-datos";

export default function SolicitudesAdmin() {
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    listarCotizaciones().then((l) => {
      if (!vivo) return;
      setLista(l);
      setCargando(false);
    });
    return () => { vivo = false; };
  }, []);
  const [filtro, setFiltro] = useState("todas");
  const [sel, setSel] = useState(null);
  // Activación de cuenta de cliente por solicitud: { [id]: {correo, password, activada} }
  const [activaciones, setActivaciones] = useState({});

  const correoSugerido = (s) => s.correo;
  const generarPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let p = "";
    for (let i = 0; i < 10; i++) p += chars[Math.floor(Math.random() * chars.length)];
    return p;
  };
  const actDe = (s) => activaciones[s.id] || { correo: correoSugerido(s), password: "", activada: false };
  const setAct = (id, patch) =>
    setActivaciones((a) => ({ ...a, [id]: { ...(a[id] || {}), ...patch } }));

  const filas = useMemo(
    () =>
      lista
        .filter((s) => filtro === "todas" || s.estado === filtro)
        .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0)),
    [lista, filtro]
  );

  // Se guarda primero. Mover un prospecto a "ganada" y que no quede
  // registrado es perder una venta en el papeleo.
  const cambiarEstado = async (id, estado) => {
    const r = await cambiarEstadoCotizacion(id, estado);
    if (!r.ok) return;
    setLista((l) => l.map((s) => (s.id === id ? { ...s, estado } : s)));
    setSel((s) => (s && s.id === id ? { ...s, estado } : s));
  };

  const conteo = (id) => (id === "todas" ? lista.length : lista.filter((s) => s.estado === id).length);

  return (
    <>
      <div className="pt-page-head">
        <h1>Solicitudes de cotización</h1>
        <p>Las solicitudes del formulario del sitio llegan aquí. Dales seguimiento hasta cerrarlas.</p>
      </div>

      <div className="pt-segmento" style={{ marginBottom: "1.1rem", flexWrap: "wrap" }}>
        <button className={filtro === "todas" ? "activo" : ""} onClick={() => setFiltro("todas")}>
          Todas ({conteo("todas")})
        </button>
        {ESTADOS_SOLICITUD.map((e) => (
          <button key={e.id} className={filtro === e.id ? "activo" : ""} onClick={() => setFiltro(e.id)}>
            {e.texto} ({conteo(e.id)})
          </button>
        ))}
      </div>

      <div className="pt-grid" style={{ gridTemplateColumns: sel ? "1.6fr 1fr" : "1fr", gap: "1.1rem", alignItems: "start" }}>
        <div className="pt-card">
          <div className="pt-tabla-wrap">
            <table className="pt-tabla" style={{ minWidth: 560 }}>
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
                {filas.length === 0 && (
                  <tr><td colSpan={5} className="pt-vacio">Sin solicitudes en este filtro.</td></tr>
                )}
                {filas.map((s) => {
                  const est = infoEstado(s.estado);
                  return (
                    <tr
                      key={s.id}
                      onClick={() => setSel(s)}
                      style={{ cursor: "pointer", background: sel?.id === s.id ? "rgba(78,179,74,0.07)" : undefined }}
                    >
                      <td className="folio" title={s.id}>{folioCorto(s.id)}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{fechaLarga(s.fecha)}</td>
                      <td>
                        <strong style={{ display: "block" }}>{s.empresa}</strong>
                        <span style={{ color: "var(--mc-gris)", fontSize: "0.8rem" }}>{s.nombre}</span>
                      </td>
                      <td>{s.servicio}</td>
                      <td><span className={`pt-badge ${est.clase}`}>{est.texto}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Panel de detalle */}
        {sel && (
          <div className="pt-card" style={{ position: "sticky", top: 90 }}>
            <div className="pt-card-head">
              <h2>{sel.id}</h2>
              <button className="pt-btn" onClick={() => setSel(null)} aria-label="Cerrar"><FiX /></button>
            </div>

            <strong style={{ fontSize: "1.05rem" }}>{sel.empresa}</strong>
            <div style={{ color: "var(--mc-gris)", marginBottom: "0.9rem" }}>{sel.nombre}</div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
              <a href={`mailto:${sel.correo}`} className="pt-btn" style={{ justifyContent: "flex-start" }}>
                <FiMail /> {sel.correo}
              </a>
              <a href={`tel:+52${sel.telefono.replace(/\s/g, "")}`} className="pt-btn" style={{ justifyContent: "flex-start" }}>
                <FiPhone /> {sel.telefono}
              </a>
              <a
                href={`https://wa.me/52${sel.telefono.replace(/\s/g, "")}?text=${encodeURIComponent(`Hola ${sel.nombre}, le escribimos de Morcast del Norte sobre su solicitud ${sel.id}.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="pt-btn pt-btn-verde"
                style={{ justifyContent: "flex-start" }}
              >
                <FiMessageSquare /> Contactar por WhatsApp
              </a>

              {sel.estado === "ganada" && (() => {
                const a = actDe(sel);
                const tel = sel.telefono.replace(/\s/g, "");
                const msg = `Hola ${sel.nombre}, su cuenta del Portal de Clientes de Morcast del Norte ya está activa.\n\nIngrese en: morcast.mx/portal/login\nCorreo: ${a.correo}\nContraseña: ${a.password}\n\nConserve estos datos.`;
                return (
                  <div className="pt-activar">
                    {a.activada ? (
                      <>
                        <div className="pt-activar-ok"><FiCheckCircle /> Cuenta de cliente activada</div>
                        <p>Envíale estas credenciales para que entre al portal:</p>
                        <div className="pt-cred"><span>Correo</span><strong>{a.correo}</strong></div>
                        <div className="pt-cred"><span>Contraseña</span><strong>{a.password}</strong></div>
                        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem" }}>
                          <a className="pt-btn pt-btn-verde" style={{ flex: 1, justifyContent: "center" }}
                            href={`https://wa.me/52${tel}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer">
                            <FiMessageSquare /> WhatsApp
                          </a>
                          <a className="pt-btn" style={{ flex: 1, justifyContent: "center" }}
                            href={`mailto:${a.correo}?subject=${encodeURIComponent("Acceso a su Portal de Clientes — Morcast del Norte")}&body=${encodeURIComponent(msg)}`}>
                            <FiMail /> Correo
                          </a>
                        </div>
                        <button className="pt-btn" style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}
                          onClick={() => setAct(sel.id, { activada: false })}>
                          Editar credenciales
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="pt-activar-tit"><FiUserCheck /> Activar cuenta de cliente</div>
                        <p>Genera el acceso al portal para <strong>{sel.empresa}</strong>.</p>
                        <div className="pt-campo" style={{ margin: "0 0 0.5rem" }}>
                          <label>Correo de acceso</label>
                          <input className="pt-input" type="email" value={a.correo}
                            onChange={(e) => setAct(sel.id, { correo: e.target.value })} />
                        </div>
                        <div className="pt-campo" style={{ margin: "0 0 0.7rem" }}>
                          <label>Contraseña</label>
                          <div style={{ display: "flex", gap: "0.4rem" }}>
                            <input className="pt-input" style={{ flex: 1 }} value={a.password}
                              placeholder="Genera o escribe una contraseña"
                              onChange={(e) => setAct(sel.id, { password: e.target.value })} />
                            <button type="button" className="pt-btn" title="Generar contraseña"
                              onClick={() => setAct(sel.id, { password: generarPassword() })}>
                              <FiRefreshCw /> Generar
                            </button>
                          </div>
                        </div>
                        <button type="button" className="pt-btn pt-btn-verde"
                          style={{ width: "100%", justifyContent: "center", opacity: a.correo && a.password ? 1 : 0.55 }}
                          disabled={!a.correo || !a.password}
                          onClick={() => setAct(sel.id, { activada: true })}>
                          <FiKey /> Activar cuenta de cliente
                        </button>
                        <p className="pt-activar-nota">La empresa envía estas credenciales al cliente por WhatsApp o correo.</p>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", fontSize: "0.86rem", marginBottom: "1rem" }}>
              <div><span style={{ color: "var(--mc-gris)" }}>Servicio</span><br /><strong>{sel.servicio}</strong></div>
              <div><span style={{ color: "var(--mc-gris)" }}>Frecuencia</span><br /><strong>{sel.frecuencia}</strong></div>
              <div><span style={{ color: "var(--mc-gris)" }}>Recibida</span><br /><strong>{fechaLarga(sel.fecha)}</strong></div>
            </div>

            <div style={{ background: "var(--mc-blanco)", border: "1px solid var(--mc-linea)", borderRadius: 10, padding: "0.8rem", fontSize: "0.88rem", marginBottom: "1.1rem" }}>
              <span style={{ color: "var(--mc-gris)", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>Mensaje</span>
              <p style={{ margin: "0.4rem 0 0" }}>{sel.mensaje}</p>
            </div>

            <span style={{ color: "var(--mc-gris)", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>Cambiar estado</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.5rem" }}>
              {ESTADOS_SOLICITUD.map((e) => (
                <button
                  key={e.id}
                  className={`pt-btn ${sel.estado === e.id ? "pt-btn-verde" : ""}`}
                  onClick={() => cambiarEstado(sel.id, e.id)}
                >
                  {e.texto}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
