"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, WarningCircle, CheckCircle, PencilSimple, Plus, Trash, Prohibit, ArrowCounterClockwise,
  Pause, Play, Key, EnvelopeSimple, MapPin,
} from "@phosphor-icons/react/dist/ssr";
import {
  fichaClienteAccion, cambiarEstadoClienteAccion, editarClienteAccion, eliminarClienteAccion,
  accesoUsuarioClienteAccion, reenviarAccesoClienteAccion, agregarPuntoAccion, quitarPuntoAccion,
  cambiarServicioAccion,
} from "@/app/acciones-clientes";
import { etiquetaEstado, resumenBorrado } from "@/lib/estado-cliente.mjs";
import { pesos, fechaLarga } from "@/lib/portal-datos";

/**
 * FICHA DEL CLIENTE (Entrega 1, 8-oct-2026): datos, estado (suspender, baja,
 * reactivar, eliminar), puntos y servicios, usuarios con acceso e historial
 * corto. Lo que cambia algo pasa por app/acciones-clientes.js, que decide
 * quién puede; esta pantalla solo pinta los botones.
 */

const CAMPOS = [
  ["empresa", "Empresa / razón social"],
  ["contacto", "Persona de contacto"],
  ["correo", "Correo"],
  ["telefono", "Teléfono"],
  ["rfc", "RFC"],
  ["plan", "Plan"],
  ["dias_credito", "Días de crédito"],
  ["limite_credito", "Límite de crédito"],
  ["nota_interna", "Nota interna"],
];

const TEXTO_ESTADO = {
  suspendido: {
    titulo: "Suspender",
    explica: "Podrá entrar y ver todo, pero SOLO agregar saldo. Verá un aviso rojo. Sus servicios se pausan.",
  },
  baja: {
    titulo: "Dar de baja",
    explica: "No podrá entrar. Se cancelan sus servicios y sus recolecciones futuras, y se liberan sus contenedores. Su historial se conserva.",
  },
  activo: {
    titulo: "Reactivar",
    explica: "Vuelve a entrar. Sus servicios regresan en pausa para que la oficina los revise.",
  },
};

export default function FichaCliente() {
  const { id } = useParams();
  const router = useRouter();
  const [f, setF] = useState(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [editando, setEditando] = useState(null);   // copia de los datos
  const [cambio, setCambio] = useState(null);       // { estado, motivo }
  const [borrar, setBorrar] = useState(null);       // { texto }
  const [punto, setPunto] = useState(null);         // formulario de punto nuevo

  const cargar = async () => {
    const r = await fichaClienteAccion(id);
    if (!r.ok) { setError(r.motivo || "No se pudo abrir la ficha."); return; }
    setError("");
    setF(r);
  };
  useEffect(() => { cargar(); }, [id]);

  const correr = async (promesa, ok) => {
    setOcupado(true); setError(""); setAviso("");
    const r = await promesa;
    setOcupado(false);
    if (!r.ok) { setError(r.motivo || "No se pudo."); return false; }
    if (ok) setAviso(typeof ok === "function" ? ok(r) : ok);
    await cargar();
    return true;
  };

  if (!f) {
    return (
      <>
        <Link href="/admin/clientes" className="pt-btn"><ArrowLeft /> Clientes</Link>
        {error ? <div className="pt-login-error" role="alert" style={{ marginTop: "1rem" }}><WarningCircle /> {error}</div>
          : <div className="pt-vacio">Cargando ficha…</div>}
      </>
    );
  }

  const c = f.cliente;
  const et = etiquetaEstado(c.estado);
  const resumen = resumenBorrado(f.conteos);

  return (
    <>
      <div style={{ marginBottom: "0.8rem" }}>
        <Link href="/admin/clientes" className="pt-btn"><ArrowLeft /> Clientes</Link>
      </div>
      <div className="pt-page-head">
        <h1>{c.empresa}</h1>
        <p>
          <span className="folio">{c.folio}</span>{" "}
          <span className={`pt-badge ${et.clase}`}>{et.texto}</span>
          {c.es_prueba && <> <span className="pt-badge prog">Cuenta de revisión</span></>}
          {c.estado_motivo && (c.estado === "suspendido" || c.estado === "baja") && (
            <span style={{ display: "block", color: "var(--mc-gris)", fontSize: "0.85rem", marginTop: 4 }}>
              Motivo: {c.estado_motivo}{c.estado_fecha ? ` · ${fechaLarga(String(c.estado_fecha).slice(0, 10))}` : ""}
            </span>
          )}
        </p>
      </div>

      {error && <div className="pt-login-error" role="alert" style={{ marginBottom: "1rem" }}><WarningCircle style={{ marginRight: 6, verticalAlign: "-2px" }} />{error}</div>}
      {aviso && <div className="pt-nota-demo" role="status" style={{ marginBottom: "1rem" }}><CheckCircle /> {aviso}</div>}

      {/* Estado */}
      <div className="pt-card" style={{ marginBottom: "1.1rem" }}>
        <div className="pt-card-head"><h2>Estado de la cuenta</h2></div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {c.estado !== "suspendido" && c.estado !== "baja" && (
            <button className="pt-btn" onClick={() => setCambio({ estado: "suspendido", motivo: "" })}><Pause /> Suspender</button>
          )}
          {c.estado !== "baja" && (
            <button className="pt-btn" onClick={() => setCambio({ estado: "baja", motivo: "" })}><Prohibit /> Dar de baja</button>
          )}
          {(c.estado === "suspendido" || c.estado === "baja") && (
            <button className="pt-btn pt-btn-verde" onClick={() => setCambio({ estado: "activo", motivo: "" })}><ArrowCounterClockwise /> Reactivar</button>
          )}
          {f.puedeEliminar && (
            <button className="pt-btn" style={{ color: "var(--pt-error)", borderColor: "var(--pt-error)" }} onClick={() => setBorrar({ texto: "" })}>
              <Trash /> Eliminar definitivamente
            </button>
          )}
        </div>

        {cambio && (
          <div className="pt-card" style={{ marginTop: "0.9rem" }}>
            <strong>{TEXTO_ESTADO[cambio.estado].titulo}</strong>
            <p style={{ color: "var(--mc-gris)", fontSize: "0.88rem" }}>{TEXTO_ESTADO[cambio.estado].explica}</p>
            {cambio.estado !== "activo" && (
              <div className="pt-campo">
                <label htmlFor="motivo">Motivo (queda en la bitácora)</label>
                <input id="motivo" className="pt-input" value={cambio.motivo} onChange={(e) => setCambio({ ...cambio, motivo: e.target.value })} placeholder="Ej. Adeudo de septiembre" />
              </div>
            )}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button className="pt-btn" onClick={() => setCambio(null)}>Cancelar</button>
              <button className="pt-btn pt-btn-verde" disabled={ocupado} onClick={async () => {
                if (await correr(cambiarEstadoClienteAccion({ clienteId: c.id, estado: cambio.estado, motivo: cambio.motivo }), "Listo, se cambió el estado.")) setCambio(null);
              }}>{ocupado ? "Guardando…" : `Confirmar: ${TEXTO_ESTADO[cambio.estado].titulo.toLowerCase()}`}</button>
            </div>
          </div>
        )}

        {borrar && (
          <div className="pt-card" style={{ marginTop: "0.9rem", borderColor: "var(--pt-error)" }}>
            <strong style={{ color: "var(--pt-error)" }}>Eliminar definitivamente</strong>
            <p style={{ fontSize: "0.9rem" }}>{resumen} <strong>No se puede deshacer.</strong></p>
            {f.conteos && (f.conteos.recolecciones || f.conteos.movimientos) ? (
              <p style={{ color: "var(--mc-gris)", fontSize: "0.85rem" }}>
                Tiene historial. Si ya es un cliente real, conviene <strong>Dar de baja</strong>: se conserva su historial por la retención ambiental y fiscal.
              </p>
            ) : null}
            <div className="pt-campo">
              <label htmlFor="confirma">Escribe <strong>{c.empresa}</strong> para confirmar</label>
              <input id="confirma" className="pt-input" value={borrar.texto} onChange={(e) => setBorrar({ texto: e.target.value })} autoComplete="off" />
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button className="pt-btn" onClick={() => setBorrar(null)}>Cancelar</button>
              <button className="pt-btn" style={{ background: "var(--pt-error)", borderColor: "var(--pt-error)", color: "#fff" }} disabled={ocupado || !borrar.texto.trim()}
                onClick={async () => {
                  setOcupado(true); setError("");
                  const r = await eliminarClienteAccion({ clienteId: c.id, confirmacion: borrar.texto });
                  setOcupado(false);
                  if (!r.ok) { setError(r.motivo); return; }
                  router.replace("/admin/clientes?eliminado=1");
                }}>{ocupado ? "Eliminando…" : "Eliminar para siempre"}</button>
            </div>
          </div>
        )}
      </div>

      {/* Datos */}
      <div className="pt-card" style={{ marginBottom: "1.1rem" }}>
        <div className="pt-card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Datos</h2>
          {!editando && <button className="pt-btn" onClick={() => setEditando(Object.fromEntries(CAMPOS.map(([k]) => [k, c[k] ?? ""])))}><PencilSimple /> Editar</button>}
        </div>
        {!editando ? (
          <dl style={{ display: "grid", gridTemplateColumns: "minmax(140px, max-content) 1fr", gap: "0.35rem 1rem", margin: 0 }}>
            {CAMPOS.map(([k, t]) => (
              <div key={k} style={{ display: "contents" }}>
                <dt style={{ color: "var(--mc-gris)" }}>{t}</dt>
                <dd style={{ margin: 0 }}>{k === "limite_credito" ? pesos(c[k] || 0) : (c[k] || "—")}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <>
            <div className="pt-grid pt-grid-2" style={{ gap: "0.6rem" }}>
              {CAMPOS.map(([k, t]) => (
                <div className="pt-campo" key={k} style={{ margin: 0 }}>
                  <label htmlFor={`c-${k}`}>{t}</label>
                  <input id={`c-${k}`} className="pt-input" value={editando[k]}
                    inputMode={k === "dias_credito" || k === "limite_credito" ? "decimal" : undefined}
                    onChange={(e) => setEditando({ ...editando, [k]: e.target.value })} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.8rem" }}>
              <button className="pt-btn" onClick={() => setEditando(null)}>Cancelar</button>
              <button className="pt-btn pt-btn-verde" disabled={ocupado} onClick={async () => {
                const cambios = { ...editando, dias_credito: Number(editando.dias_credito) || 0, limite_credito: Number(editando.limite_credito) || 0 };
                if (await correr(editarClienteAccion({ clienteId: c.id, cambios }), (r) => r.cambios?.estado === "activo" ? "Guardado. Ya tiene todos sus datos: quedó Activo." : "Guardado.")) setEditando(null);
              }}>{ocupado ? "Guardando…" : "Guardar"}</button>
            </div>
          </>
        )}
      </div>

      {/* Puntos */}
      <div className="pt-card" style={{ marginBottom: "1.1rem" }}>
        <div className="pt-card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Puntos de recolección ({f.puntos.length})</h2>
          <button className="pt-btn" onClick={() => setPunto({ alias: "", calle: "", colonia: "", cp: "", referencias: "", lat: "", lng: "" })}><Plus /> Agregar punto</button>
        </div>
        {f.puntos.length === 0 && <div className="pt-vacio">Sin puntos.</div>}
        {f.puntos.map((d) => {
          const sus = Array.isArray(d.suscripciones) ? d.suscripciones[0] : d.suscripciones;
          return (
            <div key={d.id} style={{ borderTop: "1px solid var(--mc-linea)", padding: "0.7rem 0", display: "flex", gap: "0.8rem", flexWrap: "wrap", alignItems: "center" }}>
              <MapPin size={20} />
              <div style={{ flex: "1 1 260px" }}>
                <strong>{d.alias}</strong>
                <div style={{ color: "var(--mc-gris)", fontSize: "0.85rem" }}>{[d.calle, d.colonia, d.cp].filter(Boolean).join(", ")}</div>
                <div style={{ fontSize: "0.82rem" }}>
                  {sus ? <>Servicio: <strong>{sus.estado}</strong>{sus.rutas?.nombre ? ` · Ruta ${sus.rutas.nombre}` : " · Sin ruta"}</> : "Sin servicio"}
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                {sus && sus.estado === "activa" && (
                  <button className="pt-btn" disabled={ocupado} onClick={() => correr(cambiarServicioAccion({ clienteId: c.id, suscripcionId: sus.id, estado: "pausada" }), "Servicio en pausa.")}><Pause /> Pausar</button>
                )}
                {sus && sus.estado !== "activa" && (
                  <button className="pt-btn" disabled={ocupado} onClick={() => correr(cambiarServicioAccion({ clienteId: c.id, suscripcionId: sus.id, estado: "activa" }), "Servicio activo.")}><Play /> Reanudar</button>
                )}
                <Link className="pt-btn" href="/admin/rutas">Ruta / pin</Link>
                <button className="pt-btn" disabled={ocupado} onClick={() => {
                  if (window.confirm(`¿Quitar el punto "${d.alias}"? Si tiene historial, solo se cancela su servicio.`)) {
                    correr(quitarPuntoAccion({ clienteId: c.id, domicilioId: d.id }), (r) => r.cancelado ? "Tenía historial: se canceló su servicio." : "Punto quitado.");
                  }
                }}><Trash /> Quitar</button>
              </div>
            </div>
          );
        })}
        {punto && (
          <div className="pt-card" style={{ marginTop: "0.8rem" }}>
            <strong>Punto nuevo</strong>
            <div className="pt-grid pt-grid-2" style={{ gap: "0.6rem", marginTop: "0.5rem" }}>
              {[["alias", "Nombre del punto (ej. Planta 2)"], ["calle", "Calle y número"], ["colonia", "Colonia"], ["cp", "C.P."], ["referencias", "Referencias"], ["lat", "Latitud (opcional)"], ["lng", "Longitud (opcional)"]].map(([k, t]) => (
                <div className="pt-campo" key={k} style={{ margin: 0 }}>
                  <label htmlFor={`p-${k}`}>{t}</label>
                  <input id={`p-${k}`} className="pt-input" value={punto[k]} onChange={(e) => setPunto({ ...punto, [k]: e.target.value })} />
                </div>
              ))}
            </div>
            <p style={{ color: "var(--mc-gris)", fontSize: "0.82rem" }}>El pin exacto y la ruta se ajustan después en Rutas, sectores y puntos.</p>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button className="pt-btn" onClick={() => setPunto(null)}>Cancelar</button>
              <button className="pt-btn pt-btn-verde" disabled={ocupado} onClick={async () => {
                if (await correr(agregarPuntoAccion({ clienteId: c.id, punto }), "Punto agregado.")) setPunto(null);
              }}>{ocupado ? "Guardando…" : "Agregar punto"}</button>
            </div>
          </div>
        )}
      </div>

      {/* Usuarios */}
      <div className="pt-card" style={{ marginBottom: "1.1rem" }}>
        <div className="pt-card-head"><h2>Usuarios con acceso ({f.usuarios.length})</h2></div>
        {f.usuarios.length === 0 && <div className="pt-vacio">Nadie tiene acceso todavía. Dale acceso desde la lista de Clientes.</div>}
        {f.usuarios.map((u) => (
          <div key={u.id} style={{ borderTop: "1px solid var(--mc-linea)", padding: "0.6rem 0", display: "flex", gap: "0.8rem", flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ flex: "1 1 240px" }}>
              <strong>{u.nombre || u.correo}</strong> {!u.activo && <span className="pt-badge mal">Sin acceso</span>}
              <div style={{ color: "var(--mc-gris)", fontSize: "0.82rem" }}>
                {u.correo}{u.proveedor ? ` · entra con ${u.proveedor === "email" ? "correo" : u.proveedor}` : ""}
                {u.ultimoAcceso ? ` · último acceso ${fechaLarga(String(u.ultimoAcceso).slice(0, 10))}` : " · nunca ha entrado"}
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <button className="pt-btn" disabled={ocupado} onClick={() => correr(reenviarAccesoClienteAccion({ clienteId: c.id, perfilId: u.id }), (r) => `Enlace enviado a ${r.correo}.`)}><EnvelopeSimple /> Reenviar acceso</button>
              {u.activo ? (
                <button className="pt-btn" disabled={ocupado} onClick={() => { if (window.confirm(`¿Quitarle el acceso a ${u.correo}?`)) correr(accesoUsuarioClienteAccion({ clienteId: c.id, perfilId: u.id, activo: false }), "Acceso quitado."); }}><Prohibit /> Quitar acceso</button>
              ) : (
                <button className="pt-btn" disabled={ocupado} onClick={() => correr(accesoUsuarioClienteAccion({ clienteId: c.id, perfilId: u.id, activo: true }), "Acceso devuelto.")}><Key /> Devolver acceso</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Historial corto */}
      <div className="pt-grid pt-grid-2" style={{ gap: "1.1rem" }}>
        <div className="pt-card">
          <div className="pt-card-head"><h2>Últimas recolecciones</h2></div>
          {f.solicitudes.length === 0 ? <div className="pt-vacio">Sin recolecciones.</div> : (
            <table className="pt-tabla"><tbody>
              {f.solicitudes.map((s) => (
                <tr key={s.id}><td className="folio">{s.folio}</td><td>{fechaLarga(s.fecha_confirmada || s.fecha_pedida)}</td><td>{s.estado}</td></tr>
              ))}
            </tbody></table>
          )}
          <Link className="pt-btn" style={{ marginTop: "0.6rem" }} href="/admin/recolecciones">Ver todas</Link>
        </div>
        <div className="pt-card">
          <div className="pt-card-head"><h2>Últimos movimientos</h2></div>
          {f.movimientos.length === 0 ? <div className="pt-vacio">Sin movimientos.</div> : (
            <table className="pt-tabla"><tbody>
              {f.movimientos.map((m) => (
                <tr key={m.id}><td>{fechaLarga(m.fecha)}</td><td>{m.tipo}</td><td className="num">{pesos(m.monto)}</td><td>{m.estado}</td></tr>
              ))}
            </tbody></table>
          )}
          <Link className="pt-btn" style={{ marginTop: "0.6rem" }} href="/admin/saldos">Ver saldos</Link>
        </div>
      </div>
    </>
  );
}
