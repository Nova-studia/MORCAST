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
} from "@phosphor-icons/react/dist/ssr";
import { ROLES } from "@/lib/admin-datos";
import { ROLES_INVITABLES } from "@/lib/equipo.mjs";
import { listarUsuarios } from "@/lib/datos-clientes";
import { fechaLarga } from "@/lib/portal-datos";
import { invitarUsuarioEquipo, cambiarActivoUsuario } from "@/app/acciones-equipo";
import { cambiarPermisoAccion } from "@/app/acciones-precios";
import { obtenerSesionAdmin } from "@/lib/admin-sesion";

/**
 * EL EQUIPO DE MORCAST.
 *
 * Hasta el 2-oct-2026 "Invitar usuario" agregaba una fila a un `useState` y
 * al recargar desaparecía: no se creaba nada. Ahora invitar crea la cuenta de
 * verdad (app/acciones-equipo.js) y a la persona le llega un correo para
 * escoger su contraseña. Solo se ofrecen los dos roles que existen en la base
 * para el personal: Administrador y Chofer / Operador.
 */
const FORM_VACIO = { nombre: "", correo: "", rol: "operador" };

export default function UsuariosAdmin() {
  const [lista, setLista] = useState([]);
  const [alta, setAlta] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState(null); // { tipo: "ok" | "error", texto }
  const [cambiando, setCambiando] = useState(null); // uid en curso
  // Permisos finos (db/027): solo el dueño los asigna. Hoy, "precios".
  const [yo, setYo] = useState(null);
  useEffect(() => { obtenerSesionAdmin().then(setYo); }, []);
  const soyDueno = yo?.rolId === "dueno" || Boolean(yo?.demo);
  const permisoPrecios = async (u, valor) => {
    setCambiando(u.uid);
    setAviso(null);
    const r = await cambiarPermisoAccion({ perfilId: u.uid, precios: valor });
    setCambiando(null);
    if (!r.ok) { setAviso({ tipo: "error", texto: r.motivo || "No se guardó el permiso." }); return; }
    setLista((l) => l.map((x) => (x.uid === u.uid
      ? { ...x, permisos: valor ? [...(x.permisos || []).filter((p) => p !== "precios"), "precios"] : (x.permisos || []).filter((p) => p !== "precios") }
      : x)));
    setAviso({ tipo: "ok", texto: valor ? `${u.nombre} ya puede cambiar precios.` : `${u.nombre} ya no puede cambiar precios.` });
  };

  const recargar = () => listarUsuarios().then(setLista);

  useEffect(() => {
    let vivo = true;
    listarUsuarios().then((l) => { if (vivo) setLista(l); });
    return () => { vivo = false; };
  }, []);

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

  const rolClase = (rol) =>
    rol === "Administrador" || rol === "Dueño"
      ? "ruta"
      : rol === "Chofer / Operador"
        ? "ok"
        : "";

  const detalleRol = ROLES.find((r) => r.id === ROLES_INVITABLES[form.rol])?.detalle;

  return (
    <>
      <div className="pt-page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1>Usuarios y roles</h1>
          <p>Administra las cuentas del equipo y sus permisos.</p>
        </div>
        <button className="pt-btn pt-btn-naranja" onClick={() => { setAlta((v) => !v); setAviso(null); }}>
          {alta ? <><X /> Cancelar</> : <><UserPlus /> Invitar usuario</>}
        </button>
      </div>

      {aviso && (
        aviso.tipo === "ok" ? (
          <div className="pt-activar-ok" role="status" style={{ marginBottom: "1rem" }}>
            <CheckCircle /> {aviso.texto}
          </div>
        ) : (
          <div className="pt-login-error" role="alert" style={{ marginBottom: "1rem" }}>
            <WarningCircle style={{ marginRight: 6, verticalAlign: "-2px" }} /> {aviso.texto}
          </div>
        )
      )}

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
                <label>Rol</label>
                <select className="pt-input" value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
                  {Object.entries(ROLES_INVITABLES).map(([id, texto]) => <option key={id} value={id}>{texto}</option>)}
                </select>
              </div>
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

      <div className="pt-card" style={{ marginBottom: "1.1rem" }}>
        <div className="pt-card-head"><h2>Equipo ({lista.length})</h2></div>
        <div className="pt-tabla-wrap">
          <table className="pt-tabla" style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Teléfono</th>
                <th>Rol</th>
                <th>Estatus</th>
                <th>Alta</th>
                <th>Precios</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.nombre}</strong></td>
                  <td>{u.correo}</td>
                  <td><span className={`pt-badge ${rolClase(u.rol)}`}>{u.rol}</span></td>
                  <td>
                    <span className={`pt-badge ${u.estatus === "activo" ? "ok" : ""}`}>
                      {u.estatus === "activo" ? "Activo" : "Desactivado"}
                    </span>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{!u.ultimo || u.ultimo === "—" ? "—" : fechaLarga(u.ultimo)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {u.rolId === "dueno" ? (
                      <span style={{ color: "var(--mc-gris-claro)", fontSize: "0.78rem" }}>Todos los permisos</span>
                    ) : u.rolId === "admin" && u.uid ? (
                      <label style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: "0.82rem" }}
                        title={soyDueno ? "Marcar para que pueda cambiar precios y facturación" : "Solo el dueño puede cambiarlo"}>
                        <input type="checkbox" checked={(u.permisos || []).includes("precios")}
                          disabled={!soyDueno || cambiando === u.uid}
                          onChange={(e) => permisoPrecios(u, e.target.checked)} />
                        Puede cambiar precios
                      </label>
                    ) : (
                      <span style={{ color: "var(--mc-gris-claro)" }}>—</span>
                    )}
                  </td>
                  <td>
                    {u.rolId === "dueno" || !u.uid ? (
                      <span style={{ color: "var(--mc-gris-claro)", fontSize: "0.78rem" }}>Principal</span>
                    ) : (
                      <button
                        className="pt-btn"
                        onClick={() => cambiarActivo(u)}
                        disabled={cambiando === u.uid}
                        title={u.estatus === "activo" ? "Desactivar su acceso" : "Reactivar su acceso"}
                      >
                        {u.estatus === "activo" ? <><Prohibit /> Desactivar</> : <><ArrowCounterClockwise /> Reactivar</>}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Referencia de roles */}
      <div className="pt-card">
        <div className="pt-card-head"><h2>Roles</h2></div>
        <div className="pt-grid pt-grid-2" style={{ gap: "0.8rem" }}>
          {ROLES.map((r) => (
            <div key={r.id} style={{ display: "flex", gap: "0.7rem", padding: "0.6rem 0", borderBottom: "1px solid var(--mc-linea)" }}>
              <div className="pt-stat-icono teal" style={{ margin: 0, width: 34, height: 34, flexShrink: 0 }}><ShieldCheck /></div>
              <div>
                <strong style={{ fontSize: "0.92rem" }}>{r.id}</strong>
                <div style={{ color: "var(--mc-gris)", fontSize: "0.83rem" }}>{r.detalle}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
