"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  X,
  Key,
  CheckCircle,
} from "@phosphor-icons/react/dist/ssr";
import { listarClientes, crearCliente } from "@/lib/datos-clientes";
import { darAccesoACliente } from "@/app/acciones-alta-cliente";
import { pesos, fechaLarga } from "@/lib/portal-datos";
import { etiquetaEstado, loQueFalta, puedeRecibirAcceso } from "@/lib/estado-cliente.mjs";

/** Por qué no se puede pulsar el botón, en el mismo texto que va en el `title`. */
const MOTIVO_TEXTO = {
  "ya-tiene-acceso": "Ya tiene acceso",
  "sin-correo": "Sin correo",
};

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
  // Acceso al portal por cliente: { [uuid]: { enviando, error, enviado } }.
  // Va por `uuid` (el id real) y no por `c.id` (el folio, que es lo que se ve
  // en pantalla) porque es lo que la acción del servidor necesita para
  // encontrar al cliente.
  const [accesos, setAccesos] = useState({});
  const setAcceso = (uuid, patch) =>
    setAccesos((a) => ({ ...a, [uuid]: { ...(a[uuid] || {}), ...patch } }));

  const darAcceso = async (c) => {
    // Es un correo real a un cliente real: se confirma antes de mandarlo.
    if (!window.confirm(`¿Enviar el acceso al portal a ${c.empresa} (${c.correo})?`)) return;
    setAcceso(c.uuid, { enviando: true, error: "" });
    const r = await darAccesoACliente({ clienteId: c.uuid });
    if (!r.ok) {
      setAcceso(c.uuid, { enviando: false, error: r.motivo || "No se pudo dar el acceso." });
      return;
    }
    setAcceso(c.uuid, { enviando: false, error: "", enviado: true });
    // El cliente ya tiene acceso: refleja el cambio sin volver a pedir toda
    // la lista, igual que hace /admin/solicitudes al activar una cuenta.
    setLista((l) => l.map((x) => (x.uuid === c.uuid ? { ...x, tieneAcceso: true } : x)));
  };

  const totalPorPagar = lista.reduce((a, c) => a + c.porPagar, 0);
  const activos = lista.filter((c) => c.estatus === "activo").length;
  // El cuaderno del 27-ago-2026 llego con 16 de 42 clientes sin correo,
  // telefono o contacto: se cargan igual (ver `estado-cliente.mjs`), pero
  // Morcast necesita ver cuantos le faltan por completar sin tener que
  // contarlos fila por fila.
  const pendientes = lista.filter((c) => c.estatus === "pendiente-info").length;

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
          <p>
            {lista.length} clientes · {activos} activos
            {pendientes > 0 && <> · {pendientes} pendientes por información</>}
            {" "}· Por cobrar {pesos(totalPorPagar)}
          </p>
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
          <table className="pt-tabla" style={{ minWidth: 940 }}>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Contacto</th>
                <th>Plan</th>
                <th className="num">Saldo</th>
                <th className="num">Por pagar</th>
                <th>Estatus</th>
                <th>Desde</th>
                <th>Acceso al portal</th>
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
                    {(() => {
                      // `title` es la unica pista visible de QUE le falta a
                      // un pendiente: sin esto, "Pendiente por informacion"
                      // no dice si es el correo, el telefono o el contacto,
                      // y Morcast tendria que ir a buscarlo a mano.
                      const et = etiquetaEstado(c.estatus);
                      const falta = loQueFalta(c);
                      return (
                        <span
                          className={`pt-badge ${et.clase}`}
                          title={falta.length ? `Falta: ${falta.join(", ")}` : ""}
                        >
                          {et.texto}
                        </span>
                      );
                    })()}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{fechaLarga(c.desde)}</td>
                  <td style={{ minWidth: 200 }}>
                    {(() => {
                      const a = accesos[c.uuid] || {};
                      if (a.enviado || c.tieneAcceso) {
                        return (
                          <span className="pt-badge ok" style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                            <CheckCircle /> Tiene acceso
                          </span>
                        );
                      }
                      // `puedeRecibirAcceso()` es la MISMA regla que usa el
                      // servidor (estado-cliente.mjs): si aquí se pintara
                      // habilitado un botón que el servidor va a rechazar,
                      // el cliente vería un error sin explicación.
                      const evaluado = puedeRecibirAcceso(c);
                      return (
                        <>
                          <button
                            type="button"
                            className="pt-btn pt-btn-verde"
                            disabled={!evaluado.puede || a.enviando}
                            title={evaluado.puede ? "" : MOTIVO_TEXTO[evaluado.motivo]}
                            style={{ opacity: evaluado.puede && !a.enviando ? 1 : 0.55, whiteSpace: "nowrap" }}
                            onClick={() => darAcceso(c)}
                          >
                            <Key /> {a.enviando ? "Enviando…" : evaluado.puede ? "Dar acceso al portal" : MOTIVO_TEXTO[evaluado.motivo]}
                          </button>
                          {a.error && (
                            <p style={{ color: "#ef8080", fontSize: "0.78rem", margin: "0.35rem 0 0" }}>{a.error}</p>
                          )}
                        </>
                      );
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
