"use client";

import { useEffect, useState } from "react";
import {
  UserPlus,
  X,
  ShieldCheck,
  CheckCircle,
  WarningCircle,
  Prohibit,
  ArrowCounterClockwise,
  PencilSimple,
  EnvelopeSimple,
  Trash,
  Plus,
} from "@phosphor-icons/react/dist/ssr";
import { ROLES } from "@/lib/admin-datos";
import { ROLES_INVITABLES } from "@/lib/equipo.mjs";
import { listarUsuarios, listarRoles } from "@/lib/datos-clientes";
import { fechaLarga } from "@/lib/portal-datos";
import {
  invitarUsuarioEquipo,
  cambiarActivoUsuario,
  detalleEquipoAccion,
  editarUsuarioAccion,
  mandarEnlaceAccion,
  eliminarUsuarioAccion,
} from "@/app/acciones-equipo";
import { crearRolAccion, editarRolAccion, borrarRolAccion } from "@/app/acciones-roles";
import { cambiarPermisoAccion } from "@/app/acciones-precios";
import { obtenerSesionAdmin } from "@/lib/admin-sesion";
import { PERMISOS_ASIGNABLES, aplicarPermiso } from "@/lib/estado-cliente.mjs";
import { SECCIONES, PERMISOS_SUELTOS, ROL_COMPLETO } from "@/lib/permisos.mjs";

/**
 * EL EQUIPO DE MORCAST Y SUS ROLES.
 *
 * Invitar crea la cuenta de verdad (app/acciones-equipo.js) y a la persona le
 * llega un correo para escoger su contraseña. Desde la Entrega 2
 * (9-oct-2026) el dueño arma ROLES con casillas por sección ("Caja: Saldos y
 * Clientes") y se los asigna a cada administrador; la base (db/029), el menú
 * y cada acción del servidor los respetan. Un admin sin rol solo puede VER.
 */
const FORM_VACIO = { nombre: "", correo: "", rol: "operador", rolId: "" };
const ROL_VACIO = { id: null, nombre: "", descripcion: "", permisos: [] };
const TODAS = [...SECCIONES, ...PERMISOS_SUELTOS];
const textoPermiso = (p) => TODAS.find((x) => x.id === p)?.texto || p;

function Aviso({ aviso }) {
  if (!aviso) return null;
  return aviso.tipo === "ok" ? (
    <div className="pt-activar-ok" role="status" style={{ marginBottom: "1rem" }}>
      <CheckCircle /> {aviso.texto}
    </div>
  ) : (
    <div className="pt-login-error" role="alert" style={{ marginBottom: "1rem" }}>
      <WarningCircle style={{ marginRight: 6, verticalAlign: "-2px" }} /> {aviso.texto}
    </div>
  );
}

export default function UsuariosAdmin() {
  const [pestana, setPestana] = useState("equipo");
  const [lista, setLista] = useState([]);
  const [roles, setRoles] = useState([]);
  const [detalle, setDetalle] = useState({});
  const [alta, setAlta] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState(null); // { tipo: "ok" | "error", texto }
  const [cambiando, setCambiando] = useState(null); // uid en curso
  const [editando, setEditando] = useState(null); // copia editable de un usuario
  const [borrarListo, setBorrarListo] = useState(false); // 2.º toque de "Eliminar"
  const [rolForm, setRolForm] = useState(null); // ROL_VACIO o un rol a editar
  const [yo, setYo] = useState(null);
  useEffect(() => { obtenerSesionAdmin().then(setYo); }, []);
  const soyDueno = yo?.rolId === "dueno" || Boolean(yo?.demo);

  const recargar = () =>
    Promise.all([listarUsuarios(), listarRoles(), detalleEquipoAccion()]).then(([l, r, d]) => {
      setLista(l);
      setRoles(r);
      setDetalle(d?.ok ? d.porId : {});
    });

  useEffect(() => {
    let vivo = true;
    Promise.all([listarUsuarios(), listarRoles(), detalleEquipoAccion()]).then(([l, r, d]) => {
      if (!vivo) return;
      setLista(l);
      setRoles(r);
      setDetalle(d?.ok ? d.porId : {});
    });
    return () => { vivo = false; };
  }, []);

  const nombreRol = (id) => roles.find((r) => r.id === id)?.nombre;
  const etiquetaRol = (u) =>
    u.rolId === "admin" ? nombreRol(u.rolPersonalizado) || "Sin rol (solo ve)" : u.rol;

  /* ---------------------------------------------------------- invitar */
  const invitar = async (e) => {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setAviso(null);
    const r = await invitarUsuarioEquipo(form);
    setEnviando(false);
    if (!r.ok) {
      setAviso({ tipo: "error", texto: r.motivo || "No se pudo mandar la invitación." });
      return;
    }
    setAviso({
      tipo: "ok",
      texto: r.demo
        ? "Modo de demostración: no se creó ninguna cuenta."
        : `Listo. A ${r.correo} le llegó un correo para escoger su contraseña (el enlace vence en una hora).`,
    });
    setForm(FORM_VACIO);
    setAlta(false);
    recargar();
  };

  /* ---------------------------------------------------------- activar */
  const cambiarActivo = async (u) => {
    const desactivar = u.estatus === "activo";
    const pregunta = desactivar
      ? `¿Desactivar a ${u.nombre}? Ya no va a poder entrar al sistema.`
      : `¿Reactivar a ${u.nombre}? Va a poder entrar otra vez con su contraseña.`;
    if (!window.confirm(pregunta)) return;
    setCambiando(u.uid);
    setAviso(null);
    const r = await cambiarActivoUsuario({ id: u.uid, activo: !desactivar });
    setCambiando(null);
    if (!r.ok) {
      setAviso({ tipo: "error", texto: r.motivo || "No se pudo cambiar el acceso." });
      return;
    }
    setAviso({ tipo: "ok", texto: `${u.nombre} quedó ${desactivar ? "desactivado" : "activo"}.` });
    recargar();
  };

  /* ---------------------------------------------------------- editar */
  const abrirEdicion = (u) => {
    setAviso(null);
    setBorrarListo(false);
    setEditando({ ...u, nombreForm: u.nombreReal || "", telefonoForm: u.telefono || "", rolForm: u.rolPersonalizado || "" });
  };

  const guardarEdicion = async (e) => {
    e.preventDefault();
    const u = editando;
    setCambiando(u.uid);
    const datos = { id: u.uid, nombre: u.nombreForm, telefono: u.telefonoForm };
    // El rol solo lo manda el dueño, y solo para administradores.
    if (soyDueno && u.rolId === "admin") datos.rolId = u.rolForm || null;
    const r = await editarUsuarioAccion(datos);
    setCambiando(null);
    if (!r.ok) { setAviso({ tipo: "error", texto: r.motivo || "No se guardó." }); return; }
    setAviso({ tipo: "ok", texto: `Guardé los cambios de ${u.nombreForm}.` });
    setEditando(null);
    recargar();
  };

  const mandarEnlace = async (u) => {
    setCambiando(u.uid);
    setAviso(null);
    const r = await mandarEnlaceAccion({ id: u.uid });
    setCambiando(null);
    setAviso(r.ok
      ? { tipo: "ok", texto: r.demo ? "Modo de demostración: no se mandó nada." : `Le mandé a ${r.correo} un enlace para escoger su contraseña.` }
      : { tipo: "error", texto: r.motivo || "No se pudo mandar el enlace." });
  };

  const eliminar = async (u) => {
    if (!borrarListo) { setBorrarListo(true); return; }
    setCambiando(u.uid);
    const r = await eliminarUsuarioAccion({ id: u.uid });
    setCambiando(null);
    setBorrarListo(false);
    if (!r.ok) { setAviso({ tipo: "error", texto: r.motivo || "No se pudo eliminar." }); return; }
    setAviso({ tipo: "ok", texto: `${u.nombre} ya no tiene cuenta.` });
    setEditando(null);
    recargar();
  };

  // Permisos sueltos que asigna el dueño: precios y eliminar clientes.
  const cambiarPermiso = async (u, permiso, valor) => {
    setCambiando(u.uid);
    setAviso(null);
    const r = await cambiarPermisoAccion({ perfilId: u.uid, permiso, valor });
    setCambiando(null);
    if (!r.ok) { setAviso({ tipo: "error", texto: r.motivo || "No se guardó el permiso." }); return; }
    const nuevos = aplicarPermiso(u.permisos, permiso, valor);
    setLista((l) => l.map((x) => (x.uid === u.uid ? { ...x, permisos: nuevos } : x)));
    setEditando((ed) => (ed && ed.uid === u.uid ? { ...ed, permisos: nuevos } : ed));
  };

  /* ---------------------------------------------------------- roles */
  const guardarRol = async (e) => {
    e.preventDefault();
    setAviso(null);
    const { id, ...datos } = rolForm;
    const r = id ? await editarRolAccion({ id, ...datos }) : await crearRolAccion(datos);
    if (!r.ok) { setAviso({ tipo: "error", texto: r.motivo || "No se guardó el rol." }); return; }
    setAviso({ tipo: "ok", texto: id ? `Rol "${datos.nombre}" actualizado.` : `Rol "${datos.nombre}" creado.` });
    setRolForm(null);
    recargar();
  };

  const borrarRol = async (rol, personas) => {
    const pregunta = personas
      ? `¿Borrar el rol "${rol.nombre}"? ${personas} persona(s) se quedarán sin rol: solo podrán ver, no cambiar nada, hasta que les pongas otro.`
      : `¿Borrar el rol "${rol.nombre}"?`;
    if (!window.confirm(pregunta)) return;
    const r = await borrarRolAccion({ id: rol.id });
    if (!r.ok) { setAviso({ tipo: "error", texto: r.motivo || "No se borró." }); return; }
    setAviso({ tipo: "ok", texto: `Rol "${rol.nombre}" borrado.` });
    recargar();
  };

  const alternarPermisoRol = (p) =>
    setRolForm((f) => ({
      ...f,
      permisos: f.permisos.includes(p) ? f.permisos.filter((x) => x !== p) : [...f.permisos, p],
    }));

  const rolClase = (u) => (u.rolId === "dueno" || u.rolId === "admin" ? "ruta" : u.rolId === "operador" ? "ok" : "");
  const detalleRol = ROLES.find((r) => r.id === ROLES_INVITABLES[form.rol])?.detalle;
  const completoId = roles.find((r) => r.nombre === ROL_COMPLETO)?.id || "";
  // Lo que puede tocar quien mira: el dueño a todo el equipo; un admin, a los choferes.
  const puedoTocar = (u) => u.uid && u.rolId !== "dueno" && u.uid !== yo?.uid && (soyDueno || u.rolId === "operador");

  return (
    <>
      <div className="pt-page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1>Usuarios y roles</h1>
          <p>Administra las cuentas del equipo y qué puede hacer cada quien.</p>
        </div>
        {pestana === "equipo" ? (
          <button className="pt-btn pt-btn-naranja" onClick={() => { setAlta((v) => !v); setAviso(null); setForm({ ...FORM_VACIO, rolId: completoId }); }}>
            {alta ? <><X /> Cancelar</> : <><UserPlus /> Invitar usuario</>}
          </button>
        ) : soyDueno ? (
          <button className="pt-btn pt-btn-naranja" onClick={() => { setRolForm(rolForm ? null : ROL_VACIO); setAviso(null); }}>
            {rolForm ? <><X /> Cancelar</> : <><Plus /> Nuevo rol</>}
          </button>
        ) : null}
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }} role="tablist">
        {[["equipo", `Equipo (${lista.length})`], ["roles", `Roles (${roles.length})`]].map(([id, texto]) => (
          <button key={id} type="button" role="tab" aria-selected={pestana === id}
            className={`pt-chip ${pestana === id ? "activo" : ""}`}
            onClick={() => { setPestana(id); setAviso(null); }}>
            {texto}
          </button>
        ))}
      </div>

      <Aviso aviso={aviso} />

      {pestana === "equipo" && (
        <>
          {alta && (
            <div className="pt-card" style={{ marginBottom: "1.1rem" }}>
              <div className="pt-card-head"><h2>Invitar usuario al equipo</h2></div>
              <form onSubmit={invitar}>
                <div className="pt-grid pt-grid-3" style={{ gap: "0.8rem", marginBottom: "1rem" }}>
                  <div className="pt-campo" style={{ margin: 0 }}>
                    <label>Nombre completo</label>
                    <input className="pt-input" required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
                  </div>
                  <div className="pt-campo" style={{ margin: 0 }}>
                    <label>Correo</label>
                    <input className="pt-input" type="email" required value={form.correo} onChange={(e) => setForm({ ...form, correo: e.target.value })} />
                  </div>
                  <div className="pt-campo" style={{ margin: 0 }}>
                    <label>Tipo de cuenta</label>
                    <select className="pt-input" value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
                      {Object.entries(ROLES_INVITABLES).map(([id, texto]) => <option key={id} value={id}>{texto}</option>)}
                    </select>
                  </div>
                  {form.rol === "admin" && soyDueno && (
                    <div className="pt-campo" style={{ margin: 0 }}>
                      <label>Rol (qué puede hacer)</label>
                      <select className="pt-input" value={form.rolId} onChange={(e) => setForm({ ...form, rolId: e.target.value })}>
                        {roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                      </select>
                    </div>
                  )}
                </div>
                <div style={{ background: "var(--mc-blanco)", border: "1px solid var(--mc-linea)", borderRadius: 10, padding: "0.75rem 0.9rem", fontSize: "0.85rem", color: "var(--mc-gris)", marginBottom: "1rem" }}>
                  <ShieldCheck style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--mc-verde-claro)" }} />
                  {detalleRol} Le llega un correo para escoger su contraseña.
                </div>
                <button type="submit" className="pt-btn pt-btn-verde" style={{ padding: "0.65rem 1.4rem" }} disabled={enviando}>
                  {enviando ? "Enviando…" : "Enviar invitación"}
                </button>
              </form>
            </div>
          )}

          {editando && (
            <div className="pt-card" style={{ marginBottom: "1.1rem" }}>
              <div className="pt-card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2>Editar a {editando.nombre}</h2>
                <button type="button" className="pt-btn" onClick={() => setEditando(null)} aria-label="Cerrar"><X /></button>
              </div>
              <form onSubmit={guardarEdicion}>
                <div className="pt-grid pt-grid-3" style={{ gap: "0.8rem", marginBottom: "1rem" }}>
                  <div className="pt-campo" style={{ margin: 0 }}>
                    <label>Nombre</label>
                    <input className="pt-input" required value={editando.nombreForm} onChange={(e) => setEditando({ ...editando, nombreForm: e.target.value })} />
                  </div>
                  <div className="pt-campo" style={{ margin: 0 }}>
                    <label>Teléfono (10 dígitos)</label>
                    <input className="pt-input" inputMode="tel" value={editando.telefonoForm} onChange={(e) => setEditando({ ...editando, telefonoForm: e.target.value })} />
                  </div>
                  {editando.rolId === "admin" && (
                    <div className="pt-campo" style={{ margin: 0 }}>
                      <label>Rol</label>
                      <select className="pt-input" value={editando.rolForm} disabled={!soyDueno}
                        title={soyDueno ? "" : "Solo el dueño asigna roles"}
                        onChange={(e) => setEditando({ ...editando, rolForm: e.target.value })}>
                        <option value="">Sin rol (solo ve)</option>
                        {roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                      </select>
                    </div>
                  )}
                </div>
                {editando.rolId === "admin" && soyDueno && (
                  <div style={{ display: "flex", gap: "1.2rem", flexWrap: "wrap", marginBottom: "1rem", fontSize: "0.85rem" }}>
                    <span style={{ color: "var(--mc-gris)" }}>Además de su rol:</span>
                    {PERMISOS_ASIGNABLES.map((p) => (
                      <label key={p.clave} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                        <input type="checkbox" checked={(editando.permisos || []).includes(p.clave)}
                          disabled={cambiando === editando.uid}
                          onChange={(e) => cambiarPermiso(editando, p.clave, e.target.checked)} />
                        {p.texto}
                      </label>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                  <button type="submit" className="pt-btn pt-btn-verde" disabled={cambiando === editando.uid}>Guardar</button>
                  <button type="button" className="pt-btn" disabled={cambiando === editando.uid} onClick={() => mandarEnlace(editando)}
                    title="Sirve para reenviar la invitación o para que restablezca su contraseña">
                    <EnvelopeSimple /> Mandar enlace de contraseña
                  </button>
                  {soyDueno && (
                    <button type="button" className="pt-btn" disabled={cambiando === editando.uid} onClick={() => eliminar(editando)}
                      style={{ marginLeft: "auto", color: "#b3261e", borderColor: borrarListo ? "#b3261e" : undefined }}>
                      <Trash /> {borrarListo ? "¿Seguro? Toca otra vez para eliminar" : "Eliminar cuenta"}
                    </button>
                  )}
                </div>
                {soyDueno && borrarListo && (
                  <p style={{ fontSize: "0.82rem", color: "var(--mc-gris)", marginTop: "0.6rem" }}>
                    Eliminar es para siempre. Si tiene historial (recolecciones, rutas), mejor desactívala: no entra y su historial se conserva.
                  </p>
                )}
              </form>
            </div>
          )}

          <div className="pt-card" style={{ marginBottom: "1.1rem" }}>
            <div className="pt-card-head"><h2>Equipo ({lista.length})</h2></div>
            <div className="pt-tabla-wrap">
              <table className="pt-tabla" style={{ minWidth: 820 }}>
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Teléfono</th>
                    <th>Rol</th>
                    <th>Estatus</th>
                    <th>Último acceso</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((u) => {
                    const d = detalle[u.uid] || {};
                    return (
                      <tr key={u.id}>
                        <td>
                          <strong>{u.nombre}</strong>
                          {d.correo && <div style={{ fontSize: "0.8rem", color: "var(--mc-gris)" }}>{d.correo}</div>}
                        </td>
                        <td>{u.telefono || "—"}</td>
                        <td>
                          <span className={`pt-badge ${rolClase(u)}`}>{etiquetaRol(u)}</span>
                          {(u.permisos || []).length > 0 && (
                            <div style={{ fontSize: "0.75rem", color: "var(--mc-gris)", marginTop: 3 }}>
                              + {u.permisos.map(textoPermiso).join(", ").toLowerCase()}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`pt-badge ${u.estatus === "activo" ? "ok" : ""}`}>
                            {u.estatus === "activo" ? "Activo" : "Desactivado"}
                          </span>
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>{d.ultimoAcceso ? fechaLarga(d.ultimoAcceso.slice(0, 10)) : "Nunca"}</td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {u.rolId === "dueno" || !u.uid ? (
                            <span style={{ color: "var(--mc-gris-claro)", fontSize: "0.78rem" }}>Principal</span>
                          ) : puedoTocar(u) ? (
                            <div style={{ display: "flex", gap: "0.4rem" }}>
                              <button className="pt-btn" onClick={() => abrirEdicion(u)} title="Editar"><PencilSimple /> Editar</button>
                              <button className="pt-btn" onClick={() => cambiarActivo(u)} disabled={cambiando === u.uid}
                                title={u.estatus === "activo" ? "Desactivar su acceso" : "Reactivar su acceso"}>
                                {u.estatus === "activo" ? <><Prohibit /> Desactivar</> : <><ArrowCounterClockwise /> Reactivar</>}
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: "var(--mc-gris-claro)", fontSize: "0.78rem" }}>Solo el dueño</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {pestana === "roles" && (
        <>
          {rolForm && (
            <div className="pt-card" style={{ marginBottom: "1.1rem" }}>
              <div className="pt-card-head"><h2>{rolForm.id ? `Editar rol "${rolForm.nombre}"` : "Nuevo rol"}</h2></div>
              <form onSubmit={guardarRol}>
                <div className="pt-grid pt-grid-2" style={{ gap: "0.8rem", marginBottom: "1rem" }}>
                  <div className="pt-campo" style={{ margin: 0 }}>
                    <label>Nombre (p. ej. "Caja", "Operaciones")</label>
                    <input className="pt-input" required maxLength={60} value={rolForm.nombre} onChange={(e) => setRolForm({ ...rolForm, nombre: e.target.value })} />
                  </div>
                  <div className="pt-campo" style={{ margin: 0 }}>
                    <label>Descripción (opcional)</label>
                    <input className="pt-input" value={rolForm.descripcion || ""} onChange={(e) => setRolForm({ ...rolForm, descripcion: e.target.value })} />
                  </div>
                </div>
                <p style={{ fontSize: "0.85rem", color: "var(--mc-gris)", marginBottom: "0.6rem" }}>
                  Qué puede <strong>cambiar</strong> (ver, puede ver todo el panel; el menú solo le enseña lo marcado):
                </p>
                <div className="pt-grid pt-grid-3" style={{ gap: "0.45rem", marginBottom: "1rem" }}>
                  {TODAS.map((s) => (
                    <label key={s.id} style={{ display: "inline-flex", gap: 8, alignItems: "center", fontSize: "0.88rem" }}>
                      <input type="checkbox" checked={rolForm.permisos.includes(s.id)} onChange={() => alternarPermisoRol(s.id)} />
                      {s.texto}
                    </label>
                  ))}
                </div>
                <button type="submit" className="pt-btn pt-btn-verde">{rolForm.id ? "Guardar cambios" : "Crear rol"}</button>
              </form>
            </div>
          )}

          <div className="pt-grid pt-grid-2" style={{ gap: "1rem" }}>
            {roles.map((r) => {
              const personas = lista.filter((u) => u.rolPersonalizado === r.id).length;
              return (
                <div key={r.id} className="pt-card">
                  <div className="pt-card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                    <h2>{r.nombre}</h2>
                    <span style={{ fontSize: "0.8rem", color: "var(--mc-gris)" }}>{personas} persona(s)</span>
                  </div>
                  {r.descripcion && <p style={{ fontSize: "0.85rem", color: "var(--mc-gris)", marginTop: 0 }}>{r.descripcion}</p>}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginBottom: soyDueno ? "0.9rem" : 0 }}>
                    {r.permisos.length
                      ? r.permisos.map((p) => <span key={p} className="pt-badge ruta">{textoPermiso(p)}</span>)
                      : <span style={{ fontSize: "0.85rem", color: "var(--mc-gris)" }}>Solo ver</span>}
                  </div>
                  {soyDueno && (
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button className="pt-btn" onClick={() => { setRolForm({ ...r, descripcion: r.descripcion || "" }); setAviso(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                        <PencilSimple /> Editar
                      </button>
                      <button className="pt-btn" style={{ color: "#b3261e" }} onClick={() => borrarRol(r, personas)}><Trash /> Borrar</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {!roles.length && <div className="pt-card">Todavía no hay roles.</div>}

          <div className="pt-card" style={{ marginTop: "1.1rem" }}>
            <div className="pt-card-head"><h2>Cómo funciona</h2></div>
            <ul style={{ fontSize: "0.88rem", color: "var(--mc-gris)", margin: 0, paddingLeft: "1.1rem", lineHeight: 1.6 }}>
              <li>El <strong>dueño</strong> puede todo y es el único que crea roles y se los asigna a los administradores.</li>
              <li>Un <strong>administrador</strong> cambia solo lo que marque su rol; sin rol, solo puede ver.</li>
              <li>Los <strong>choferes</strong> no llevan rol: entran al modo chofer y ven solo sus paradas.</li>
              <li>&quot;Cambiar precios&quot; y &quot;Eliminar clientes&quot; también se pueden dar a una sola persona desde Editar.</li>
            </ul>
          </div>
        </>
      )}
    </>
  );
}
