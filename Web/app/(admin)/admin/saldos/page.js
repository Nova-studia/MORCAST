"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FiDollarSign, FiClock, FiCheckCircle, FiEye, FiX, FiLock, FiShield, FiFileText, FiAlertCircle,
} from "react-icons/fi";
import { ADMIN_PERFIL } from "@/lib/admin-datos";
import { listarClientes, listarMovimientos } from "@/lib/datos-clientes";
import { resolverDepositoAuditado } from "@/app/acciones-auditadas";
import { RECARGAS_SEED, estadoRecarga } from "@/lib/recargas-datos";
import { obtenerSesionAdmin } from "@/lib/admin-sesion";
import { haySupabaseNavegador } from "@/lib/supabase-navegador";
import { pesos, fechaLarga } from "@/lib/portal-datos";

export default function SaldosAdmin() {
  const [recargas, setRecargas] = useState([]);
  const [clientes, setClientes] = useState([]);

  // Los depositos reportados son los movimientos de tipo abono: el cliente
  // sube su comprobante y aqui se verifican.
  const recargar = () =>
    Promise.all([listarMovimientos(), listarClientes()]).then(([m, c]) => {
      setRecargas(m.filter((x) => x.tipo === "abono"));
      setClientes(c);
    });

  useEffect(() => {
    let vivo = true;
    recargar().then(() => { if (!vivo) return; });
    return () => { vivo = false; };
  }, []);
  const [ver, setVer] = useState(null);      // recarga cuyo comprobante se previsualiza
  const [rechazando, setRechazando] = useState(null);
  const [errorAccion, setErrorAccion] = useState(null);
  const [yo, setYo] = useState(null);        // quién entró de verdad

  useEffect(() => {
    let vivo = true;
    obtenerSesionAdmin().then((s) => { if (vivo) setYo(s); });
    return () => { vivo = false; };
  }, []);

  // ¿Quién puede aplicar saldo? El dueño y los administradores. No se decide
  // aquí: esto solo pinta el botón. La regla de verdad vive en el RLS y en
  // `resolverDepositoAuditado`, que exige el rol y cuenta las filas.
  //
  // Antes esta pantalla traía un selector con seis compañeros inventados y
  // decía "Sesión actual: Ing. Ramón Cázares" aunque hubiera entrado el
  // dueño. Nombraba gente que no existe y mentía sobre quién estaba dentro.
  const perfil = yo || (haySupabaseNavegador() ? null : ADMIN_PERFIL);
  const puedeVerificar = haySupabaseNavegador()
    ? ["dueno", "admin"].includes(yo?.rolId)
    : true;

  const porVerificar = recargas.filter((r) => r.estado === "por-verificar");
  const totalAFavor = useMemo(() => clientes.reduce((s, c) => s + (c.saldo || 0), 0), [clientes]);
  const totalPorCobrar = useMemo(() => clientes.reduce((s, c) => s + (c.porPagar || 0), 0), [clientes]);

  // Se guarda y se vuelve a leer todo. Aqui se esta moviendo dinero: es
  // preferible una recarga de datos de mas que un saldo pintado en pantalla
  // que la base no confirmo. El saldo lo recalcula la base sumando los
  // movimientos, no lo sumamos aqui.
  // Si falla, hay que DECIRLO. Antes se hacía `if (!r.ok) return;` y la
  // pantalla se quedaba igual: quien aplicaba un depósito no sabía si había
  // pasado o no. En dinero, callarse un fallo es lo peor que se puede hacer.
  const resolver = async (rec, estado) => {
    if (!puedeVerificar) return;
    setErrorAccion(null);
    const r = await resolverDepositoAuditado(rec.id, estado);
    if (!r.ok) {
      setErrorAccion(r.motivo || "No se pudo guardar. Intenta de nuevo.");
      return;
    }
    await recargar();
    setRechazando(null);
    setVer(null);
  };

  const aplicar = (rec) => resolver(rec, "aplicada");
  const rechazar = (rec) => resolver(rec, "rechazada");

  return (
    <>
      <div className="pt-page-head">
        <h1>Saldos de clientes</h1>
        <p>Verifica los comprobantes de pago y aplica el saldo a la cuenta de cada cliente.</p>
      </div>

      {errorAccion && (
        <div className="pt-login-error" role="alert" style={{ marginBottom: "1rem" }}>
          <FiAlertCircle style={{ marginRight: 6, verticalAlign: "-2px" }} />
          {errorAccion}
        </div>
      )}

      {/* KPIs */}
      <div className="pt-grid pt-grid-3" style={{ marginBottom: "1.1rem" }}>
        <div className="pt-stat">
          <div className="pt-stat-icono"><FiDollarSign /></div>
          <div className="pt-stat-etiqueta">Saldo a favor (total)</div>
          <div className="pt-stat-valor">{pesos(totalAFavor)}</div>
        </div>
        <div className="pt-stat">
          <div className="pt-stat-icono naranja"><FiAlertCircle /></div>
          <div className="pt-stat-etiqueta">Por cobrar (total)</div>
          <div className="pt-stat-valor">{pesos(totalPorCobrar)}</div>
        </div>
        <div className="pt-stat">
          <div className="pt-stat-icono teal"><FiClock /></div>
          <div className="pt-stat-etiqueta">Recargas por verificar</div>
          <div className="pt-stat-valor">{porVerificar.length}</div>
        </div>
      </div>

      {/* Quién puede aplicar saldo */}
      <div className="pt-card" style={{ marginBottom: "1.1rem" }}>
        <div className="pt-card-head"><h2>Quién puede aplicar saldo</h2></div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div className="pt-stat-icono teal" style={{ margin: 0, width: 40, height: 40 }}><FiShield /></div>
          <div style={{ flex: "1 1 260px" }}>
            <p style={{ margin: 0, color: "var(--mc-gris)", fontSize: "0.85rem" }}>
              Confirmar que un pago llegó y aplicarlo al saldo lo puede hacer el dueño
              y quien tenga rol de administrador. Cada aplicación queda registrada en
              la bitácora con el nombre de quien la hizo y la hora.
            </p>
          </div>
          <div style={{ textAlign: "right", flex: "0 1 auto" }}>
            <span style={{ color: "var(--mc-gris)", fontSize: "0.8rem" }}>Estás dentro como</span>
            <div style={{ fontWeight: 700 }}>{perfil?.nombre || "—"}</div>
            <div style={{ color: "var(--mc-gris)", fontSize: "0.8rem" }}>{perfil?.rol || ""}</div>
          </div>
        </div>
        {!puedeVerificar && (
          <p className="pt-nota-demo" style={{ marginTop: "0.9rem" }}>
            <FiLock /> Tu cuenta puede consultar las recargas y los comprobantes, pero no aplicar saldo.
          </p>
        )}
      </div>

      {/* Recargas por verificar */}
      <div className="pt-card" style={{ marginBottom: "1.1rem" }}>
        <div className="pt-card-head"><h2>Recargas por verificar ({porVerificar.length})</h2></div>
        {porVerificar.length === 0 ? (
          <div className="pt-vacio">No hay recargas pendientes de verificar.</div>
        ) : (
          <div className="pt-tabla-wrap">
            <table className="pt-tabla" style={{ minWidth: 820 }}>
              <thead>
                <tr>
                  <th>Folio</th><th>Fecha</th><th>Cliente</th><th>Banco</th>
                  <th>Referencia</th><th className="num">Monto</th><th>Comprobante</th><th></th>
                </tr>
              </thead>
              <tbody>
                {porVerificar.map((r) => (
                  <tr key={r.id}>
                    <td className="folio">{r.id}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{fechaLarga(r.fecha)}</td>
                    <td>{r.cliente}</td>
                    <td>{r.banco}</td>
                    <td>{r.referencia}</td>
                    <td className="num"><strong>{pesos(r.monto)}</strong></td>
                    <td>
                      <button className="pt-btn" onClick={() => setVer(r)}><FiEye /> Ver</button>
                    </td>
                    <td>
                      <button
                        className="pt-btn pt-btn-verde"
                        disabled={!puedeVerificar}
                        style={{ opacity: puedeVerificar ? 1 : 0.5 }}
                        onClick={() => setVer(r)}
                        title={puedeVerificar ? "Revisar y aplicar" : "Solo el responsable puede aplicar"}
                      >
                        {puedeVerificar ? "Revisar" : <FiLock />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Saldos de clientes */}
      <div className="pt-card">
        <div className="pt-card-head"><h2>Saldo por cliente</h2></div>
        <div className="pt-tabla-wrap">
          <table className="pt-tabla" style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th>Cliente</th><th>Contacto</th><th>Plan</th>
                <th className="num">Saldo a favor</th><th className="num">Por pagar</th><th>Estatus</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.empresa}</strong><div style={{ color: "var(--mc-gris)", fontSize: "0.78rem" }}>{c.id}</div></td>
                  <td>{c.contacto}</td>
                  <td>{c.plan}</td>
                  <td className="num"><span className="pt-mov abono">{pesos(c.saldo)}</span></td>
                  <td className="num">{c.porPagar ? pesos(c.porPagar) : "—"}</td>
                  <td><span className={`pt-badge ${c.estatus === "activo" ? "ok" : ""}`}>{c.estatus === "activo" ? "Activo" : "Moroso"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de comprobante */}
      {ver && (
        <div className="pt-modal-fondo" onClick={() => { setVer(null); setRechazando(null); }}>
          <div className="pt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pt-modal-head">
              <div>
                <strong>{ver.cliente}</strong>
                <span>{ver.id} · {fechaLarga(ver.fecha)}</span>
              </div>
              <button className="pt-btn" onClick={() => { setVer(null); setRechazando(null); }} aria-label="Cerrar"><FiX /></button>
            </div>
            <div className="pt-modal-cuerpo">
              <div className="pt-modal-comprobante">
                {ver.comprobante ? (
                  <img src={ver.comprobante} alt="Comprobante de pago" />
                ) : (
                  <div className="pt-modal-sinimg"><FiFileText /><span>{ver.comprobanteNombre || "Comprobante adjunto"}</span></div>
                )}
              </div>
              <div className="pt-modal-datos">
                <div className="pt-modal-monto">{pesos(ver.monto)}</div>
                <dl>
                  <dt>Banco</dt><dd>{ver.banco}</dd>
                  <dt>Referencia</dt><dd>{ver.referencia}</dd>
                  <dt>Archivo</dt><dd>{ver.comprobanteNombre || "—"}</dd>
                  <dt>Estado</dt><dd><span className={`pt-badge ${estadoRecarga(ver.estado).clase}`}>{estadoRecarga(ver.estado).texto}</span></dd>
                </dl>

                <p style={{ color: "var(--mc-gris)", fontSize: "0.82rem" }}>
                  Confirma en el estado de cuenta de Morcast que el depósito por <strong>{pesos(ver.monto)}</strong> se recibió antes de aplicar el saldo.
                </p>

                {puedeVerificar ? (
                  rechazando === ver.id ? (
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button className="pt-btn" onClick={() => setRechazando(null)}>Cancelar</button>
                      <button className="pt-btn" style={{ background: "#5a1f1f", color: "#ffb4b4", borderColor: "#7a2a2a" }} onClick={() => rechazar(ver)}>
                        Confirmar rechazo
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button className="pt-btn pt-btn-verde" style={{ flex: 1, justifyContent: "center" }} onClick={() => aplicar(ver)}>
                        <FiCheckCircle /> Verificado — aplicar {pesos(ver.monto)}
                      </button>
                      <button className="pt-btn" onClick={() => setRechazando(ver.id)}>Rechazar</button>
                    </div>
                  )
                ) : (
                  <p className="pt-nota-demo"><FiLock /> Tu cuenta no puede aplicar saldo. Pídeselo al dueño o a un administrador.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
