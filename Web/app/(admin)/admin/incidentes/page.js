"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Siren,
  Clock,
  Wrench,
  Package,
  ArrowsOutCardinal,
  Question,
  WarningCircle,
  MapPin,
  Megaphone,
  CheckCircle,
  Phone,
  X,
  ImageSquare,
} from "@phosphor-icons/react/dist/ssr";
import VisorFoto from "@/components/VisorFoto";
import { listarIncidentes, enlaceFotoIncidente } from "@/lib/datos-incidentes";
import { enlaceVerEnMapa } from "@/lib/mapas.mjs";
import { duracionEnLetra } from "@/lib/avisos.mjs";
import {
  TIPOS_INCIDENTE,
  infoTipo,
  fechaHora,
  filtrarIncidentes,
  ordenarBandeja,
  contarIncidentes,
  validarAtencion,
  MAX_NOTA,
} from "./bandeja.mjs";
import { atenderIncidente } from "./acciones";
import css from "./incidentes.module.css";

/**
 * BANDEJA DE INCIDENTES (/admin/incidentes).
 *
 * Pedido de los dueños (4-oct-2026): el chofer reporta desde la calle un
 * accidente, un retraso, una falla o un problema con un contenedor, y a la
 * administración le llega el aviso. El botón del chofer y el correo de
 * alerta son de otra pantalla; esto es donde la oficina los ve y los cierra.
 *
 * Lo abierto va arriba y, de eso, los accidentes primero (bandeja.mjs). Un
 * retraso trae un atajo para avisar a los clientes de la ruta: es justo el
 * caso para el que los dueños pidieron los avisos.
 */

const ICONO = {
  accidente: Siren,
  retraso: Clock,
  "falla-mecanica": Wrench,
  "contenedor-danado": Package,
  "contenedor-movido": ArrowsOutCardinal,
  "contenedor-no-esta": Question,
  otro: WarningCircle,
};

/** El color va con el TONO del tipo (bandeja.mjs), nunca con su lugar en la lista. */
const COLOR_TONO = {
  urgente: { color: "var(--pt-error)", tinte: "var(--pt-error-tinte)" },
  alerta: { color: "var(--pt-alerta)", tinte: "var(--pt-alerta-tinte)" },
  neutro: { color: "var(--mc-gris)", tinte: "rgba(255, 255, 255, 0.06)" },
};

const ETIQUETA = { color: "var(--mc-gris)", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em" };

function TipoIncidente({ tipo, conTexto = true }) {
  const info = infoTipo(tipo);
  const Icono = ICONO[tipo] || WarningCircle;
  const tono = COLOR_TONO[info.tono];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
      <span
        aria-hidden="true"
        style={{ display: "grid", placeItems: "center", width: 28, height: 28, borderRadius: 7, background: tono.tinte, color: tono.color, flexShrink: 0 }}
      >
        <Icono weight="bold" />
      </span>
      {conTexto && <strong style={{ fontSize: "0.88rem", whiteSpace: "nowrap" }}>{info.texto}</strong>}
    </span>
  );
}

/** Abierto en ámbar (falta hacer algo), atendido en verde; el urgente lo dice con todas sus letras. */
function EstadoIncidente({ estado, urgente = false }) {
  if (estado !== "abierto") return <span className="pt-badge ok">Atendido</span>;
  if (urgente) return <span className="pt-badge mal">Urgente</span>;
  return <span className="pt-badge" style={{ background: "var(--pt-alerta-tinte)", color: "var(--pt-alerta)" }}>Abierto</span>;
}

function Dato({ etiqueta, children }) {
  return (
    <div style={{ minWidth: 0 }}>
      <span style={{ color: "var(--mc-gris)", fontSize: "0.8rem" }}>{etiqueta}</span>
      <br />
      <strong style={{ fontWeight: 500, overflowWrap: "anywhere" }}>{children || "—"}</strong>
    </div>
  );
}

/** Enlace al formulario de avisos ya prellenado con la ruta y el retraso. */
function enlaceAvisoRetraso(inc) {
  const q = new URLSearchParams({ motivo: "retraso", incidente: inc.id });
  if (inc.ruta?.id) {
    q.set("alcance", "ruta");
    q.set("ruta", inc.ruta.id);
  }
  if (inc.retrasoMin) q.set("minutos", String(inc.retrasoMin));
  return `/admin/avisos?${q.toString()}`;
}

export default function IncidentesAdmin() {
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");
  const [estado, setEstado] = useState("abiertos");
  const [tipo, setTipo] = useState("todos");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [selId, setSelId] = useState(null);
  const [foto, setFoto] = useState({ id: null, url: null, cargando: false });
  const [viendoFoto, setViendoFoto] = useState(false);
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorAtender, setErrorAtender] = useState("");
  const refDetalle = useRef(null);

  useEffect(() => {
    let vivo = true;
    listarIncidentes().then((r) => {
      if (!vivo) return;
      if (Array.isArray(r)) setLista(r);
      else setErrorCarga(r?.error || "No se pudieron leer los incidentes.");
      setCargando(false);
    });
    return () => { vivo = false; };
  }, []);

  const conteo = useMemo(() => contarIncidentes(lista), [lista]);
  const filas = useMemo(
    () => ordenarBandeja(filtrarIncidentes(lista, { estado, tipo, desde, hasta })),
    [lista, estado, tipo, desde, hasta]
  );
  // Se guarda el id y no el objeto: al marcarlo como atendido la lista se
  // actualiza y el detalle tiene que enseñar la versión nueva, no una copia.
  const sel = lista.find((i) => i.id === selId) || null;

  const abrir = (inc) => {
    setSelId(inc.id);
    setNota("");
    setErrorAtender("");
    setViendoFoto(false);
    if (inc.foto) {
      setFoto({ id: inc.id, url: null, cargando: true });
      enlaceFotoIncidente(inc).then((url) => {
        // Si mientras firmaba la foto ya se abrió otro incidente, esta
        // respuesta llega tarde y no le toca a nadie.
        setFoto((f) => (f.id === inc.id ? { id: inc.id, url, cargando: false } : f));
      });
    } else {
      setFoto({ id: inc.id, url: null, cargando: false });
    }
    // En el teléfono el detalle queda DEBAJO de la lista: sin esto, tocar un
    // renglón no parece hacer nada.
    if (typeof window !== "undefined" && window.innerWidth < 900) {
      setTimeout(() => refDetalle.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
  };

  /** Se guarda primero y se pinta después: cerrar un accidente que no quedó cerrado es peor que esperar un segundo. */
  const atender = async () => {
    if (!sel) return;
    const v = validarAtencion(nota);
    if (!v.ok) {
      setErrorAtender(v.motivo);
      return;
    }
    setGuardando(true);
    setErrorAtender("");
    const r = await atenderIncidente(sel.id, v.nota);
    setGuardando(false);
    if (!r.ok) {
      setErrorAtender(r.motivo || "No se pudo guardar. Vuelve a intentarlo.");
      return;
    }
    setLista((l) =>
      l.map((i) =>
        i.id === sel.id
          ? {
              ...i,
              estado: "atendido",
              atendidoEn: r.atendidoEn || new Date().toISOString(),
              atendio: r.atendio || (r.demo ? "Tú (prototipo)" : ""),
              notaAtencion: v.nota,
            }
          : i
      )
    );
    setNota("");
  };

  const hayFiltroFecha = desde || hasta || tipo !== "todos";
  // Lo que se enseña en vez de la lista (tabla y tarjetas dicen lo mismo).
  const mensajeVacio = cargando
    ? "Cargando incidentes…"
    : errorCarga
      ? errorCarga
      : filas.length === 0
        ? estado === "abiertos" && !hayFiltroFecha
          ? "No hay incidentes abiertos. Cuando un chofer reporte algo, aparece aquí."
          : "Ningún incidente con estos filtros."
        : "";

  return (
    <>
      <div className="pt-page-head">
        <h1>Incidentes</h1>
        <p>Lo que reportan los choferes desde la calle. Lo abierto va arriba, y los accidentes primero.</p>
      </div>

      {conteo.urgentes > 0 && (
        <div
          role="alert"
          style={{
            display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem",
            background: "var(--pt-error-tinte)", border: "1px solid rgba(217, 119, 107, 0.45)",
            color: "var(--pt-error)", borderRadius: 8, padding: "0.7rem 0.9rem", fontSize: "0.9rem",
          }}
        >
          <Siren weight="bold" style={{ flexShrink: 0, fontSize: "1.2rem" }} />
          <span>
            <strong>
              {conteo.urgentes === 1 ? "Hay 1 accidente sin atender." : `Hay ${conteo.urgentes} accidentes sin atender.`}
            </strong>{" "}
            Llama al chofer antes que nada.
          </span>
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.8rem", alignItems: "flex-end", marginBottom: "1.1rem" }}>
        <div className="pt-segmento" style={{ flexWrap: "wrap" }}>
          {[
            ["abiertos", `Abiertos (${conteo.abiertos})`],
            ["atendidos", `Atendidos (${conteo.atendidos})`],
            ["todos", `Todos (${conteo.todos})`],
          ].map(([id, texto]) => (
            <button key={id} type="button" className={estado === id ? "activo" : ""} onClick={() => setEstado(id)}>
              {texto}
            </button>
          ))}
        </div>
        <label className={`${css.filtro} ${css.filtroTipo}`}>
          Tipo
          <select className="pt-input" value={tipo} onChange={(e) => setTipo(e.target.value)} style={{ padding: "0.5rem 0.7rem" }}>
            <option value="todos">Todos los tipos</option>
            {TIPOS_INCIDENTE.map((t) => (
              <option key={t.id} value={t.id}>{t.texto}</option>
            ))}
          </select>
        </label>
        <label className={css.filtro}>
          Desde
          <input type="date" className="pt-input" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} style={{ padding: "0.45rem 0.7rem" }} />
        </label>
        <label className={css.filtro}>
          Hasta
          <input type="date" className="pt-input" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} style={{ padding: "0.45rem 0.7rem" }} />
        </label>
        {hayFiltroFecha && (
          <button type="button" className="pt-btn" onClick={() => { setTipo("todos"); setDesde(""); setHasta(""); }}>
            Quitar filtros
          </button>
        )}
      </div>

      {/* La proporción va por `--pt-cols` (no en gridTemplateColumns en línea:
          le ganaría a la media query y en el teléfono quedarían dos columnas
          cortadas). Mismo patrón que /admin/solicitudes. */}
      <div className={`pt-grid ${sel ? "pt-grid-2" : ""}`} style={{ "--pt-cols": sel ? "1.45fr 1fr" : "1fr", gap: "1.1rem", alignItems: "start" }}>
        <div>
        <div className={`pt-card ${css.tabla}`}>
          <div className="pt-tabla-wrap">
            <table className="pt-tabla" style={{ minWidth: 640 }}>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Fecha y hora</th>
                  <th>Chofer · unidad</th>
                  <th>Ruta</th>
                  <th>Parada</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {mensajeVacio && (
                  <tr><td colSpan={6} className="pt-vacio" style={errorCarga ? { color: "var(--pt-error)" } : undefined}>{mensajeVacio}</td></tr>
                )}
                {filas.map((i) => {
                  const urgente = i.estado === "abierto" && i.tipo === "accidente";
                  const activo = sel?.id === i.id;
                  return (
                    <tr
                      key={i.id}
                      onClick={() => abrir(i)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrir(i); } }}
                      tabIndex={0}
                      aria-selected={activo}
                      style={{
                        cursor: "pointer",
                        background: activo ? "var(--pt-accion-tinte)" : urgente ? "rgba(217, 119, 107, 0.07)" : undefined,
                      }}
                    >
                      {/* La raya roja a la izquierda marca el urgente aunque la
                          tabla se desplace de lado en el teléfono. */}
                      <td style={{ boxShadow: urgente ? "inset 3px 0 0 var(--pt-error)" : undefined }}>
                        <TipoIncidente tipo={i.tipo} />
                        {urgente && (
                          <span className="pt-badge mal" style={{ marginLeft: "0.5rem" }}>Urgente</span>
                        )}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>{fechaHora(i.creado)}</td>
                      <td>
                        <span style={{ display: "block" }}>{i.chofer}</span>
                        {i.unidad && <span style={{ color: "var(--mc-gris)", fontSize: "0.8rem" }}>Unidad {i.unidad}</span>}
                      </td>
                      <td>{i.ruta?.nombre || <span style={{ color: "var(--mc-gris)" }}>—</span>}</td>
                      <td style={{ maxWidth: 220 }}>
                        {i.cliente ? (
                          <>
                            <span style={{ display: "block" }}>{i.cliente}</span>
                            {i.folio && <span className="folio" style={{ fontSize: "0.78rem" }}>{i.folio}</span>}
                          </>
                        ) : (
                          <span style={{ color: "var(--mc-gris)" }}>—</span>
                        )}
                      </td>
                      <td><EstadoIncidente estado={i.estado} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* La misma lista, en tarjetas, solo en el teléfono (incidentes.module.css). */}
        <div className={css.tarjetas}>
          {mensajeVacio && (
            <div className="pt-vacio" style={errorCarga ? { color: "var(--pt-error)" } : undefined}>{mensajeVacio}</div>
          )}
          {filas.map((i) => {
            const urgente = i.estado === "abierto" && i.tipo === "accidente";
            return (
              <button
                key={i.id}
                type="button"
                onClick={() => abrir(i)}
                aria-pressed={sel?.id === i.id}
                className={`${css.tarjeta} ${urgente ? css.urgente : ""} ${sel?.id === i.id ? css.activa : ""}`}
              >
                <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
                  <TipoIncidente tipo={i.tipo} />
                  <EstadoIncidente estado={i.estado} urgente={urgente} />
                </span>
                <span style={{ display: "block", marginTop: "0.45rem", fontSize: "0.84rem" }}>
                  {fechaHora(i.creado)} · {i.chofer}{i.unidad ? ` · ${i.unidad}` : ""}
                </span>
                {(i.ruta || i.cliente) && (
                  <span style={{ display: "block", color: "var(--mc-gris)", fontSize: "0.8rem", marginTop: "0.15rem" }}>
                    {[i.ruta?.nombre, i.cliente].filter(Boolean).join(" · ")}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        </div>

        {sel && (
          <div ref={refDetalle} className={`pt-card ${css.detalle}`} style={{ position: "sticky", top: 90, scrollMarginTop: 80 }}>
            <div className="pt-card-head">
              <h2 style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <TipoIncidente tipo={sel.tipo} conTexto={false} />
                {infoTipo(sel.tipo).texto}
              </h2>
              <button type="button" className="pt-btn" onClick={() => setSelId(null)} aria-label="Cerrar el detalle"><X /></button>
            </div>

            {sel.estado === "abierto" && sel.tipo === "accidente" && (
              <p style={{ margin: "0 0 1rem", color: "var(--pt-error)", fontSize: "0.88rem" }}>
                <strong>Urgente.</strong> Confirma con el chofer que no hay heridos y si hace falta el seguro.
              </p>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.7rem", fontSize: "0.88rem", marginBottom: "1rem" }}>
              <Dato etiqueta="Reportado">{fechaHora(sel.creado)}</Dato>
              <Dato etiqueta="Chofer">{sel.chofer}</Dato>
              <Dato etiqueta="Unidad">{sel.unidad}</Dato>
              <Dato etiqueta="Ruta">{sel.ruta?.nombre}</Dato>
              {sel.retrasoMin != null && <Dato etiqueta="Retraso">{duracionEnLetra(sel.retrasoMin) || "0 minutos"}</Dato>}
              {/* Solo si el reporte trae contenedor: en un accidente o un
                  retraso un "Contenedor —" es ruido. */}
              {sel.contenedor && <Dato etiqueta="Contenedor">{sel.contenedor}</Dato>}
            </div>

            {(sel.cliente || sel.parada) && (
              <div style={{ fontSize: "0.88rem", marginBottom: "1rem" }}>
                <span style={{ color: "var(--mc-gris)", fontSize: "0.8rem" }}>Parada</span>
                <div>
                  <strong style={{ fontWeight: 500 }}>{sel.cliente || "—"}</strong>
                  {sel.folio && <span className="folio" style={{ marginLeft: "0.5rem", fontSize: "0.8rem" }}>{sel.folio}</span>}
                </div>
                {sel.parada && <div style={{ color: "var(--mc-gris)" }}>{sel.parada}</div>}
              </div>
            )}

            <div style={{ background: "var(--mc-blanco)", border: "1px solid var(--mc-linea)", borderRadius: 8, padding: "0.8rem", fontSize: "0.9rem", marginBottom: "1rem" }}>
              <span style={ETIQUETA}>Lo que dijo el chofer</span>
              <p style={{ margin: "0.4rem 0 0", whiteSpace: "pre-line", overflowWrap: "anywhere" }}>
                {sel.descripcion || <span style={{ color: "var(--mc-gris)" }}>Sin descripción.</span>}
              </p>
            </div>

            {sel.foto && (
              <div style={{ marginBottom: "1rem" }}>
                {foto.cargando ? (
                  <div className="pt-vacio" style={{ padding: "1.2rem" }}>Cargando la foto…</div>
                ) : foto.url ? (
                  <button
                    type="button"
                    onClick={() => setViendoFoto(true)}
                    aria-label="Ver la foto en grande"
                    style={{ display: "block", width: "100%", padding: 0, border: "1px solid var(--mc-linea)", borderRadius: 10, overflow: "hidden", background: "#0f1615", cursor: "zoom-in" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada que caduca: next/image la cachearía con otra vigencia */}
                    <img src={foto.url} alt="Foto del incidente" style={{ display: "block", width: "100%", maxHeight: 260, objectFit: "cover" }} />
                  </button>
                ) : (
                  <div className="pt-vacio" style={{ padding: "1.2rem" }}>
                    <ImageSquare style={{ fontSize: "1.4rem" }} /> No se pudo abrir la foto (puede que el enlace no esté disponible).
                  </div>
                )}
              </div>
            )}

            {(sel.ubicacion || sel.telefonoChofer || sel.tipo === "retraso") && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.1rem" }}>
              {sel.ubicacion && (
                <a className="pt-btn" href={enlaceVerEnMapa(sel.ubicacion)} target="_blank" rel="noopener noreferrer">
                  <MapPin /> Ver en el mapa
                </a>
              )}
              {sel.telefonoChofer && (
                <a className="pt-btn" href={`tel:+52${sel.telefonoChofer.replace(/\D/g, "").slice(-10)}`}>
                  <Phone /> Llamar a {sel.chofer.split(" ")[0]}
                </a>
              )}
              {sel.tipo === "retraso" && (
                <Link className="pt-btn" href={enlaceAvisoRetraso(sel)} prefetch={false}>
                  <Megaphone /> {sel.ruta ? "Avisar a los clientes de esta ruta" : "Avisar a los clientes"}
                </Link>
              )}
            </div>
            )}

            {sel.estado === "atendido" ? (
              <div style={{ background: "var(--pt-ok-tinte)", border: "1px solid rgba(111, 168, 103, 0.3)", borderRadius: 8, padding: "0.8rem", fontSize: "0.88rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--pt-ok)", fontWeight: 600, marginBottom: "0.3rem" }}>
                  <CheckCircle weight="bold" /> Atendido
                </div>
                <div style={{ color: "var(--mc-gris)", fontSize: "0.82rem" }}>
                  {sel.atendio ? `${sel.atendio} · ` : ""}{fechaHora(sel.atendidoEn)}
                </div>
                {sel.notaAtencion && <p style={{ margin: "0.4rem 0 0", whiteSpace: "pre-line", overflowWrap: "anywhere" }}>{sel.notaAtencion}</p>}
              </div>
            ) : (
              <div>
                <label htmlFor="nota-atencion" style={ETIQUETA}>Qué se hizo</label>
                <textarea
                  id="nota-atencion"
                  className="pt-input"
                  rows={3}
                  maxLength={MAX_NOTA}
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  placeholder="Ej. Se mandó la grúa; la ruta la termina la U-05."
                  style={{ marginTop: "0.4rem", resize: "vertical" }}
                />
                {errorAtender && (
                  <p role="alert" style={{ color: "var(--pt-error)", fontSize: "0.84rem", margin: "0.5rem 0 0" }}>{errorAtender}</p>
                )}
                <button
                  type="button"
                  className="pt-btn pt-btn-verde"
                  style={{ width: "100%", justifyContent: "center", marginTop: "0.7rem", padding: "0.65rem" }}
                  disabled={guardando}
                  onClick={atender}
                >
                  <CheckCircle /> {guardando ? "Guardando…" : "Marcar como atendido"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {viendoFoto && foto.url && (
        <VisorFoto
          fotos={[{ url: foto.url, etiqueta: infoTipo(sel?.tipo).texto, hora: sel ? fechaHora(sel.creado) : "" }]}
          indice={0}
          alCerrar={() => setViendoFoto(false)}
        />
      )}
    </>
  );
}
