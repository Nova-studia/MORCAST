"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, X, WarningCircle, Trash, PencilSimple } from "@phosphor-icons/react/dist/ssr";
import { listarUnidades, rutasPorUnidad, guardarUnidad, borrarUnidad } from "@/lib/datos-unidades";
import {
  TIPOS_UNIDAD,
  ESTADOS_UNIDAD,
  DIAS_AVISO,
  nombreTipoUnidad,
  etiquetaEstadoUnidad,
  estadoVencimiento,
  textoVencimiento,
  alertasDeFlota,
} from "@/lib/unidades.mjs";
import { fechaLarga } from "@/lib/portal-datos";

/**
 * `.pt-badge` trae ok / prog / ruta / mal, pero no "alerta" (en taller) ni
 * una apagada (baja). Se pintan aquí con los mismos tokens de estado en vez
 * de tocar portal.css, que comparten todas las pantallas.
 */
const ESTILO_INSIGNIA = {
  alerta: { background: "var(--pt-alerta-tinte)", color: "var(--pt-alerta)" },
  "": { background: "rgba(255,255,255,0.06)", color: "var(--mc-gris)" },
};
function Insignia({ clase, children }) {
  return <span className={`pt-badge ${clase}`} style={ESTILO_INSIGNIA[clase]}>{children}</span>;
}

/**
 * La ventana se monta en `.pt-body` y no aquí: `.mc-pagina` anima con
 * `transform`, y eso vuelve a esa capa el contenedor de lo `position: fixed`
 * (el fondo oscuro no tapaba la barra de arriba y la ventana se cortaba).
 * Misma pieza que `Ventana` en contenedores/piezas.js.
 */
function Ventana({ children }) {
  const destino = typeof document !== "undefined" ? document.querySelector(".pt-body") : null;
  return destino ? createPortal(children, destino) : children;
}

/** Color del aviso de vencimiento. Vencido es error; por vencer, alerta. */
const COLOR_NIVEL = { vencido: "var(--pt-error)", pronto: "var(--pt-alerta)", "sin-fecha": "var(--mc-gris)", ok: "var(--mc-gris)" };

const FILTROS = [
  // Por omisión se ven las que pueden salir a la calle: las de baja solo
  // estorban al buscar un camión, pero no se borran (tienen historia).
  { id: "operacion", texto: "En operación", pasa: (u) => u.estado !== "baja" },
  { id: "taller", texto: "En taller", pasa: (u) => u.estado === "taller" },
  { id: "baja", texto: "De baja", pasa: (u) => u.estado === "baja" },
  { id: "todas", texto: "Todas", pasa: () => true },
];

const VACIA = {
  numero_economico: "", placas: "", tipo: "roll-off", marca_modelo: "", anio: "",
  estado: "activa", vence_seguro: "", vence_verificacion: "", notas: "",
};

export default function UnidadesAdmin() {
  const [unidades, setUnidades] = useState([]);
  const [usos, setUsos] = useState({});
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState("operacion");
  // null = cerrado; { ...unidad } = editando; { ...VACIA } sin id = alta.
  const [editando, setEditando] = useState(null);

  useEffect(() => {
    let vivo = true;
    Promise.all([listarUnidades(), rutasPorUnidad()]).then(([lista, mapa]) => {
      if (!vivo) return;
      setUnidades(lista);
      setUsos(mapa);
      setCargando(false);
    });
    return () => { vivo = false; };
  }, []);

  const alertas = useMemo(() => alertasDeFlota(unidades), [unidades]);
  const pasa = FILTROS.find((f) => f.id === filtro).pasa;
  const lista = unidades.filter(pasa);
  const activas = unidades.filter((u) => u.estado === "activa").length;
  const enTaller = unidades.filter((u) => u.estado === "taller").length;

  /** Lo que devuelve el formulario: se reemplaza en la lista sin volver a pedirla. */
  const alGuardar = (u) => {
    setUnidades((l) => {
      const otra = l.filter((x) => x.id !== u.id);
      return [...otra, u].sort((a, b) => a.numero_economico.localeCompare(b.numero_economico, "es", { numeric: true }));
    });
    setEditando(null);
  };

  return (
    <>
      <div className="pt-page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1>Unidades</h1>
          <p>
            {unidades.length} unidades · {activas} activas
            {enTaller > 0 && <> · {enTaller} en taller</>}
            {alertas.length > 0 && <> · {alertas.length} {alertas.length === 1 ? "aviso" : "avisos"} de vencimiento</>}
          </p>
        </div>
        <button type="button" className="pt-btn pt-btn-naranja" onClick={() => setEditando({ ...VACIA })}>
          <Plus /> Nueva unidad
        </button>
      </div>

      {/* Los vencimientos van ARRIBA y no solo en su columna: con veinte
          camiones, una fecha roja en el renglón 17 no la ve nadie. */}
      {alertas.length > 0 && (
        <div
          className="pt-card"
          role="alert"
          style={{ marginBottom: "1.1rem", borderColor: "rgba(214,164,74,0.45)", background: "linear-gradient(180deg, var(--pt-alerta-tinte), transparent)" }}
        >
          <div className="pt-card-head" style={{ marginBottom: "0.7rem" }}>
            <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <WarningCircle aria-hidden="true" style={{ color: "var(--pt-alerta)" }} />
              Seguros y verificaciones
            </h2>
          </div>
          <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: "0.45rem" }}>
            {alertas.map((a) => (
              <li key={`${a.unidadId}-${a.que}`} style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem 0.7rem", alignItems: "baseline", fontSize: "0.9rem" }}>
                <button
                  type="button"
                  className="pt-btn"
                  style={{ padding: "0.2rem 0.55rem", fontFamily: "var(--fuente-mono), monospace" }}
                  onClick={() => setEditando({ ...VACIA, ...unidades.find((u) => u.id === a.unidadId) })}
                  title="Abrir la unidad para poner la fecha nueva"
                >
                  {a.numero}
                </button>
                <span>{a.que}:</span>
                <strong style={{ color: COLOR_NIVEL[a.nivel] }}>{textoVencimiento(a)}</strong>
                <span className="folio" style={{ color: "var(--mc-gris)", fontSize: "0.8rem" }}>{fechaLarga(a.fecha)}</span>
              </li>
            ))}
          </ul>
          <p style={{ margin: "0.8rem 0 0", fontSize: "0.8rem", color: "var(--mc-gris)" }}>
            Avisa desde {DIAS_AVISO} días antes. Al renovar, abre la unidad y pon la fecha nueva.
          </p>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "1rem" }}>
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`pt-chip ${filtro === f.id ? "activo" : ""}`}
            onClick={() => setFiltro(f.id)}
          >
            {f.texto} ({unidades.filter(f.pasa).length})
          </button>
        ))}
      </div>

      <div className="pt-card">
        {cargando ? (
          <div className="pt-vacio">Cargando unidades…</div>
        ) : lista.length === 0 ? (
          <div className="pt-vacio">
            {unidades.length === 0
              ? <>Todavía no hay unidades. Da de alta la primera con <strong>Nueva unidad</strong>.</>
              : "No hay unidades en este filtro."}
          </div>
        ) : (
          <div className="pt-tabla-wrap">
            <table className="pt-tabla pt-tabla-compacta" style={{ minWidth: 820 }}>
              <thead>
                <tr>
                  <th>Unidad</th>
                  <th>Placas</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Seguro</th>
                  <th>Verificación</th>
                  <th>Rutas</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {lista.map((u) => {
                  const est = etiquetaEstadoUnidad(u.estado);
                  const rutas = usos[u.id] || [];
                  return (
                    <tr key={u.id} style={u.estado === "baja" ? { opacity: 0.6 } : undefined}>
                      <td style={{ minWidth: 180 }}>
                        <strong className="folio" style={{ display: "block" }}>{u.numero_economico}</strong>
                        <span style={{ color: "var(--mc-gris)", fontSize: "0.8rem" }}>
                          {[u.marca_modelo, u.anio].filter(Boolean).join(" · ") || "—"}
                        </span>
                      </td>
                      <td className="folio">{u.placas || <span style={{ color: "var(--mc-gris)" }}>—</span>}</td>
                      <td>{nombreTipoUnidad(u.tipo)}</td>
                      <td><Insignia clase={est.clase}>{est.texto}</Insignia></td>
                      <td><Vence fecha={u.vence_seguro} apagado={u.estado === "baja"} /></td>
                      <td><Vence fecha={u.vence_verificacion} apagado={u.estado === "baja"} /></td>
                      <td title={rutas.join(", ")}>
                        {rutas.length ? rutas.join(", ") : <span style={{ color: "var(--mc-gris)" }}>—</span>}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="pt-btn"
                          onClick={() => setEditando({ ...VACIA, ...u })}
                          aria-label={`Editar la unidad ${u.numero_economico}`}
                        >
                          <PencilSimple /> Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editando && (
        <FormUnidad
          inicial={editando}
          rutas={usos[editando.id] || []}
          onCerrar={() => setEditando(null)}
          onGuardado={alGuardar}
          onBorrada={(id) => { setUnidades((l) => l.filter((x) => x.id !== id)); setEditando(null); }}
        />
      )}
    </>
  );
}

/** Fecha de vencimiento con su aviso debajo. */
function Vence({ fecha, apagado }) {
  const e = estadoVencimiento(fecha);
  if (!fecha) return <span style={{ color: "var(--mc-gris)", fontSize: "0.82rem" }}>Sin fecha</span>;
  const avisa = !apagado && (e.nivel === "vencido" || e.nivel === "pronto");
  return (
    <>
      <span className="folio" style={{ display: "block", fontSize: "0.84rem" }}>{fechaLarga(fecha)}</span>
      {avisa && (
        <span style={{ color: COLOR_NIVEL[e.nivel], fontSize: "0.78rem", fontWeight: 600 }}>{textoVencimiento(e)}</span>
      )}
    </>
  );
}

/* ==================================================================== */
/* Alta y edición                                                       */
/* ==================================================================== */

function FormUnidad({ inicial, rutas, onCerrar, onGuardado, onBorrada }) {
  const [f, setF] = useState(() => ({
    ...inicial,
    anio: inicial.anio ?? "",
    placas: inicial.placas ?? "",
    marca_modelo: inicial.marca_modelo ?? "",
    vence_seguro: inicial.vence_seguro ?? "",
    vence_verificacion: inicial.vence_verificacion ?? "",
    notas: inicial.notas ?? "",
  }));
  const [errores, setErrores] = useState({});
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const esAlta = !inicial.id;

  // Escape cierra, como cualquier ventana. No se cierra al tocar el fondo:
  // un toque de más perdería todo lo capturado.
  useEffect(() => {
    const tecla = (e) => { if (e.key === "Escape" && !ocupado) onCerrar(); };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [ocupado, onCerrar]);

  const cambia = (campo) => (e) => setF({ ...f, [campo]: e.target.value });

  const guardar = async (datos = f) => {
    setOcupado(true);
    setAviso("");
    const r = await guardarUnidad(datos);
    setOcupado(false);
    if (!r.ok) {
      setErrores(r.errores || {});
      setAviso(r.motivo);
      return;
    }
    onGuardado(r.unidad);
  };

  const enviar = (e) => { e.preventDefault(); guardar(); };

  const borrar = async () => {
    setOcupado(true);
    setAviso("");
    const r = await borrarUnidad(inicial);
    setOcupado(false);
    setConfirmarBorrado(false);
    if (!r.ok) { setAviso(r.motivo); return; }
    onBorrada(inicial.id);
  };

  // Se llama como función y no como <Componente>: definido aquí adentro,
  // React lo vería como un componente NUEVO en cada render y desmontaría el
  // campo con cada letra (se pierde el foco al teclear).
  const conEtiqueta = ({ campo, etiqueta, children, ancho }) => (
    <div className="pt-campo" style={{ margin: 0, gridColumn: ancho ? "1 / -1" : undefined }}>
      <label htmlFor={`u-${campo}`}>{etiqueta}</label>
      {children}
      {errores[campo] && (
        <span style={{ display: "block", color: "var(--pt-error)", fontSize: "0.78rem", marginTop: 4 }}>{errores[campo]}</span>
      )}
    </div>
  );

  return (
    <Ventana>
    <div className="pt-modal-fondo">
      <div className="pt-modal" role="dialog" aria-modal="true" aria-labelledby="u-titulo">
        <div className="pt-modal-head">
          <div>
            <strong id="u-titulo">{esAlta ? "Nueva unidad" : `Unidad ${inicial.numero_economico}`}</strong>
            <span>{esAlta ? "El número económico es el que va pintado en la puerta." : nombreTipoUnidad(inicial.tipo)}</span>
          </div>
          <button type="button" className="pt-btn" onClick={onCerrar} aria-label="Cerrar" disabled={ocupado}><X /></button>
        </div>

        {/* noValidate: los errores los dice validarUnidad(), en español y junto
            a cada campo, no el globo del navegador en el idioma del sistema. */}
        <form onSubmit={enviar} noValidate style={{ padding: "1.2rem" }}>
          <div className="pt-grid pt-grid-2" style={{ gap: "0.9rem" }}>
            {conEtiqueta({ campo: "numero_economico", etiqueta: "Número económico", children: (
              <input id="u-numero_economico" className="pt-input" required autoFocus={esAlta} value={f.numero_economico} onChange={cambia("numero_economico")} placeholder="U-04" style={{ fontFamily: "var(--fuente-mono), monospace" }} />
            ) })}
            {conEtiqueta({ campo: "placas", etiqueta: "Placas", children: (
              <input id="u-placas" className="pt-input" value={f.placas} onChange={cambia("placas")} placeholder="XA-12-345" style={{ fontFamily: "var(--fuente-mono), monospace" }} />
            ) })}
            {conEtiqueta({ campo: "tipo", etiqueta: "Tipo", children: (
              <select id="u-tipo" className="pt-input" value={f.tipo} onChange={cambia("tipo")}>
                {TIPOS_UNIDAD.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            ) })}
            {conEtiqueta({ campo: "estado", etiqueta: "Estado", children: (
              <select id="u-estado" className="pt-input" value={f.estado} onChange={cambia("estado")}>
                {ESTADOS_UNIDAD.map((e) => <option key={e.id} value={e.id}>{e.texto}</option>)}
              </select>
            ) })}
            {conEtiqueta({ campo: "marca_modelo", etiqueta: "Marca y modelo", children: (
              <input id="u-marca_modelo" className="pt-input" value={f.marca_modelo} onChange={cambia("marca_modelo")} placeholder="International 4300" />
            ) })}
            {conEtiqueta({ campo: "anio", etiqueta: "Año", children: (
              <input id="u-anio" className="pt-input" type="number" inputMode="numeric" min="1980" max="2100" value={f.anio} onChange={cambia("anio")} placeholder="2019" />
            ) })}
            {conEtiqueta({ campo: "vence_seguro", etiqueta: "Vence el seguro", children: (
              <input id="u-vence_seguro" className="pt-input" type="date" value={f.vence_seguro} onChange={cambia("vence_seguro")} style={{ colorScheme: "dark" }} />
            ) })}
            {conEtiqueta({ campo: "vence_verificacion", etiqueta: "Vence la verificación", children: (
              <input id="u-vence_verificacion" className="pt-input" type="date" value={f.vence_verificacion} onChange={cambia("vence_verificacion")} style={{ colorScheme: "dark" }} />
            ) })}
            {conEtiqueta({ campo: "notas", etiqueta: "Notas", ancho: true, children: (
              <textarea id="u-notas" className="pt-input" rows={3} value={f.notas} onChange={cambia("notas")} placeholder="Taller, llantas, lo que haga falta recordar." />
            ) })}
          </div>

          {aviso && (
            <div className="pt-login-error" role="alert" style={{ marginTop: "1rem", marginBottom: 0 }}>{aviso}</div>
          )}

          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center", marginTop: "1.1rem" }}>
            <button type="submit" className="pt-btn pt-btn-naranja" disabled={ocupado}>
              {ocupado ? "Guardando…" : esAlta ? "Dar de alta" : "Guardar cambios"}
            </button>
            <button type="button" className="pt-btn" onClick={onCerrar} disabled={ocupado}>Cancelar</button>
          </div>

          {/* ---------- Baja y borrado ---------- */}
          {!esAlta && (
            <div style={{ marginTop: "1.3rem", paddingTop: "1rem", borderTop: "1px solid var(--mc-linea)" }}>
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
                {inicial.estado !== "baja" ? (
                  <button type="button" className="pt-btn" disabled={ocupado} onClick={() => guardar({ ...f, estado: "baja" })}>
                    Dar de baja
                  </button>
                ) : (
                  <button type="button" className="pt-btn" disabled={ocupado} onClick={() => guardar({ ...f, estado: "activa" })}>
                    Reactivar
                  </button>
                )}
                {!confirmarBorrado ? (
                  <button type="button" className="pt-btn" disabled={ocupado} onClick={() => { setAviso(""); setConfirmarBorrado(true); }}>
                    <Trash /> Eliminar
                  </button>
                ) : (
                  <>
                    <span style={{ fontSize: "0.86rem" }}>¿Eliminar <strong>{inicial.numero_economico}</strong>? No se puede deshacer.</span>
                    <button type="button" className="pt-btn" style={{ borderColor: "var(--pt-error)", color: "var(--pt-error)" }} disabled={ocupado} onClick={borrar}>
                      Sí, eliminar
                    </button>
                    <button type="button" className="pt-btn" onClick={() => setConfirmarBorrado(false)}>Cancelar</button>
                  </>
                )}
              </div>
              <p style={{ margin: "0.7rem 0 0", fontSize: "0.82rem", color: "var(--mc-gris)" }}>
                {rutas.length
                  ? `La usa: ${rutas.join(", ")}. `
                  : ""}
                Dar de baja la quita de la lista de unidades al asignar rutas y conserva su historia.
                Eliminar solo se permite si ninguna ruta, incidente ni viaje al relleno la usa.
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
    </Ventana>
  );
}
