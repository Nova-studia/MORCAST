"use client";

import { useEffect, useState } from "react";
import { X, WarningCircle, ClockCounterClockwise, Receipt } from "@phosphor-icons/react/dist/ssr";
import {
  preciosDeClienteAccion,
  ponerPrecioAccion,
  quitarEspecialAccion,
  cambiarFacturaAccion,
} from "@/app/acciones-precios";
import { MODALIDADES, IVA_FACTURA, redondear } from "@/lib/precios.mjs";
import { pesos, fechaLarga } from "@/lib/portal-datos";
import AvisoPrecios from "@/components/AvisoPrecios";

/**
 * PRECIOS DE UN CLIENTE (7-oct-2026): "¿Requiere factura?" y, por concepto,
 * si paga el precio de lista o uno especial. Se abre desde /admin/precios y
 * desde cada renglón de /admin/clientes.
 *
 * Nada se edita: cada cambio es un renglón nuevo que vale DESDE AHORA (db/027).
 * La pantalla solo pinta; el permiso lo decide la base y la acción del servidor.
 */
export default function CajonPreciosCliente({ clienteId, onCerrar, puedeEditar = true }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [editando, setEditando] = useState(null); // { concepto, modo: "especial" | "quitar" }
  const [texto, setTexto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [historial, setHistorial] = useState(null);

  const cargar = async () => {
    const r = await preciosDeClienteAccion(clienteId);
    if (!r.ok) { setError(r.motivo || "No se pudieron leer los precios."); return; }
    setDatos(r);
  };

  useEffect(() => { if (clienteId) cargar(); }, [clienteId]);

  const responder = async (promesa) => {
    setGuardando(true);
    setError(null);
    const r = await promesa;
    setGuardando(false);
    if (!r.ok) { setError(r.motivo || "No se guardó. Intenta de nuevo."); return false; }
    setEditando(null);
    setTexto("");
    await cargar();
    return true;
  };

  const factura = (valor) =>
    responder(cambiarFacturaAccion({ clienteId, requiereFactura: valor }));

  const guardarEspecial = (k) =>
    responder(ponerPrecioAccion({ conceptoId: k.id, clienteId, texto, antes: k.vigente }));

  const volverALista = (k) =>
    responder(quitarEspecialAccion({ conceptoId: k.id, clienteId }));

  const cliente = datos?.cliente;

  return (
    <div className="pt-modal-fondo" onClick={onCerrar}>
      <div className="pt-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 760 }}>
        <div className="pt-modal-head">
          <div>
            <strong>{cliente?.empresa || "Precios del cliente"}</strong>
            <span>{cliente?.folio || ""}</span>
          </div>
          <button className="pt-btn" onClick={onCerrar} aria-label="Cerrar"><X /></button>
        </div>

        <div style={{ padding: "1rem 1.2rem 1.2rem" }}>
          {error && (
            <div className="pt-login-error" role="alert" style={{ marginBottom: "0.8rem" }}>
              <WarningCircle style={{ marginRight: 6, verticalAlign: "-2px" }} />
              {error}
            </div>
          )}

          {!datos && !error && <div className="pt-vacio">Cargando precios…</div>}

          {datos && (
            <>
              {/* ¿Requiere factura? */}
              <div className="pt-card" style={{ marginBottom: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.8rem", flexWrap: "wrap" }}>
                  <Receipt size={22} />
                  <div style={{ flex: "1 1 220px" }}>
                    <strong>¿Requiere factura?</strong>
                    <div style={{ color: "var(--mc-gris)", fontSize: "0.82rem" }}>
                      {cliente.requiere_factura
                        ? "Sí: a sus precios se les suma 16 % de IVA."
                        : "No: paga el precio tal cual (efectivo, sin IVA)."}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    <button
                      className={`pt-btn ${cliente.requiere_factura ? "pt-btn-verde" : ""}`}
                      disabled={!puedeEditar || guardando || cliente.requiere_factura}
                      onClick={() => factura(true)}
                    >Sí</button>
                    <button
                      className={`pt-btn ${!cliente.requiere_factura ? "pt-btn-verde" : ""}`}
                      disabled={!puedeEditar || guardando || !cliente.requiere_factura}
                      onClick={() => factura(false)}
                    >No</button>
                  </div>
                </div>
              </div>

              {datos.conceptos.length === 0 ? (
                <div className="pt-vacio">Todavía no hay conceptos en la lista general. Créalos en Precios.</div>
              ) : (
                <div className="pt-tabla-wrap">
                  <table className="pt-tabla" style={{ minWidth: 620 }}>
                    <thead>
                      <tr><th>Concepto</th><th>Cobro</th><th className="num">Lista</th><th className="num">Le toca</th><th></th></tr>
                    </thead>
                    <tbody>
                      {datos.conceptos.filter((k) => k.activo).map((k) => (
                        <tr key={k.id}>
                          <td><strong>{k.nombre}</strong><div style={{ color: "var(--mc-gris)", fontSize: "0.78rem" }}>{k.unidad}</div></td>
                          <td>{MODALIDADES[k.modalidad]}</td>
                          <td className="num">{k.lista == null ? <span className="pt-badge alerta">Sin precio</span> : pesos(k.lista)}</td>
                          <td className="num">
                            {k.vigente == null ? "—" : <strong>{pesos(k.vigente)}</strong>}
                            {k.especial != null && <div><span className="pt-badge prog">Especial</span></div>}
                            {k.vigente != null && cliente.requiere_factura && (
                              <div style={{ color: "var(--mc-gris)", fontSize: "0.75rem" }}>{pesos(redondear(k.vigente * (1 + IVA_FACTURA)))} con IVA</div>
                            )}
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            {puedeEditar && (
                              <button className="pt-btn" onClick={() => { setEditando({ concepto: k, modo: "especial" }); setTexto(""); }}>
                                {k.especial != null ? "Cambiar" : "Precio especial"}
                              </button>
                            )}{" "}
                            {puedeEditar && k.especial != null && (
                              <button className="pt-btn" onClick={() => setEditando({ concepto: k, modo: "quitar" })}>Volver a lista</button>
                            )}{" "}
                            <button className="pt-btn" onClick={() => setHistorial(k)} aria-label="Historial"><ClockCounterClockwise /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Confirmación de un cambio */}
              {editando && (
                <div className="pt-card" style={{ marginTop: "1rem" }}>
                  {editando.modo === "especial" ? (
                    <>
                      <div className="pt-campo">
                        <label htmlFor="precio-especial">Precio especial para {cliente.empresa} — {editando.concepto.nombre} (sin IVA)</label>
                        <input id="precio-especial" className="pt-input" inputMode="decimal" placeholder="Ej. 1,250.00"
                          value={texto} onChange={(e) => setTexto(e.target.value)} autoFocus />
                      </div>
                      <p style={{ color: "var(--mc-gris)", fontSize: "0.82rem", margin: "0.4rem 0 0.8rem" }}>
                        De {editando.concepto.vigente == null ? "sin precio" : pesos(editando.concepto.vigente)} a {texto ? texto : "…"}, vale desde ahora. Lo ya cobrado no cambia.
                      </p>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button className="pt-btn" onClick={() => setEditando(null)}>Cancelar</button>
                        <button className="pt-btn pt-btn-verde" disabled={guardando || !texto.trim()} onClick={() => guardarEspecial(editando.concepto)}>
                          {guardando ? "Guardando…" : "Guardar precio especial"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p style={{ margin: "0 0 0.8rem" }}>
                        Desde ahora pagará el precio de lista ({editando.concepto.lista == null ? "sin precio" : pesos(editando.concepto.lista)}) por <strong>{editando.concepto.nombre}</strong>. Lo ya cobrado no cambia.
                      </p>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button className="pt-btn" onClick={() => setEditando(null)}>Cancelar</button>
                        <button className="pt-btn pt-btn-verde" disabled={guardando} onClick={() => volverALista(editando.concepto)}>
                          {guardando ? "Guardando…" : "Volver a precio de lista"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Historial del concepto para este cliente */}
              {historial && (
                <div className="pt-card" style={{ marginTop: "1rem" }}>
                  <div className="pt-card-head" style={{ display: "flex", justifyContent: "space-between" }}>
                    <h2>Historial · {historial.nombre}</h2>
                    <button className="pt-btn" onClick={() => setHistorial(null)} aria-label="Cerrar historial"><X /></button>
                  </div>
                  {historial.historial.length === 0 ? (
                    <div className="pt-vacio">Sin cambios todavía.</div>
                  ) : (
                    <table className="pt-tabla">
                      <thead><tr><th>Desde</th><th>Tipo</th><th className="num">Precio</th></tr></thead>
                      <tbody>
                        {historial.historial.map((r) => (
                          <tr key={r.id}>
                            <td style={{ whiteSpace: "nowrap" }}>{fechaLarga(r.vale_desde)}</td>
                            <td>{r.cliente_id ? (r.quitado ? "Volvió a lista" : "Especial") : "Lista general"}</td>
                            <td className="num">{r.quitado ? "—" : pesos(r.precio)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              <AvisoPrecios compacto style={{ marginTop: "1rem" }} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
