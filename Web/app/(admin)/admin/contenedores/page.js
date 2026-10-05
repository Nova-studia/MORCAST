"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Stack, FileXls, Printer, MagnifyingGlass, PencilSimple, X } from "@phosphor-icons/react/dist/ssr";
import { listarContenedores, listarClientesConPuntos } from "@/lib/datos-contenedores";
import { ESTADOS_CONTENEDOR } from "@/lib/contenedores.mjs";
import { InsigniaEstado, Sugerencias } from "./piezas";
import { AltaContenedor, LoteContenedores, ImportarExcel, enlaceEtiquetas } from "./herramientas";
import EditarContenedor from "./editar";

/**
 * INVENTARIO DE CONTENEDORES (pedido de los dueños, 4-oct-2026).
 *
 * Cada contenedor lleva un código MOR-C-0001 impreso en una etiqueta con QR
 * que el chofer escanea al recoger. Desde aquí se dan de alta (uno, en lote
 * o pegando el Excel del inventario), se asignan a su cliente y punto, y se
 * imprimen las etiquetas.
 */

const HERRAMIENTAS = [
  { id: "alta", texto: "Nuevo contenedor", icono: Plus, titulo: "Alta de un contenedor" },
  { id: "lote", texto: "Crear en lote", icono: Stack, titulo: "Alta en lote" },
  { id: "importar", texto: "Importar de Excel", icono: FileXls, titulo: "Importar el inventario desde Excel" },
];

/** Una tabla con mil renglones se arrastra al teclear en el buscador. */
const POR_TANDA = 200;

export default function ContenedoresAdmin() {
  const [lista, setLista] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [herramienta, setHerramienta] = useState(null);
  const [editando, setEditando] = useState(null);

  // Filtros
  const [estado, setEstado] = useState("todos");
  const [sinAsignar, setSinAsignar] = useState(false);
  const [clienteId, setClienteId] = useState("");
  const [puntoId, setPuntoId] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [visibles, setVisibles] = useState(POR_TANDA);

  // Selección para imprimir etiquetas: por código, que es lo que lleva la hoja.
  const [seleccion, setSeleccion] = useState(() => new Set());

  useEffect(() => {
    let vivo = true;
    Promise.all([listarContenedores(), listarClientesConPuntos()]).then(([inv, cl]) => {
      if (!vivo) return;
      setLista(inv);
      setClientes(cl);
      setCargando(false);
    });
    return () => { vivo = false; };
  }, []);

  const codigos = useMemo(() => lista.map((c) => c.codigo), [lista]);
  const cliente = clientes.find((c) => c.id === clienteId) || null;

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toUpperCase();
    return lista.filter((c) => {
      if (estado !== "todos" && c.estado !== estado) return false;
      if (sinAsignar && c.domicilioId) return false;
      if (clienteId && c.cliente?.id !== clienteId) return false;
      if (puntoId && c.domicilioId !== puntoId) return false;
      // "421" encuentra el MOR-C-0421: nadie teclea el prefijo para buscar.
      if (q && !c.codigo.includes(q)) return false;
      return true;
    });
  }, [lista, estado, sinAsignar, clienteId, puntoId, busqueda]);

  // Al cambiar un filtro se vuelve a la primera tanda.
  useEffect(() => { setVisibles(POR_TANDA); }, [estado, sinAsignar, clienteId, puntoId, busqueda]);

  const alCrear = useCallback((nuevos) => {
    setLista((l) => [...l, ...nuevos].sort((a, b) => a.codigo.localeCompare(b.codigo)));
  }, []);

  const alGuardar = (c) => {
    setLista((l) => l.map((x) => (x.id === c.id ? c : x)));
    setEditando(null);
  };

  const alBorrar = (id) => {
    const borrado = lista.find((x) => x.id === id);
    setLista((l) => l.filter((x) => x.id !== id));
    if (borrado) setSeleccion((s) => { const n = new Set(s); n.delete(borrado.codigo); return n; });
    setEditando(null);
  };

  const alterna = (codigo) =>
    setSeleccion((s) => {
      const n = new Set(s);
      if (n.has(codigo)) n.delete(codigo); else n.add(codigo);
      return n;
    });

  const todosMarcados = filtrados.length > 0 && filtrados.every((c) => seleccion.has(c.codigo));
  const alternaTodos = () =>
    setSeleccion((s) => {
      const n = new Set(s);
      if (todosMarcados) filtrados.forEach((c) => n.delete(c.codigo));
      else filtrados.forEach((c) => n.add(c.codigo));
      return n;
    });

  const cuenta = (id) => lista.filter((c) => c.estado === id).length;
  const sinPunto = lista.filter((c) => !c.domicilioId).length;
  const herr = HERRAMIENTAS.find((h) => h.id === herramienta);
  const hayFiltro = estado !== "todos" || sinAsignar || clienteId || busqueda;

  return (
    <>
      <Sugerencias />
      <div className="pt-page-head">
        <h1>Contenedores</h1>
        <p>
          {lista.length} contenedores · {cuenta("en-servicio")} en servicio · {sinPunto} sin asignar
          {cuenta("danado") > 0 && <> · {cuenta("danado")} {cuenta("danado") === 1 ? "dañado" : "dañados"}</>}
          {cuenta("perdido") > 0 && <> · {cuenta("perdido")} {cuenta("perdido") === 1 ? "perdido" : "perdidos"}</>}
        </p>
      </div>

      {/* Las tres altas son botones normales y no tres azules: el azul es la
          acción principal y va DENTRO de la herramienta abierta (DESIGN.md:
          si aparece dos veces en una pantalla, algo se hizo mal). */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "1rem" }}>
        {HERRAMIENTAS.map((h) => (
          <button
            key={h.id}
            type="button"
            className={`pt-chip ${herramienta === h.id ? "activo" : ""}`}
            aria-expanded={herramienta === h.id}
            onClick={() => setHerramienta(herramienta === h.id ? null : h.id)}
          >
            <h.icono aria-hidden="true" /> {h.texto}
          </button>
        ))}
      </div>

      {herr && (
        <div className="pt-card" style={{ marginBottom: "1.1rem" }}>
          <div className="pt-card-head">
            <h2>{herr.titulo}</h2>
            <button type="button" className="pt-btn" onClick={() => setHerramienta(null)} aria-label="Cerrar"><X /></button>
          </div>
          {herramienta === "alta" && <AltaContenedor existentes={codigos} clientes={clientes} onCreados={alCrear} />}
          {herramienta === "lote" && <LoteContenedores existentes={codigos} onCreados={alCrear} />}
          {herramienta === "importar" && <ImportarExcel existentes={codigos} clientes={clientes} onCreados={alCrear} />}
        </div>
      )}

      <div className="pt-card">
        {/* ---------- Filtros ---------- */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "0.8rem" }}>
          <button type="button" className={`pt-chip ${estado === "todos" ? "activo" : ""}`} onClick={() => setEstado("todos")}>
            Todos ({lista.length})
          </button>
          {ESTADOS_CONTENEDOR.map((e) => (
            <button key={e.id} type="button" className={`pt-chip ${estado === e.id ? "activo" : ""}`} onClick={() => setEstado(e.id)}>
              {e.texto} ({cuenta(e.id)})
            </button>
          ))}
        </div>
        <div className="pt-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "0.6rem", marginBottom: "1rem" }}>
          <div style={{ position: "relative" }}>
            <MagnifyingGlass aria-hidden="true" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--mc-gris)" }} />
            <input
              className="pt-input"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar código (0421)"
              aria-label="Buscar por código"
              inputMode="search"
              style={{ paddingLeft: "2.2rem" }}
            />
          </div>
          <select
            className="pt-input"
            value={clienteId}
            onChange={(e) => { setClienteId(e.target.value); setPuntoId(""); if (e.target.value) setSinAsignar(false); }}
            aria-label="Filtrar por cliente"
          >
            <option value="">Todos los clientes</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.empresa}</option>)}
          </select>
          {cliente && cliente.puntos.length > 1 && (
            <select className="pt-input" value={puntoId} onChange={(e) => setPuntoId(e.target.value)} aria-label="Filtrar por punto">
              <option value="">Todos sus puntos</option>
              {cliente.puntos.map((p) => <option key={p.id} value={p.id}>{p.alias}</option>)}
            </select>
          )}
          <label className="pt-chip" style={{ justifyContent: "center", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={sinAsignar}
              onChange={(e) => { setSinAsignar(e.target.checked); if (e.target.checked) { setClienteId(""); setPuntoId(""); } }}
              style={{ accentColor: "var(--mc-azul)" }}
            />
            Solo sin asignar ({sinPunto})
          </label>
        </div>

        {/* ---------- Selección para imprimir ---------- */}
        {seleccion.size > 0 && (
          <div
            style={{
              display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap",
              padding: "0.6rem 0.8rem", marginBottom: "0.9rem", borderRadius: 9,
              border: "1px solid var(--pt-accion-linea)", background: "var(--pt-accion-tinte)",
            }}
          >
            <strong style={{ fontSize: "0.9rem" }}>{seleccion.size} seleccionados</strong>
            {/* Azul solo si no hay una herramienta abierta con su propio botón azul. */}
            <a className={`pt-btn ${herramienta ? "" : "pt-btn-naranja"}`} href={enlaceEtiquetas([...seleccion])} target="_blank" rel="noopener">
              <Printer /> Imprimir etiquetas
            </a>
            <button type="button" className="pt-btn" onClick={() => setSeleccion(new Set())}>Quitar selección</button>
          </div>
        )}

        {cargando ? (
          <div className="pt-vacio">Cargando inventario…</div>
        ) : lista.length === 0 ? (
          <div className="pt-vacio">
            Todavía no hay contenedores. Crea un lote para imprimir las primeras etiquetas,
            o importa el inventario desde Excel.
          </div>
        ) : filtrados.length === 0 ? (
          <div className="pt-vacio">
            Ningún contenedor con estos filtros.{" "}
            {hayFiltro && (
              <button type="button" className="pt-btn" onClick={() => { setEstado("todos"); setSinAsignar(false); setClienteId(""); setPuntoId(""); setBusqueda(""); }}>
                Quitar filtros
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="pt-tabla-wrap">
              <table className="pt-tabla pt-tabla-compacta" style={{ minWidth: 760 }}>
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>
                      <input
                        type="checkbox"
                        checked={todosMarcados}
                        onChange={alternaTodos}
                        aria-label={todosMarcados ? "Quitar los de esta lista" : `Seleccionar los ${filtrados.length} de esta lista`}
                        title={todosMarcados ? "Quitar los de esta lista" : `Seleccionar los ${filtrados.length} de esta lista`}
                        style={{ accentColor: "var(--mc-azul)", width: 17, height: 17 }}
                      />
                    </th>
                    <th>Código</th>
                    <th>Tipo</th>
                    <th>Estado</th>
                    <th>Cliente · punto</th>
                    <th>Notas</th>
                    <th aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {filtrados.slice(0, visibles).map((c) => (
                    <tr key={c.id} style={seleccion.has(c.codigo) ? { background: "rgba(42,106,153,0.08)" } : undefined}>
                      <td>
                        <input
                          type="checkbox"
                          checked={seleccion.has(c.codigo)}
                          onChange={() => alterna(c.codigo)}
                          aria-label={`Seleccionar ${c.codigo}`}
                          style={{ accentColor: "var(--mc-azul)", width: 17, height: 17 }}
                        />
                      </td>
                      <td className="folio">{c.codigo}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <span style={{ textTransform: "capitalize" }}>{c.tipo}</span>
                        {c.medida && <span className="folio" style={{ color: "var(--mc-gris)", fontSize: "0.82rem" }}> · {c.medida}</span>}
                      </td>
                      <td><InsigniaEstado estado={c.estado} /></td>
                      <td className="pt-celda-recorte" style={{ maxWidth: 260 }}>
                        {c.cliente ? (
                          <>
                            <span className="pt-recorte" title={c.cliente.empresa}>{c.cliente.empresa}</span>
                            <span className="pt-recorte" style={{ color: "var(--mc-gris)", fontSize: "0.8rem" }}>{c.punto?.alias}</span>
                          </>
                        ) : (
                          <span style={{ color: "var(--mc-gris)" }}>Sin asignar</span>
                        )}
                      </td>
                      <td className="pt-celda-recorte" style={{ maxWidth: 200 }}>
                        <span className="pt-recorte" title={c.notas} style={{ color: "var(--mc-gris)", fontSize: "0.84rem" }}>{c.notas || "—"}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button type="button" className="pt-btn" onClick={() => setEditando(c)} aria-label={`Editar ${c.codigo}`}>
                          <PencilSimple /> Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.8rem", flexWrap: "wrap", marginTop: "0.8rem", fontSize: "0.84rem", color: "var(--mc-gris)" }}>
              <span>
                {Math.min(visibles, filtrados.length)} de {filtrados.length}
                {filtrados.length !== lista.length && ` (de ${lista.length} en total)`}
              </span>
              {visibles < filtrados.length && (
                <button type="button" className="pt-btn" onClick={() => setVisibles((v) => v + POR_TANDA)}>
                  Ver {Math.min(POR_TANDA, filtrados.length - visibles)} más
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {editando && (
        <EditarContenedor
          contenedor={editando}
          clientes={clientes}
          onCerrar={() => setEditando(null)}
          onGuardado={alGuardar}
          onBorrado={alBorrar}
        />
      )}
    </>
  );
}
