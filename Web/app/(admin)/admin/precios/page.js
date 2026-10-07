"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  X,
  WarningCircle,
  ClockCounterClockwise,
  PencilSimple,
  MagnifyingGlass,
  Lock,
} from "@phosphor-icons/react/dist/ssr";
import {
  catalogoAccion,
  crearConceptoAccion,
  cambiarConceptoAccion,
  ponerPrecioAccion,
} from "@/app/acciones-precios";
import { MODALIDADES, precioVigente } from "@/lib/precios.mjs";
import { listarClientes } from "@/lib/datos-clientes";
import { obtenerSesionAdmin, sesionPuede } from "@/lib/admin-sesion";
import { pesos, fechaLarga } from "@/lib/portal-datos";
import AvisoPrecios from "@/components/AvisoPrecios";
import CajonPreciosCliente from "@/components/admin/CajonPreciosCliente";

/**
 * PRECIOS (7-oct-2026, pedido de Luis): la lista general y el precio especial
 * de cada cliente. Ver docs/superpowers/specs/2026-10-07-precios-design.md
 *
 *   · Los precios se capturan SIN IVA. A quien requiere factura se le suma 16 %.
 *   · Nada se edita ni se borra: cada cambio es un renglón nuevo que vale
 *     DESDE AHORA (db/027). Lo ya cobrado conserva su precio.
 *   · El dueño y los admins con el permiso "precios" cambian; los demás ven.
 *     Esta pantalla solo pinta los botones: la base decide.
 */

const VACIO = { nombre: "", unidad: "", modalidad: "por-recoleccion", precio: "" };

export default function PreciosAdmin() {
  const [cat, setCat] = useState(null);
  const [error, setError] = useState(null);
  const [yo, setYo] = useState(null);
  const [verInactivos, setVerInactivos] = useState(false);
  const [nuevo, setNuevo] = useState(null);       // formulario de concepto nuevo
  const [editar, setEditar] = useState(null);     // concepto que se renombra
  const [cambiar, setCambiar] = useState(null);   // concepto cuyo precio de lista cambia
  const [texto, setTexto] = useState("");
  const [historial, setHistorial] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [busca, setBusca] = useState("");
  const [cliente, setCliente] = useState(null);   // uuid del cajón abierto

  const cargar = async () => {
    const r = await catalogoAccion();
    if (!r.ok) { setError(r.motivo || "No se pudieron leer los precios."); return; }
    setCat(r);
  };

  useEffect(() => {
    cargar();
    obtenerSesionAdmin().then(setYo);
    listarClientes().then((c) => setClientes(c.filter((x) => !x.esPrueba)));
  }, []);

  const puede = sesionPuede(yo, "precios");

  const conceptos = useMemo(() => {
    if (!cat) return [];
    return cat.conceptos
      .filter((k) => verInactivos || k.activo)
      .map((k) => ({
        ...k,
        lista: precioVigente(cat.renglones, { clienteId: null, conceptoId: k.id }),
        historial: cat.renglones.filter((r) => r.concepto_id === k.id && r.cliente_id == null),
      }));
  }, [cat, verInactivos]);

  const sinPrecio = conceptos.filter((k) => k.activo && k.lista == null).length;

  const encontrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (q.length < 2) return [];
    return clientes
      .filter((c) => `${c.empresa} ${c.id}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [busca, clientes]);

  /** Guarda, y si falla lo DICE (aquí se mueve dinero). */
  const responder = async (promesa) => {
    setGuardando(true);
    setError(null);
    const r = await promesa;
    setGuardando(false);
    if (!r.ok) { setError(r.motivo || "No se guardó. Intenta de nuevo."); return null; }
    await cargar();
    return r;
  };

  const crear = async () => {
    const r = await responder(crearConceptoAccion(nuevo));
    if (!r) return;
    if (nuevo.precio.trim()) {
      const p = await responder(ponerPrecioAccion({ conceptoId: r.id, texto: nuevo.precio }));
      if (!p) { setNuevo(null); return; } // el concepto sí quedó; el aviso dice por qué no el precio
    }
    setNuevo(null);
  };

  const guardarPrecio = async () => {
    const r = await responder(ponerPrecioAccion({ conceptoId: cambiar.id, texto, antes: cambiar.lista }));
    if (r) { setCambiar(null); setTexto(""); }
  };

  const guardarEdicion = async () => {
    const r = await responder(cambiarConceptoAccion(editar.id, {
      nombre: editar.nombre, unidad: editar.unidad, modalidad: editar.modalidad,
    }));
    if (r) setEditar(null);
  };

  const alternarActivo = (k) => responder(cambiarConceptoAccion(k.id, { activo: !k.activo }));

  return (
    <>
      <div className="pt-page-head">
        <h1>Precios</h1>
        <p>
          La lista general y el precio especial de cada cliente. Los precios se capturan
          <strong> sin IVA</strong>; a los clientes que requieren factura se les suma 16 %.
          Cada cambio vale desde ese momento: lo ya cobrado no cambia.
        </p>
      </div>

      <AvisoPrecios />

      {error && (
        <div className="pt-login-error" role="alert" style={{ marginBottom: "1rem" }}>
          <WarningCircle style={{ marginRight: 6, verticalAlign: "-2px" }} />
          {error}
        </div>
      )}

      {yo && !puede && (
        <p className="pt-nota-demo" style={{ marginBottom: "1rem" }}>
          <Lock /> Solo lectura: pide al dueño el permiso de precios.
        </p>
      )}

      {/* Lista general */}
      <div className="pt-card" style={{ marginBottom: "1.1rem" }}>
        <div className="pt-card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
          <h2>Lista general{sinPrecio ? ` · ${sinPrecio} sin precio` : ""}</h2>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ fontSize: "0.82rem", color: "var(--mc-gris)", display: "flex", gap: 6, alignItems: "center" }}>
              <input type="checkbox" checked={verInactivos} onChange={(e) => setVerInactivos(e.target.checked)} />
              Ver desactivados
            </label>
            {puede && (
              <button className="pt-btn pt-btn-verde" onClick={() => setNuevo({ ...VACIO })}>
                <Plus /> Nuevo concepto
              </button>
            )}
          </div>
        </div>

        {!cat && !error && <div className="pt-vacio">Cargando precios…</div>}
        {cat && conceptos.length === 0 && (
          <div className="pt-vacio">Todavía no hay conceptos. {puede ? "Agrega el primero con “Nuevo concepto”." : ""}</div>
        )}

        {conceptos.length > 0 && (
          <div className="pt-tabla-wrap">
            <table className="pt-tabla" style={{ minWidth: 720 }}>
              <thead>
                <tr><th>Concepto</th><th>Unidad</th><th>Cobro</th><th className="num">Precio de lista</th><th></th></tr>
              </thead>
              <tbody>
                {conceptos.map((k) => (
                  <tr key={k.id} style={{ opacity: k.activo ? 1 : 0.55 }}>
                    <td><strong>{k.nombre}</strong>{!k.activo && <div><span className="pt-badge mal">Desactivado</span></div>}</td>
                    <td>{k.unidad}</td>
                    <td>{MODALIDADES[k.modalidad]}</td>
                    <td className="num">{k.lista == null ? <span className="pt-badge alerta">Sin precio</span> : <strong>{pesos(k.lista)}</strong>}</td>
                    <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                      {puede && k.activo && (
                        <button className="pt-btn pt-btn-verde" onClick={() => { setCambiar(k); setTexto(""); }}>
                          {k.lista == null ? "Poner precio" : "Cambiar precio"}
                        </button>
                      )}{" "}
                      <button className="pt-btn" onClick={() => setHistorial(k)} aria-label={`Historial de ${k.nombre}`}><ClockCounterClockwise /></button>{" "}
                      {puede && (
                        <button className="pt-btn" onClick={() => setEditar({ ...k })} aria-label={`Editar ${k.nombre}`}><PencilSimple /></button>
                      )}{" "}
                      {puede && (
                        <button className="pt-btn" onClick={() => alternarActivo(k)} disabled={guardando}>
                          {k.activo ? "Desactivar" : "Activar"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Precio por cliente */}
      <div className="pt-card">
        <div className="pt-card-head"><h2>Precio por cliente y factura</h2></div>
        <p style={{ color: "var(--mc-gris)", fontSize: "0.85rem", marginTop: 0 }}>
          Busca un cliente para ver si requiere factura y ponerle precios especiales.
          Quien no tiene precio especial paga el de lista.
        </p>
        <div className="pt-campo" style={{ maxWidth: 420 }}>
          <label htmlFor="busca-cliente"><MagnifyingGlass style={{ verticalAlign: "-2px" }} /> Empresa o folio</label>
          <input id="busca-cliente" className="pt-input" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Escribe al menos 2 letras" />
        </div>
        {encontrados.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.6rem", maxWidth: 520 }}>
            {encontrados.map((c) => (
              <button key={c.uuid} className="pt-btn" style={{ justifyContent: "space-between" }} onClick={() => setCliente(c.uuid)}>
                <span><strong>{c.empresa}</strong> <span style={{ color: "var(--mc-gris)" }}>{c.id}</span></span>
                <span style={{ color: "var(--mc-gris)", fontSize: "0.78rem" }}>{c.requiereFactura ? "Factura" : "Sin factura"}</span>
              </button>
            ))}
          </div>
        )}
        {busca.trim().length >= 2 && encontrados.length === 0 && (
          <div className="pt-vacio">No hay clientes con ese nombre o folio.</div>
        )}
      </div>

      {/* Concepto nuevo */}
      {nuevo && (
        <Dialogo titulo="Nuevo concepto" onCerrar={() => setNuevo(null)}>
          <Campo id="c-nombre" etiqueta="Nombre (lo que verá el cliente)">
            <input id="c-nombre" className="pt-input" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="Ej. Contenedor de 3 m³" autoFocus />
          </Campo>
          <Campo id="c-unidad" etiqueta="Unidad">
            <input id="c-unidad" className="pt-input" value={nuevo.unidad} onChange={(e) => setNuevo({ ...nuevo, unidad: e.target.value })} placeholder="Ej. por recolección" />
          </Campo>
          <Campo id="c-modalidad" etiqueta="Cómo se cobra">
            <select id="c-modalidad" className="pt-input" value={nuevo.modalidad} onChange={(e) => setNuevo({ ...nuevo, modalidad: e.target.value })}>
              {Object.entries(MODALIDADES).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </Campo>
          <Campo id="c-precio" etiqueta="Precio de lista sin IVA (puedes ponerlo después)">
            <input id="c-precio" className="pt-input" inputMode="decimal" value={nuevo.precio} onChange={(e) => setNuevo({ ...nuevo, precio: e.target.value })} placeholder="Ej. 1,250.00" />
          </Campo>
          <Botones onCancelar={() => setNuevo(null)} onGuardar={crear} guardando={guardando} texto="Crear concepto" />
        </Dialogo>
      )}

      {/* Editar concepto */}
      {editar && (
        <Dialogo titulo={`Editar · ${editar.nombre}`} onCerrar={() => setEditar(null)}>
          <Campo id="e-nombre" etiqueta="Nombre">
            <input id="e-nombre" className="pt-input" value={editar.nombre} onChange={(e) => setEditar({ ...editar, nombre: e.target.value })} />
          </Campo>
          <Campo id="e-unidad" etiqueta="Unidad">
            <input id="e-unidad" className="pt-input" value={editar.unidad} onChange={(e) => setEditar({ ...editar, unidad: e.target.value })} />
          </Campo>
          <Campo id="e-modalidad" etiqueta="Cómo se cobra">
            <select id="e-modalidad" className="pt-input" value={editar.modalidad} onChange={(e) => setEditar({ ...editar, modalidad: e.target.value })}>
              {Object.entries(MODALIDADES).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </Campo>
          <p style={{ color: "var(--mc-gris)", fontSize: "0.8rem" }}>El precio no se cambia aquí: usa “Cambiar precio”, así queda en el historial.</p>
          <Botones onCancelar={() => setEditar(null)} onGuardar={guardarEdicion} guardando={guardando} texto="Guardar" />
        </Dialogo>
      )}

      {/* Cambiar precio de lista */}
      {cambiar && (
        <Dialogo titulo={`${cambiar.lista == null ? "Poner" : "Cambiar"} precio · ${cambiar.nombre}`} onCerrar={() => setCambiar(null)}>
          <Campo id="p-nuevo" etiqueta="Precio de lista sin IVA">
            <input id="p-nuevo" className="pt-input" inputMode="decimal" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ej. 1,250.00" autoFocus />
          </Campo>
          <p style={{ color: "var(--mc-gris)", fontSize: "0.85rem" }}>
            De {cambiar.lista == null ? "sin precio" : pesos(cambiar.lista)} a {texto || "…"}, vale desde ahora. Lo ya cobrado no cambia.
            Los clientes con precio especial siguen con el suyo.
          </p>
          <Botones onCancelar={() => setCambiar(null)} onGuardar={guardarPrecio} guardando={guardando} deshabilitado={!texto.trim()} texto="Guardar precio" />
        </Dialogo>
      )}

      {/* Historial de la lista */}
      {historial && (
        <Dialogo titulo={`Historial · ${historial.nombre}`} onCerrar={() => setHistorial(null)}>
          {historial.historial.length === 0 ? (
            <div className="pt-vacio">Sin precios todavía.</div>
          ) : (
            <table className="pt-tabla">
              <thead><tr><th>Desde</th><th className="num">Precio de lista</th></tr></thead>
              <tbody>
                {historial.historial.map((r) => (
                  <tr key={r.id}><td>{fechaLarga(r.vale_desde)}</td><td className="num">{pesos(r.precio)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
          <p style={{ color: "var(--mc-gris)", fontSize: "0.8rem" }}>Quién hizo cada cambio queda en la Bitácora.</p>
        </Dialogo>
      )}

      {cliente && (
        <CajonPreciosCliente clienteId={cliente} puedeEditar={puede} onCerrar={() => { setCliente(null); listarClientes().then((c) => setClientes(c.filter((x) => !x.esPrueba))); }} />
      )}
    </>
  );
}

function Dialogo({ titulo, onCerrar, children }) {
  return (
    <div className="pt-modal-fondo" onClick={onCerrar}>
      <div className="pt-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="pt-modal-head">
          <div><strong>{titulo}</strong></div>
          <button className="pt-btn" onClick={onCerrar} aria-label="Cerrar"><X /></button>
        </div>
        <div style={{ padding: "1rem 1.2rem 1.2rem" }}>{children}</div>
      </div>
    </div>
  );
}

function Campo({ id, etiqueta, children }) {
  return (
    <div className="pt-campo">
      <label htmlFor={id}>{etiqueta}</label>
      {children}
    </div>
  );
}

function Botones({ onCancelar, onGuardar, guardando, deshabilitado = false, texto }) {
  return (
    <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "0.6rem" }}>
      <button className="pt-btn" onClick={onCancelar}>Cancelar</button>
      <button className="pt-btn pt-btn-verde" disabled={guardando || deshabilitado} onClick={onGuardar}>
        {guardando ? "Guardando…" : texto}
      </button>
    </div>
  );
}
