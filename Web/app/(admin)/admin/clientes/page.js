"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  X,
} from "@phosphor-icons/react/dist/ssr";
import { listarClientes, crearCliente } from "@/lib/datos-clientes";
import { pesos, fechaLarga } from "@/lib/portal-datos";

export default function ClientesAdmin() {
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    listarClientes().then((l) => {
      if (!vivo) return;
      setLista(l);
      setCargando(false);
    });
    return () => { vivo = false; };
  }, []);
  const [alta, setAlta] = useState(false);
  const [form, setForm] = useState({ empresa: "", contacto: "", correo: "", telefono: "", plan: "Por evento" });

  const totalPorPagar = lista.reduce((a, c) => a + c.porPagar, 0);
  const activos = lista.filter((c) => c.estatus === "activo").length;

  const crear = async (e) => {
    e.preventDefault();
    setError("");
    const r = await crearCliente(form);
    if (!r.ok) {
      setError("No se pudo dar de alta. Vuelve a intentarlo.");
      return;
    }
    // El alta NO crea usuario ni contrasena: el acceso al portal se manda
    // aparte, por invitacion, para que el cliente escoja la suya.
    setLista((l) => [r.cliente, ...l]);
    setForm({ empresa: "", contacto: "", correo: "", telefono: "", plan: "Por evento" });
    setAlta(false);
  };

  return (
    <>
      <div className="pt-page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1>Clientes</h1>
          <p>{lista.length} clientes · {activos} activos · Por cobrar {pesos(totalPorPagar)}</p>
        </div>
        <button className="pt-btn pt-btn-naranja" onClick={() => setAlta((v) => !v)}>
          {alta ? <><X /> Cancelar</> : <><Plus /> Nuevo cliente</>}
        </button>
      </div>

      {alta && (
        <div className="pt-card" style={{ marginBottom: "1.1rem" }}>
          <div className="pt-card-head"><h2>Alta de cliente</h2></div>
          <form onSubmit={crear} className="pt-grid pt-grid-2" style={{ gap: "0.8rem" }}>
            <div className="pt-campo" style={{ margin: 0 }}>
              <label>Empresa / razón social</label>
              <input className="pt-input" required value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} />
            </div>
            <div className="pt-campo" style={{ margin: 0 }}>
              <label>Contacto</label>
              <input className="pt-input" required value={form.contacto} onChange={(e) => setForm({ ...form, contacto: e.target.value })} />
            </div>
            <div className="pt-campo" style={{ margin: 0 }}>
              <label>Correo</label>
              <input className="pt-input" type="email" required value={form.correo} onChange={(e) => setForm({ ...form, correo: e.target.value })} />
            </div>
            <div className="pt-campo" style={{ margin: 0 }}>
              <label>Teléfono</label>
              <input className="pt-input" required value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
            </div>
            <div className="pt-campo" style={{ margin: 0 }}>
              <label>Plan</label>
              <select className="pt-input" value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}>
                <option>Por evento</option>
                <option>Contrato mensual</option>
                <option>Contrato anual</option>
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button type="submit" className="pt-btn pt-btn-verde" style={{ width: "100%", justifyContent: "center", padding: "0.7rem" }}>
                Guardar cliente
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="pt-card">
        <div className="pt-tabla-wrap">
          <table className="pt-tabla" style={{ minWidth: 820 }}>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Contacto</th>
                <th>Plan</th>
                <th className="num">Saldo</th>
                <th className="num">Por pagar</th>
                <th>Estatus</th>
                <th>Desde</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong style={{ display: "block" }}>{c.empresa}</strong>
                    <span className="folio" style={{ fontSize: "0.8rem" }}>{c.id}</span>
                  </td>
                  <td>
                    {c.contacto}
                    <br />
                    <span style={{ color: "var(--mc-gris)", fontSize: "0.8rem" }}>{c.correo}</span>
                  </td>
                  <td>{c.plan}</td>
                  <td className="num">{pesos(c.saldo)}</td>
                  <td className="num">
                    <span className={c.porPagar > 0 ? "pt-mov cargo" : ""}>{pesos(c.porPagar)}</span>
                  </td>
                  <td>
                    <span className={`pt-badge ${c.estatus === "activo" ? "ok" : "ruta"}`}>
                      {c.estatus === "activo" ? "Activo" : "Moroso"}
                    </span>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{fechaLarga(c.desde)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
