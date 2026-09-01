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
import { enHold } from "@/lib/estado-sistema";

/** Por qué no se puede pulsar el botón, en el mismo texto que va en el `title`. */
const MOTIVO_TEXTO = {
  "ya-tiene-acceso": "Ya tiene acceso",
  "sin-correo": "Sin correo",
};

/**
 * Version corta de la etiqueta, SOLO para esta tabla.
 *
 * `etiquetaEstado()` (lib/estado-cliente.mjs) no se toca: la usan las
 * pruebas (tests/estado-cliente.test.mjs) y la puede estar usando otra
 * pantalla que si necesite el texto largo. Acortar aqui, no alla, deja
 * claro que es una cosa de esta tabla y no un cambio de significado.
 */
const ETIQUETA_CORTA_TABLA = {
  "pendiente-info": "Pendiente",
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
          <table className="pt-tabla pt-tabla-compacta">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Contacto</th>
                <th>Plan</th>
                {/* Saldo y Por pagar median 212px juntas y HOY dicen $0.00
                    en los 43 clientes: no hay facturacion todavia y el
                    sistema esta en Hold (lib/estado-sistema.js). Se funden
                    en una sola columna y se ESCONDEN mientras dure el Hold
                    -- no es una columna que se borro, es una que reaparece
                    sola en cuanto entren los precios reales y se apague el
                    interruptor. */}
                {!enHold() && <th className="num">Saldo</th>}
                <th>Estatus</th>
                <th>Desde</th>
                <th style={{ textAlign: "center" }}>Acceso</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong style={{ display: "block" }}>{c.empresa}</strong>
                    <span className="folio" style={{ fontSize: "0.8rem" }}>{c.id}</span>
                  </td>
                  <td className="pt-celda-recorte">
                    {/* El correo largo era lo que ensanchaba esta columna a
                        346px. Se recorta con puntos suspensivos y el valor
                        completo se mueve al `title`. */}
                    <span className="pt-recorte" title={c.contacto}>{c.contacto}</span>
                    <span className="pt-recorte" style={{ color: "var(--mc-gris)", fontSize: "0.8rem" }} title={c.correo}>{c.correo}</span>
                  </td>
                  <td>{c.plan}</td>
                  {!enHold() && (
                    <td className="num">
                      {/* Saldo a favor y por pagar son cosas distintas (uno
                          es lo que el cliente tiene, el otro lo que debe):
                          fundir la columna no es promediarlas ni restarlas,
                          es mostrar las dos apiladas en el mismo espacio. */}
                      <div>{pesos(c.saldo)}</div>
                      {c.porPagar > 0 && (
                        <div className="pt-mov cargo" style={{ fontSize: "0.76rem" }}>
                          {pesos(c.porPagar)} por pagar
                        </div>
                      )}
                    </td>
                  )}
                  <td>
                    {(() => {
                      // `title` es la unica pista visible de QUE le falta a
                      // un pendiente: sin esto, "Pendiente" (o el texto
                      // largo) no dice si es el correo, el telefono o el
                      // contacto, y Morcast tendria que ir a buscarlo a
                      // mano.
                      const et = etiquetaEstado(c.estatus);
                      const corto = ETIQUETA_CORTA_TABLA[c.estatus] || et.texto;
                      const falta = loQueFalta(c);
                      const piezas = [];
                      // Si se acorto, el texto completo tambien va al
                      // tooltip -- si no, ya se ve entero en la insignia.
                      if (corto !== et.texto) piezas.push(et.texto);
                      if (falta.length) piezas.push(`Falta: ${falta.join(", ")}`);
                      return (
                        <span className={`pt-badge ${et.clase}`} title={piezas.join(" — ")}>
                          {corto}
                        </span>
                      );
                    })()}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{fechaLarga(c.desde)}</td>
                  <td style={{ textAlign: "center" }}>
                    {(() => {
                      const a = accesos[c.uuid] || {};
                      if (a.enviado || c.tieneAcceso) {
                        return (
                          <span className="pt-tabla-icono-estado" title="Ya tiene acceso al portal">
                            <CheckCircle />
                          </span>
                        );
                      }
                      // `puedeRecibirAcceso()` es la MISMA regla que usa el
                      // servidor (estado-cliente.mjs): si aquí se pintara
                      // habilitado un botón que el servidor va a rechazar,
                      // el cliente vería un error sin explicación.
                      const evaluado = puedeRecibirAcceso(c);
                      const titulo = evaluado.puede
                        ? (a.enviando ? "Enviando…" : `Dar acceso al portal a ${c.empresa}`)
                        : MOTIVO_TEXTO[evaluado.motivo];
                      return (
                        <>
                          <button
                            type="button"
                            className="pt-tabla-icono-btn"
                            disabled={!evaluado.puede || a.enviando}
                            title={titulo}
                            aria-label={titulo}
                            onClick={() => darAcceso(c)}
                          >
                            <Key />
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
