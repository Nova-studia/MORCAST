"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  Users,
  Plus,
  PencilSimple,
  Lock,
  LockOpen,
  Trash,
  X,
  Phone,
  Envelope,
  ChatCentered,
  Paperclip,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import {
  listarVacantes,
  guardarVacante,
  cambiarEstadoVacante,
  borrarVacante,
  listarSolicitudesEmpleo,
  cambiarEstadoSolicitud,
  contarSolicitudesPorVacante,
} from "@/lib/datos-empleo";
import { enlaceCurriculum } from "@/lib/datos-archivos";
import {
  nombreDeVacante,
  fichaDeVacante,
  puedeBorrarseVacante,
  ESTADOS_SOLICITUD,
  AREAS,
  TIPOS_VACANTE,
} from "@/lib/empleo.mjs";
import { registrarAccionEmpleo } from "@/app/acciones-empleo";

/**
 * Sólo etiquetas de pantalla — calcan `empleo.mjs`, que no las exporta
 * porque son de presentación, no una regla que haya que probar.
 */
const NOMBRE_AREA = { operacion: "Operación", oficina: "Oficina" };
const NOMBRE_TIPO = {
  "tiempo-completo": "Tiempo completo",
  "medio-tiempo": "Medio tiempo",
  temporal: "Temporal",
};

const ESTADO_VACANTE_INFO = {
  abierta: { texto: "Abierta", clase: "ok" },
  cerrada: { texto: "Cerrada", clase: "" },
};

const ESTADO_SOLICITUD_INFO = {
  nueva: { texto: "Nueva", clase: "" },
  revisada: { texto: "Revisada", clase: "prog" },
  contactada: { texto: "Contactada", clase: "ok" },
  descartada: { texto: "Descartada", clase: "mal" },
};

const fecha = (iso) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });

const VACANTE_VACIA = () => ({
  puesto: "",
  area: AREAS[0],
  tipo: TIPOS_VACANTE[0],
  descripcion: "",
  requisitosTexto: "",
});

export default function EmpleoAdmin() {
  const [tab, setTab] = useState("vacantes");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const [vacantes, setVacantes] = useState([]);
  const [conteos, setConteos] = useState({});
  const [solicitudes, setSolicitudes] = useState([]);

  useEffect(() => {
    let vivo = true;
    Promise.all([listarVacantes(), listarSolicitudesEmpleo(), contarSolicitudesPorVacante()]).then(
      ([v, s, c]) => {
        if (!vivo) return;
        setVacantes(v);
        setSolicitudes(s);
        setConteos(c);
        setCargando(false);
      }
    );
    return () => {
      vivo = false;
    };
  }, []);

  const vacantePorId = useMemo(() => {
    const m = new Map();
    vacantes.forEach((v) => m.set(v.id, v));
    return m;
  }, [vacantes]);

  /* ================================================================== */
  /* VACANTES                                                           */
  /* ================================================================== */

  const [form, setForm] = useState(null); // null = formulario cerrado
  const [guardando, setGuardando] = useState(false);

  const nuevaVacante = () => {
    setError("");
    setForm(VACANTE_VACIA());
  };
  const editarVacante = (v) => {
    setError("");
    setForm({
      id: v.id,
      puesto: v.puesto,
      area: v.area,
      tipo: v.tipo,
      descripcion: v.descripcion || "",
      requisitosTexto: (v.requisitos || []).join("\n"),
    });
  };

  const guardar = async (e) => {
    e.preventDefault();
    setError("");
    setGuardando(true);
    const requisitos = form.requisitosTexto.split("\n");
    const r = await guardarVacante({
      id: form.id,
      puesto: form.puesto,
      area: form.area,
      tipo: form.tipo,
      descripcion: form.descripcion,
      requisitos,
    });
    setGuardando(false);
    if (!r.ok) {
      setError(r.motivo || "No se pudo guardar la vacante.");
      return;
    }

    // El servidor de verdad devuelve la fila ya limpia (`r.vacante`). En modo
    // demostración `guardarVacante` sólo dice `{ ok: true, demo: true }` —no
    // hay base que devolver nada—, así que aquí se arma la misma forma con lo
    // que ya se escribió en el formulario, para que la pantalla se vea
    // actualizada aunque no exista base de datos.
    const previa = form.id ? vacantes.find((v) => v.id === form.id) : null;
    const limpia = {
      id: r.vacante?.id || form.id || `VAC-DEMO-${Date.now()}`,
      puesto: form.puesto.trim(),
      area: form.area,
      tipo: form.tipo,
      descripcion: form.descripcion.trim(),
      requisitos: requisitos.map((x) => x.trim()).filter(Boolean).slice(0, 12),
      estado: r.vacante?.estado || previa?.estado || "abierta",
      creado: r.vacante?.creado || previa?.creado || new Date().toISOString(),
    };

    setVacantes((l) => (form.id ? l.map((v) => (v.id === form.id ? limpia : v)) : [limpia, ...l]));

    await registrarAccionEmpleo({
      evento: "vacante",
      registroId: limpia.id,
      detalle: { puesto: limpia.puesto, nuevo: !form.id },
    });

    setForm(null);
  };

  const cambiarEstado = async (v, estado) => {
    setError("");
    const r = await cambiarEstadoVacante(v.id, estado);
    if (!r.ok) {
      setError(r.motivo || "No se pudo cambiar el estado.");
      return;
    }
    setVacantes((l) => l.map((x) => (x.id === v.id ? { ...x, estado } : x)));
    await registrarAccionEmpleo({
      evento: "vacante",
      registroId: v.id,
      detalle: { puesto: v.puesto, estado },
    });
  };

  const quitarVacante = async (id) => {
    setError("");
    const v = vacantePorId.get(id);
    const r = await borrarVacante(id);
    if (!r.ok) {
      setError(r.motivo || "No se pudo borrar la vacante.");
      return;
    }
    setVacantes((l) => l.filter((x) => x.id !== id));
    if (form?.id === id) setForm(null);
    await registrarAccionEmpleo({
      evento: "vacante",
      registroId: id,
      detalle: { puesto: v?.puesto, borrada: true },
    });
  };

  /* ================================================================== */
  /* CANDIDATOS                                                         */
  /* ================================================================== */

  const [filtroEstado, setFiltroEstado] = useState("nueva");
  const [filtroVacante, setFiltroVacante] = useState("todas");
  const [selId, setSelId] = useState(null);
  const [notas, setNotas] = useState("");
  const [guardandoEstado, setGuardandoEstado] = useState(false);
  const [pidiendoCv, setPidiendoCv] = useState(false);

  const sel = useMemo(() => solicitudes.find((s) => s.id === selId) || null, [solicitudes, selId]);

  // Las notas se recargan al abrir OTRO candidato, nunca sobre lo que ya se
  // estaba escribiendo del mismo: si se disparara con cada cambio de
  // `solicitudes`, el propio `marcar()` de abajo (que actualiza esa lista al
  // guardar) le borraría a medio tecleo lo que la administradora sigue
  // escribiendo.
  useEffect(() => {
    setNotas(sel?.notas || "");
  }, [selId]); // eslint-disable-line react-hooks/exhaustive-deps

  const seleccionar = (s) => {
    setError("");
    setSelId(s.id);
  };

  const marcar = async (estado) => {
    if (!sel) return;
    setError("");
    setGuardandoEstado(true);
    const r = await cambiarEstadoSolicitud(sel.id, estado, notas);
    setGuardandoEstado(false);
    if (!r.ok) {
      setError(r.motivo || "No se pudo guardar.");
      return;
    }
    setSolicitudes((l) => l.map((s) => (s.id === sel.id ? { ...s, estado, notas } : s)));
    await registrarAccionEmpleo({
      evento: "estado",
      registroId: sel.id,
      detalle: { folio: sel.folio, estado, notas: notas || null },
    });
  };

  // El enlace se pide AL HACER CLIC, no al pintar la bandeja: son enlaces
  // firmados que caducan, y pedir veinte de una vez sólo produce veinte
  // enlaces que ya no sirven cuando alguien por fin los usa.
  const verCurriculum = async () => {
    if (!sel?.cv_ruta) return;
    setError("");
    setPidiendoCv(true);
    const url = await enlaceCurriculum(sel.cv_ruta);
    setPidiendoCv(false);
    if (!url) {
      setError("No se pudo generar el enlace del currículum. Puede que ya haya caducado, inténtalo de nuevo.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const chipsEstado = [
    { id: "nueva", texto: `Nuevas (${solicitudes.filter((s) => s.estado === "nueva").length})` },
    ...ESTADOS_SOLICITUD.filter((id) => id !== "nueva").map((id) => ({
      id,
      texto: ESTADO_SOLICITUD_INFO[id]?.texto || id,
    })),
    { id: "todas", texto: "Todas" },
  ];

  const filasCandidatos = useMemo(() => {
    return solicitudes
      .filter((s) => filtroEstado === "todas" || s.estado === filtroEstado)
      .filter((s) => {
        if (filtroVacante === "todas") return true;
        if (filtroVacante === "generales") return !s.vacante_id;
        return s.vacante_id === filtroVacante;
      })
      .sort((a, b) => (a.creado < b.creado ? 1 : a.creado > b.creado ? -1 : 0));
  }, [solicitudes, filtroEstado, filtroVacante]);

  return (
    <>
      <div className="pt-page-head">
        <h1>Trabaja con nosotros</h1>
        <p>Publica las vacantes que salen en /empleo y da seguimiento a quién aplica.</p>
      </div>

      {error && (
        <div className="pt-login-error" role="alert" style={{ marginBottom: "1rem" }}>
          <WarningCircle style={{ marginRight: 6, verticalAlign: "-2px" }} /> {error}
        </div>
      )}

      <div className="pt-segmento" style={{ marginBottom: "1.1rem" }}>
        <button className={tab === "vacantes" ? "activo" : ""} onClick={() => setTab("vacantes")}>
          <Briefcase style={{ verticalAlign: "-2px", marginRight: 5 }} /> Vacantes ({vacantes.length})
        </button>
        <button className={tab === "candidatos" ? "activo" : ""} onClick={() => setTab("candidatos")}>
          <Users style={{ verticalAlign: "-2px", marginRight: 5 }} /> Candidatos ({solicitudes.length})
        </button>
      </div>

      {tab === "vacantes" && (
        <>
          {form && (
            <div className="pt-card" style={{ marginBottom: "1.1rem" }}>
              <div className="pt-card-head">
                <h2>{form.id ? "Editar vacante" : "Nueva vacante"}</h2>
                <button className="pt-btn" onClick={() => setForm(null)} aria-label="Cancelar">
                  <X />
                </button>
              </div>
              {/* Los `id` van fijos (no con `useId()`) porque este `<form>`
                  sale de un único `{form && (...)}`: nunca hay una vacante en
                  alta y otra en edición montadas a la vez en la pantalla, así
                  que no hace falta generarlos por instancia. Prefijados con
                  `empleo-vacante-` para no chocar con otro `id="puesto"` que
                  pudiera existir en el resto del panel. */}
              <form onSubmit={guardar}>
                <div className="pt-grid pt-grid-3" style={{ gap: "0.8rem", marginBottom: "0.4rem" }}>
                  <div className="pt-campo" style={{ margin: 0 }}>
                    <label htmlFor="empleo-vacante-puesto">Puesto</label>
                    <input
                      id="empleo-vacante-puesto"
                      className="pt-input"
                      required
                      maxLength={120}
                      value={form.puesto}
                      onChange={(e) => setForm({ ...form, puesto: e.target.value })}
                    />
                  </div>
                  <div className="pt-campo" style={{ margin: 0 }}>
                    <label htmlFor="empleo-vacante-area">Área</label>
                    <select
                      id="empleo-vacante-area"
                      className="pt-input"
                      value={form.area}
                      onChange={(e) => setForm({ ...form, area: e.target.value })}
                    >
                      {AREAS.map((a) => (
                        <option key={a} value={a}>{NOMBRE_AREA[a] || a}</option>
                      ))}
                    </select>
                  </div>
                  <div className="pt-campo" style={{ margin: 0 }}>
                    <label htmlFor="empleo-vacante-tipo">Tipo</label>
                    <select
                      id="empleo-vacante-tipo"
                      className="pt-input"
                      value={form.tipo}
                      onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                    >
                      {TIPOS_VACANTE.map((t) => (
                        <option key={t} value={t}>{NOMBRE_TIPO[t] || t}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="pt-campo">
                  <label htmlFor="empleo-vacante-descripcion">Descripción</label>
                  <textarea
                    id="empleo-vacante-descripcion"
                    className="pt-input"
                    rows={3}
                    maxLength={1200}
                    value={form.descripcion}
                    onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                    placeholder="Qué va a hacer quien entre a este puesto."
                  />
                </div>
                <div className="pt-campo">
                  <label htmlFor="empleo-vacante-requisitos">Requisitos (uno por renglón)</label>
                  <textarea
                    id="empleo-vacante-requisitos"
                    className="pt-input"
                    rows={4}
                    value={form.requisitosTexto}
                    onChange={(e) => setForm({ ...form, requisitosTexto: e.target.value })}
                    placeholder={"Licencia federal vigente\nDisponibilidad de lunes a sábado"}
                  />
                </div>
                <button type="submit" className="pt-btn pt-btn-verde" disabled={guardando} style={{ padding: "0.65rem 1.4rem" }}>
                  {guardando ? "Guardando…" : form.id ? "Guardar cambios" : "Publicar vacante"}
                </button>
              </form>
            </div>
          )}

          <div className="pt-card-head" style={{ marginBottom: "0.8rem" }}>
            <h2>Vacantes</h2>
            {!form && (
              <button className="pt-btn pt-btn-verde" onClick={nuevaVacante}>
                <Plus /> Nueva vacante
              </button>
            )}
          </div>

          {cargando ? (
            <div className="pt-vacio">Cargando…</div>
          ) : vacantes.length === 0 ? (
            <div className="pt-vacio">Aún no has publicado ninguna vacante.</div>
          ) : (
            vacantes.map((v) => {
              const permiso = puedeBorrarseVacante(conteos[v.id] || 0);
              const estadoInfo = ESTADO_VACANTE_INFO[v.estado] || { texto: v.estado, clase: "" };
              return (
                <div key={v.id} className="pt-card" style={{ marginBottom: "0.8rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.6rem" }}>
                    <div>
                      <strong style={{ fontSize: "1.02rem" }}>{v.puesto}</strong>
                      <div style={{ color: "var(--mc-gris)", fontSize: "0.85rem" }}>{fichaDeVacante(v)}</div>
                    </div>
                    <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
                      <span className={`pt-badge ${estadoInfo.clase}`}>{estadoInfo.texto}</span>
                      <span style={{ fontSize: "0.8rem", color: "var(--mc-gris)" }}>
                        {conteos[v.id] || 0} candidato{(conteos[v.id] || 0) === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>

                  {v.descripcion && <p style={{ margin: "0.7rem 0", fontSize: "0.9rem" }}>{v.descripcion}</p>}
                  {v.requisitos?.length > 0 && (
                    <ul style={{ margin: "0 0 0.8rem 1.1rem", fontSize: "0.86rem", color: "var(--mc-gris)" }}>
                      {v.requisitos.map((req, i) => (
                        <li key={i}>{req}</li>
                      ))}
                    </ul>
                  )}

                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                    <button type="button" className="pt-btn" onClick={() => editarVacante(v)}>
                      <PencilSimple /> Editar
                    </button>
                    {v.estado === "abierta" ? (
                      <button type="button" className="pt-btn" onClick={() => cambiarEstado(v, "cerrada")}>
                        <Lock /> Cerrar
                      </button>
                    ) : (
                      <button type="button" className="pt-btn" onClick={() => cambiarEstado(v, "abierta")}>
                        <LockOpen /> Reabrir
                      </button>
                    )}

                    {(() => {
                      return (
                        <span className="pt-accion-con-motivo" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                          <button
                            type="button"
                            className="pt-btn"
                            disabled={!permiso.ok}
                            onClick={() => quitarVacante(v.id)}
                            title={permiso.ok ? "Borrar la vacante" : permiso.motivo}
                          >
                            <Trash /> Borrar
                          </button>
                          {/* El motivo VISIBLE, no sólo en el `title`: en una
                              tableta el `title` ni siquiera existe, y un
                              botón apagado sin explicación es lo más
                              frustrante de una interfaz. Luis ya devolvió una
                              pantalla por esto mismo el 1-sep. */}
                          {!permiso.ok && (
                            <small style={{ color: "var(--mc-gris)" }}>{permiso.motivo}</small>
                          )}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              );
            })
          )}
        </>
      )}

      {tab === "candidatos" && (
        <>
          <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap", alignItems: "center", marginBottom: "1rem" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {chipsEstado.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`pt-chip ${filtroEstado === f.id ? "activo" : ""}`}
                  onClick={() => setFiltroEstado(f.id)}
                >
                  {f.texto}
                </button>
              ))}
            </div>
            <select
              className="pt-input"
              style={{ maxWidth: 240 }}
              value={filtroVacante}
              onChange={(e) => setFiltroVacante(e.target.value)}
            >
              <option value="todas">Todas las vacantes</option>
              <option value="generales">Solicitudes generales</option>
              {vacantes.map((v) => (
                <option key={v.id} value={v.id}>{v.puesto}</option>
              ))}
            </select>
          </div>

          <div className="pt-grid pt-grid-mapa">
            <div className="pt-card">
              <div className="pt-card-head"><h2>Candidatos ({filasCandidatos.length})</h2></div>
              {cargando ? (
                <div className="pt-vacio">Cargando…</div>
              ) : filasCandidatos.length === 0 ? (
                <div className="pt-vacio">
                  {solicitudes.length === 0
                    ? "Todavía no ha llegado ninguna solicitud."
                    : "Sin candidatos en este filtro."}
                </div>
              ) : (
                <div className="pt-tabla-wrap">
                  <table className="pt-tabla" style={{ minWidth: 720 }}>
                    <thead>
                      <tr>
                        <th>Folio</th><th>Fecha</th><th>Nombre</th>
                        <th>Teléfono</th><th>Puesto</th><th>CV</th><th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filasCandidatos.map((s) => {
                        const info = ESTADO_SOLICITUD_INFO[s.estado] || { texto: s.estado, clase: "" };
                        return (
                          <tr
                            key={s.id}
                            onClick={() => seleccionar(s)}
                            style={{ cursor: "pointer", background: selId === s.id ? "rgba(255,255,255,0.04)" : undefined }}
                          >
                            <td className="folio">{s.folio}</td>
                            <td style={{ whiteSpace: "nowrap" }}>{fecha(s.creado)}</td>
                            <td>{s.nombre}</td>
                            <td style={{ whiteSpace: "nowrap" }}>{s.telefono}</td>
                            {/* SIEMPRE por `nombreDeVacante()`: la mayoría de
                                las solicitudes NO traen vacante (son
                                generales), y ese caso es el normal, no el
                                raro. Escribir `s.puesto` a secas imprimió
                                "undefined" en /admin/recolecciones. */}
                            <td>{nombreDeVacante(vacantePorId.get(s.vacante_id))}</td>
                            <td>{s.cv_ruta ? <Paperclip title="Trae currículum" /> : "—"}</td>
                            <td><span className={`pt-badge ${info.clase}`}>{info.texto}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="pt-card">
              <div className="pt-card-head"><h2>Detalle</h2></div>
              {!sel ? (
                <div className="pt-vacio">Toca un candidato para ver toda su solicitud.</div>
              ) : (
                <div style={{ padding: "0 0.2rem" }}>
                  <h3 style={{ margin: "0 0 0.2rem" }}>{sel.nombre}</h3>
                  <p style={{ margin: "0 0 1rem", color: "var(--mc-gris)", fontSize: "0.9rem" }}>
                    {sel.folio} · {fecha(sel.creado)}
                  </p>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "1rem" }}>
                    <a className="pt-btn" href={`tel:${sel.telefono}`}><Phone /> Llamar</a>
                    <a
                      className="pt-btn pt-btn-verde"
                      target="_blank"
                      rel="noreferrer"
                      href={`https://wa.me/52${sel.telefono}`}
                    >
                      <ChatCentered /> WhatsApp
                    </a>
                    {sel.correo && (
                      <a className="pt-btn" href={`mailto:${sel.correo}?subject=Tu solicitud en Morcast (${sel.folio})`}>
                        <Envelope /> Correo
                      </a>
                    )}
                    {sel.cv_ruta && (
                      <button type="button" className="pt-btn" onClick={verCurriculum} disabled={pidiendoCv}>
                        <Paperclip /> {pidiendoCv ? "Generando…" : "Ver currículum"}
                      </button>
                    )}
                  </div>

                  <Dato etiqueta="Puesto que busca" valor={nombreDeVacante(vacantePorId.get(sel.vacante_id))} />
                  <Dato etiqueta="Teléfono" valor={sel.telefono} />
                  <Dato etiqueta="Correo" valor={sel.correo} />
                  <Dato etiqueta="Experiencia" valor={sel.experiencia} />

                  <div className="pt-campo" style={{ marginTop: "1rem" }}>
                    <label>Notas internas</label>
                    <textarea
                      className="pt-input"
                      rows={3}
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                      placeholder="Notas para el equipo (el candidato no las ve)."
                    />
                  </div>

                  <span style={{ color: "var(--mc-gris)", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Cambiar estado
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.5rem" }}>
                    {ESTADOS_SOLICITUD.map((id) => (
                      <button
                        key={id}
                        type="button"
                        className={`pt-btn ${sel.estado === id ? "pt-btn-verde" : ""}`}
                        disabled={guardandoEstado}
                        onClick={() => marcar(id)}
                      >
                        {ESTADO_SOLICITUD_INFO[id]?.texto || id}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function Dato({ etiqueta, valor }) {
  if (!valor && valor !== 0) return null;
  return (
    <p style={{ margin: "0 0 0.55rem", fontSize: "0.92rem" }}>
      <span style={{ color: "var(--mc-gris)" }}>{etiqueta}</span>
      <br />
      <strong>{valor}</strong>
    </p>
  );
}
