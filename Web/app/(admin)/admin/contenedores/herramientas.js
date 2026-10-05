"use client";

import { useMemo, useState } from "react";
import { CheckCircle, Printer, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import {
  ESTADOS_CONTENEDOR,
  MAX_LOTE,
  MAX_IMPORTAR,
  planLote,
  siguienteCodigoLibre,
  validarContenedor,
  parsearPegado,
  validarImportacion,
  comprimirCodigos,
} from "@/lib/contenedores.mjs";
import { crearContenedores } from "@/lib/datos-contenedores";
import { ElegirPunto, ErrorCampo, InsigniaEstado } from "./piezas";

/**
 * Las tres maneras de dar de alta contenedores: uno por uno, un lote de
 * códigos seguidos (para imprimir las etiquetas ANTES de salir a pegarlas) y
 * pegando el inventario desde Excel cuando la empresa lo termine.
 *
 * Las tres pasan por `crearContenedores()`, que se brinca los códigos que ya
 * existen en vez de pisarlos.
 */

/** Liga a la hoja de etiquetas para una lista de códigos. */
export function enlaceEtiquetas(codigos) {
  return `/admin/contenedores/etiquetas?c=${comprimirCodigos(codigos)}`;
}

/** Lo que se dice al terminar de guardar: cuántos, cuáles se saltaron y sus etiquetas. */
function Resultado({ r, onOtra }) {
  if (!r) return null;
  const codigos = r.creados.map((c) => c.codigo);
  return (
    <div className="pt-exito" role="status" style={{ marginTop: "1rem", flexWrap: "wrap" }}>
      <CheckCircle aria-hidden="true" />
      <div style={{ flex: "1 1 240px" }}>
        <strong>
          {codigos.length === 1 ? `Se creó ${codigos[0]}` : `Se crearon ${codigos.length} contenedores`}
        </strong>
        {r.saltados.length > 0 && (
          <span style={{ display: "block" }}>
            {r.saltados.length === 1 ? "Ya existía y se saltó: " : `Ya existían ${r.saltados.length} y se saltaron: `}
            <span className="folio">{resumirCodigos(r.saltados)}</span>
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {codigos.length > 0 && (
          <a className="pt-btn" href={enlaceEtiquetas(codigos)} target="_blank" rel="noopener">
            <Printer /> Imprimir {codigos.length === 1 ? "su etiqueta" : "sus etiquetas"}
          </a>
        )}
        {onOtra && <button type="button" className="pt-btn" onClick={onOtra}>Crear más</button>}
      </div>
    </div>
  );
}

/** "MOR-C-0002, MOR-C-0004 y 12 más": una lista larga no se pega entera. */
function resumirCodigos(codigos, max = 6) {
  if (codigos.length <= max) return codigos.join(", ");
  return `${codigos.slice(0, max).join(", ")} y ${codigos.length - max} más`;
}

const estiloEtiqueta = { margin: 0 };

/* ==================================================================== */
/* Alta individual                                                      */
/* ==================================================================== */

export function AltaContenedor({ existentes, clientes, onCreados }) {
  const sugerido = useMemo(() => siguienteCodigoLibre(existentes), [existentes]);
  const [f, setF] = useState({ codigo: "", tipo: "contenedor", medida: "", estado: "en-servicio", domicilio_id: null, notas: "" });
  const [errores, setErrores] = useState({});
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState(null);

  const cambia = (campo) => (e) => setF({ ...f, [campo]: e.target.value });

  const enviar = async (e) => {
    e.preventDefault();
    setAviso("");
    const v = validarContenedor({ ...f, codigo: f.codigo || sugerido });
    if (!v.ok) { setErrores(v.errores); return; }
    setErrores({});
    if (existentes.includes(v.datos.codigo)) {
      setErrores({ codigo: `${v.datos.codigo} ya existe. El siguiente libre es ${sugerido}.` });
      return;
    }
    setOcupado(true);
    const r = await crearContenedores([v.datos]);
    setOcupado(false);
    if (!r.ok) { setAviso(r.motivo); return; }
    if (!r.creados.length) { setErrores({ codigo: `${v.datos.codigo} ya existe (alguien más lo acaba de crear).` }); return; }
    setResultado(r);
    onCreados(r.creados);
    setF({ ...f, codigo: "", notas: "", domicilio_id: null });
  };

  return (
    <form onSubmit={enviar}>
      <div className="pt-grid pt-grid-3" style={{ gap: "0.9rem" }}>
        <div className="pt-campo" style={estiloEtiqueta}>
          <label htmlFor="alta-codigo">Código</label>
          <input id="alta-codigo" className="pt-input" value={f.codigo} onChange={cambia("codigo")} placeholder={sugerido} style={{ fontFamily: "var(--fuente-mono), monospace" }} />
          <ErrorCampo>{errores.codigo}</ErrorCampo>
          {!errores.codigo && (
            <span style={{ display: "block", color: "var(--mc-gris)", fontSize: "0.76rem", marginTop: 4 }}>
              Vacío = el siguiente libre ({sugerido}).
            </span>
          )}
        </div>
        <div className="pt-campo" style={estiloEtiqueta}>
          <label htmlFor="alta-tipo">Tipo</label>
          <input id="alta-tipo" className="pt-input" list="cont-tipos" value={f.tipo} onChange={cambia("tipo")} />
          <ErrorCampo>{errores.tipo}</ErrorCampo>
        </div>
        <div className="pt-campo" style={estiloEtiqueta}>
          <label htmlFor="alta-medida">Medida</label>
          <input id="alta-medida" className="pt-input" list="cont-medidas" value={f.medida} onChange={cambia("medida")} placeholder="3 m³" />
          <ErrorCampo>{errores.medida}</ErrorCampo>
        </div>
        <div className="pt-campo" style={estiloEtiqueta}>
          <label htmlFor="alta-estado">Estado</label>
          <select id="alta-estado" className="pt-input" value={f.estado} onChange={cambia("estado")}>
            {ESTADOS_CONTENEDOR.map((e) => <option key={e.id} value={e.id}>{e.texto}</option>)}
          </select>
        </div>
        <div className="pt-campo" style={{ ...estiloEtiqueta, gridColumn: "span 2" }}>
          <label htmlFor="alta-punto">Punto donde está</label>
          {/* La `key` lo reinicia tras cada alta: si no, se quedaría con la
              empresa de la vez anterior elegida por dentro. */}
          <ElegirPunto key={resultado?.creados?.[0]?.codigo || "nuevo"} id="alta-punto" clientes={clientes} valor={f.domicilio_id} onCambio={(d) => setF((x) => ({ ...x, domicilio_id: d }))} />
        </div>
        <div className="pt-campo" style={{ ...estiloEtiqueta, gridColumn: "1 / -1" }}>
          <label htmlFor="alta-notas">Notas</label>
          <input id="alta-notas" className="pt-input" value={f.notas} onChange={cambia("notas")} placeholder="Opcional" />
          <ErrorCampo>{errores.notas}</ErrorCampo>
        </div>
      </div>
      {aviso && <div className="pt-login-error" role="alert" style={{ marginTop: "1rem", marginBottom: 0 }}>{aviso}</div>}
      <button type="submit" className="pt-btn pt-btn-naranja" disabled={ocupado} style={{ marginTop: "1rem" }}>
        {ocupado ? "Guardando…" : `Crear ${f.codigo ? "contenedor" : sugerido}`}
      </button>
      <Resultado r={resultado} />
    </form>
  );
}

/* ==================================================================== */
/* Alta en lote                                                         */
/* ==================================================================== */

export function LoteContenedores({ existentes, onCreados }) {
  const sugerido = useMemo(() => siguienteCodigoLibre(existentes), [existentes]);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [tipo, setTipo] = useState("contenedor");
  const [medida, setMedida] = useState("");
  const [estado, setEstado] = useState("en-bodega");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState(null);

  // La vista previa se calcula mientras se teclea: antes de pulsar nada se
  // ve cuántos se van a crear y cuáles se saltan.
  const plan = hasta.trim() ? planLote(desde.trim() || sugerido, hasta, existentes) : null;
  const validoTipo = validarContenedor({ codigo: "1", tipo, medida });

  const crear = async (e) => {
    e.preventDefault();
    setAviso("");
    if (!plan?.ok || !plan.crear.length) return;
    if (!validoTipo.ok) { setAviso(Object.values(validoTipo.errores).join(" ")); return; }
    setOcupado(true);
    const r = await crearContenedores(plan.crear.map((codigo) => ({ codigo, tipo, medida, estado })));
    setOcupado(false);
    if (!r.ok) {
      setAviso(r.motivo);
      if (r.creados?.length) onCreados(r.creados);
      return;
    }
    // Los que ya existían de antes también se reportan como saltados.
    setResultado({ ...r, saltados: [...plan.yaExisten, ...r.saltados] });
    onCreados(r.creados);
    setDesde("");
    setHasta("");
  };

  return (
    <form onSubmit={crear}>
      <p style={{ margin: "0 0 1rem", fontSize: "0.88rem", color: "var(--mc-gris)", maxWidth: "62ch" }}>
        Para imprimir las etiquetas antes de salir a pegarlas. Nacen sin punto; al
        pegar cada etiqueta se le asigna su cliente aquí, o el inventario de Excel lo hace de una vez.
      </p>
      <div className="pt-grid pt-grid-3" style={{ gap: "0.9rem" }}>
        <div className="pt-campo" style={estiloEtiqueta}>
          <label htmlFor="lote-desde">Del código</label>
          <input id="lote-desde" className="pt-input" value={desde} onChange={(e) => setDesde(e.target.value)} placeholder={sugerido} style={{ fontFamily: "var(--fuente-mono), monospace" }} />
        </div>
        <div className="pt-campo" style={estiloEtiqueta}>
          <label htmlFor="lote-hasta">Al código</label>
          <input id="lote-hasta" className="pt-input" required value={hasta} onChange={(e) => setHasta(e.target.value)} placeholder="MOR-C-0050" style={{ fontFamily: "var(--fuente-mono), monospace" }} />
        </div>
        <div className="pt-campo" style={estiloEtiqueta}>
          <label htmlFor="lote-estado">Estado</label>
          <select id="lote-estado" className="pt-input" value={estado} onChange={(e) => setEstado(e.target.value)}>
            {ESTADOS_CONTENEDOR.map((x) => <option key={x.id} value={x.id}>{x.texto}</option>)}
          </select>
        </div>
        <div className="pt-campo" style={estiloEtiqueta}>
          <label htmlFor="lote-tipo">Tipo</label>
          <input id="lote-tipo" className="pt-input" list="cont-tipos" value={tipo} onChange={(e) => setTipo(e.target.value)} />
        </div>
        <div className="pt-campo" style={estiloEtiqueta}>
          <label htmlFor="lote-medida">Medida</label>
          <input id="lote-medida" className="pt-input" list="cont-medidas" value={medida} onChange={(e) => setMedida(e.target.value)} placeholder="3 m³" />
        </div>
      </div>

      {plan && (
        <div style={{ marginTop: "1rem", fontSize: "0.88rem" }} aria-live="polite">
          {!plan.ok ? (
            <span style={{ color: "var(--pt-error)" }}>{plan.motivo}</span>
          ) : (
            <>
              <strong>Se crearán {plan.crear.length}</strong>
              {plan.crear.length > 0 && (
                <span className="folio" style={{ color: "var(--mc-gris)" }}>
                  {" "}({plan.crear[0]}{plan.crear.length > 1 ? ` … ${plan.crear[plan.crear.length - 1]}` : ""})
                </span>
              )}
              {plan.yaExisten.length > 0 && (
                <span style={{ display: "block", color: "var(--pt-alerta)", marginTop: 4 }}>
                  Ya existen {plan.yaExisten.length} y se saltan sin tocarlos: <span className="folio">{resumirCodigos(plan.yaExisten)}</span>
                </span>
              )}
            </>
          )}
        </div>
      )}

      {aviso && <div className="pt-login-error" role="alert" style={{ marginTop: "1rem", marginBottom: 0 }}>{aviso}</div>}
      <button
        type="submit"
        className="pt-btn pt-btn-naranja"
        disabled={ocupado || !plan?.ok || !plan.crear.length}
        style={{ marginTop: "1rem" }}
      >
        {ocupado ? "Creando…" : plan?.ok && plan.crear.length ? `Crear ${plan.crear.length} contenedores` : "Crear lote"}
      </button>
      <span style={{ marginLeft: "0.8rem", fontSize: "0.78rem", color: "var(--mc-gris)" }}>Máximo {MAX_LOTE} por lote.</span>
      <Resultado r={resultado} />
    </form>
  );
}

/* ==================================================================== */
/* Importar desde Excel                                                 */
/* ==================================================================== */

const ESTADO_FILA = {
  nuevo: { texto: "Se crea", color: "var(--pt-ok)" },
  "ya-existe": { texto: "Ya existe", color: "var(--mc-gris)" },
  repetido: { texto: "Repetido", color: "var(--mc-gris)" },
  error: { texto: "Error", color: "var(--pt-error)" },
};

export function ImportarExcel({ existentes, clientes, onCreados }) {
  const [texto, setTexto] = useState("");
  const [vista, setVista] = useState(null);
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState(null);

  const revisar = () => {
    setAviso("");
    setResultado(null);
    const filas = parsearPegado(texto);
    if (!filas.length) { setAviso("No hay nada que revisar: pega las columnas copiadas de Excel."); setVista(null); return; }
    if (filas.length > MAX_IMPORTAR) {
      setAviso(`Son ${filas.length} renglones; el máximo por importación es ${MAX_IMPORTAR}. Pégalo en partes.`);
      setVista(null);
      return;
    }
    setVista(validarImportacion(filas, { existentes, clientes }));
  };

  const guardar = async () => {
    const nuevos = vista.filas.filter((f) => f.estado === "nuevo");
    if (!nuevos.length) return;
    setOcupado(true);
    setAviso("");
    const r = await crearContenedores(
      nuevos.map((f) => ({ codigo: f.codigo, tipo: f.tipo, medida: f.medida, estado: f.domicilio_id ? "en-servicio" : "en-bodega", domicilio_id: f.domicilio_id }))
    );
    setOcupado(false);
    if (!r.ok) {
      setAviso(r.motivo);
      if (r.creados?.length) onCreados(r.creados);
      return;
    }
    const yaExistian = vista.filas.filter((f) => f.estado === "ya-existe").map((f) => f.codigo);
    setResultado({ ...r, saltados: [...yaExistian, ...r.saltados] });
    onCreados(r.creados);
    setVista(null);
    setTexto("");
  };

  return (
    <div>
      <p style={{ margin: "0 0 0.8rem", fontSize: "0.88rem", color: "var(--mc-gris)", maxWidth: "62ch" }}>
        En Excel, selecciona las columnas en este orden y cópialas (Ctrl+C):
        <strong style={{ color: "var(--mc-tinta)" }}> código, tipo, medida</strong> y, si las tienes,
        <strong style={{ color: "var(--mc-tinta)" }}> empresa y punto</strong>. Pégalas aquí. Nada se guarda hasta revisar la vista previa.
      </p>
      <textarea
        className="pt-input"
        rows={7}
        value={texto}
        onChange={(e) => { setTexto(e.target.value); setVista(null); }}
        placeholder={"MOR-C-0001\tTolva\t30 m³\tIndustrias del Golfo\tPlanta 1\nMOR-C-0002\tContenedor\t3 m³\tVidriera Matamoros\tMatriz"}
        style={{ fontFamily: "var(--fuente-mono), monospace", fontSize: "0.84rem", whiteSpace: "pre" }}
        aria-label="Columnas pegadas de Excel"
      />
      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.8rem" }}>
        <button type="button" className={`pt-btn ${vista ? "" : "pt-btn-naranja"}`} onClick={revisar} disabled={!texto.trim()}>
          Revisar
        </button>
        {vista && (
          <button type="button" className="pt-btn pt-btn-naranja" onClick={guardar} disabled={ocupado || !vista.resumen.nuevos}>
            {ocupado ? "Guardando…" : `Guardar ${vista.resumen.nuevos} contenedores`}
          </button>
        )}
      </div>
      {aviso && <div className="pt-login-error" role="alert" style={{ marginTop: "1rem", marginBottom: 0 }}>{aviso}</div>}

      {vista && (
        <div style={{ marginTop: "1rem" }}>
          <p style={{ margin: "0 0 0.6rem", fontSize: "0.88rem" }} aria-live="polite">
            <strong>{vista.resumen.nuevos} se crean</strong>
            {vista.resumen.sinAsignar > 0 && <span style={{ color: "var(--pt-alerta)" }}> · {vista.resumen.sinAsignar} quedan sin asignar</span>}
            {vista.resumen.yaExisten > 0 && <> · {vista.resumen.yaExisten} ya existen y se saltan</>}
            {vista.resumen.repetidos > 0 && <> · {vista.resumen.repetidos} {vista.resumen.repetidos === 1 ? "repetido" : "repetidos"}</>}
            {vista.resumen.errores > 0 && <span style={{ color: "var(--pt-error)" }}> · {vista.resumen.errores} con error (no se guardan)</span>}
          </p>
          <div className="pt-tabla-wrap" style={{ maxHeight: 420, overflowY: "auto" }}>
            <table className="pt-tabla pt-tabla-compacta" style={{ minWidth: 760 }}>
              <thead>
                <tr><th className="num">Renglón</th><th>Código</th><th>Tipo</th><th>Medida</th><th>Punto</th><th>Qué pasa</th></tr>
              </thead>
              <tbody>
                {vista.filas.map((f) => (
                  <tr key={f.linea}>
                    <td className="num" style={{ color: "var(--mc-gris)" }}>{f.linea}</td>
                    <td className="folio">{f.codigo || <span style={{ color: "var(--pt-error)" }}>{f.original || "—"}</span>}</td>
                    <td>{f.tipo || "—"}</td>
                    <td>{f.medida || "—"}</td>
                    <td>
                      {f.domicilio_id ? (
                        <>{f.cliente} <span style={{ color: "var(--mc-gris)" }}>· {f.puntoAlias}</span></>
                      ) : f.estado === "nuevo" ? (
                        <span style={{ color: f.aviso ? "var(--pt-alerta)" : "var(--mc-gris)" }}>Sin asignar</span>
                      ) : "—"}
                    </td>
                    <td style={{ fontSize: "0.82rem" }}>
                      <strong style={{ color: ESTADO_FILA[f.estado].color }}>{ESTADO_FILA[f.estado].texto}</strong>
                      {f.aviso && (
                        <span style={{ display: "flex", gap: 5, alignItems: "flex-start", color: "var(--mc-gris)", marginTop: 2 }}>
                          {f.estado === "nuevo" && <WarningCircle aria-hidden="true" style={{ color: "var(--pt-alerta)", flexShrink: 0, marginTop: 2 }} />}
                          {f.aviso}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ margin: "0.6rem 0 0", fontSize: "0.8rem", color: "var(--mc-gris)" }}>
            Los que tienen punto entran <InsigniaEstado estado="en-servicio" />; los que no, <InsigniaEstado estado="en-bodega" />.
            Los que quedan sin asignar se arreglan después, uno por uno, desde la lista.
          </p>
        </div>
      )}
      <Resultado r={resultado} />
    </div>
  );
}
