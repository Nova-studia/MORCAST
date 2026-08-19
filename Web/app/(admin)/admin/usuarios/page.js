"use client";

import { useEffect, useState } from "react";
import { FiUserPlus, FiX, FiShield, FiTrash2 } from "react-icons/fi";
import { ROLES } from "@/lib/admin-datos";
import { listarUsuarios } from "@/lib/datos-clientes";
import { fechaLarga } from "@/lib/portal-datos";

export default function UsuariosAdmin() {
  const [lista, setLista] = useState([]);

  useEffect(() => {
    let vivo = true;
    listarUsuarios().then((l) => { if (vivo) setLista(l); });
    return () => { vivo = false; };
  }, []);
  const [alta, setAlta] = useState(false);
  const [form, setForm] = useState({ nombre: "", correo: "", rol: "Auxiliar de administrador" });

  const crear = (e) => {
    e.preventDefault();
    const nuevo = {
      id: `U-${String(Math.max(0, ...lista.map((u) => parseInt(u.id.split("-")[1], 10) || 0)) + 1).padStart(3, "0")}`,
      nombre: form.nombre,
      correo: form.correo,
      rol: form.rol,
      estatus: "invitado",
      ultimo: "—",
    };
    setLista((l) => [...l, nuevo]);
    setForm({ nombre: "", correo: "", rol: "Auxiliar de administrador" });
    setAlta(false);
  };

  const quitar = (id) => setLista((l) => l.filter((u) => u.id !== id));

  const rolClase = (rol) =>
    rol === "Administrador"
      ? "ruta"
      : rol === "Auxiliar de administrador"
        ? "prog"
        : rol === "Chofer / Operador"
          ? "ok"
          : "";

  return (
    <>
      <div className="pt-page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1>Usuarios y roles</h1>
          <p>Administra las cuentas del equipo y sus permisos.</p>
        </div>
        <button className="pt-btn pt-btn-naranja" onClick={() => setAlta((v) => !v)}>
          {alta ? <><FiX /> Cancelar</> : <><FiUserPlus /> Invitar usuario</>}
        </button>
      </div>

      {alta && (
        <div className="pt-card" style={{ marginBottom: "1.1rem" }}>
          <div className="pt-card-head"><h2>Invitar usuario al equipo</h2></div>
          <form onSubmit={crear}>
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
                  {ROLES.map((r) => <option key={r.id}>{r.id}</option>)}
                </select>
              </div>
            </div>
            <div style={{ background: "var(--mc-blanco)", border: "1px solid var(--mc-linea)", borderRadius: 10, padding: "0.75rem 0.9rem", fontSize: "0.85rem", color: "var(--mc-gris)", marginBottom: "1rem" }}>
              <FiShield style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--mc-verde-claro)" }} />
              {ROLES.find((r) => r.id === form.rol)?.detalle}
            </div>
            <button type="submit" className="pt-btn pt-btn-verde" style={{ padding: "0.65rem 1.4rem" }}>
              Enviar invitación
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
                <th>Correo</th>
                <th>Rol</th>
                <th>Estatus</th>
                <th>Último acceso</th>
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
                      {u.estatus === "activo" ? "Activo" : "Invitado"}
                    </span>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{u.ultimo === "—" ? "—" : fechaLarga(u.ultimo)}</td>
                  <td>
                    {u.rol !== "Administrador" ? (
                      <button className="pt-btn" onClick={() => quitar(u.id)} aria-label="Quitar"><FiTrash2 /></button>
                    ) : (
                      <span style={{ color: "var(--mc-gris-claro)", fontSize: "0.78rem" }}>Principal</span>
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
        <div className="pt-card-head"><h2>Roles disponibles</h2></div>
        <div className="pt-grid pt-grid-2" style={{ gap: "0.8rem" }}>
          {ROLES.map((r) => (
            <div key={r.id} style={{ display: "flex", gap: "0.7rem", padding: "0.6rem 0", borderBottom: "1px solid var(--mc-linea)" }}>
              <div className="pt-stat-icono teal" style={{ margin: 0, width: 34, height: 34, flexShrink: 0 }}><FiShield /></div>
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
