"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, WarningCircle, WhatsappLogo, Trash, MapPin } from "@phosphor-icons/react/dist/ssr";
import MiCuenta from "@/components/cuenta/MiCuenta";
import TarjetaSoporte from "@/components/portal/TarjetaSoporte";
import { cuentaClienteAccion, guardarDatosClienteAccion, eliminarMiCuentaAccion } from "@/app/acciones-cuenta-cliente";
import { cerrarSesion } from "@/lib/portal-sesion";
import { enlaceWhatsApp } from "@/lib/datos";
import { mensajeCambioFiscal, CONFIRMAR_ELIMINAR, confirmaEliminar } from "@/lib/cuenta-cliente.mjs";

/**
 * MI CUENTA DEL PORTAL (Entrega 4, 9-oct-2026).
 *
 *   · Mis datos y contraseña: lo mismo que el personal (MiCuenta).
 *   · Los datos de contacto de la empresa (correo de avisos incluido).
 *   · Sus puntos, solo para verlos.
 *   · Razón social / RFC: se piden a Morcast por WhatsApp.
 *   · Eliminar MI cuenta (el mismo trámite que la app): borra al usuario,
 *     nunca a la empresa ni su historial.
 */
function Aviso({ aviso }) {
  if (!aviso) return null;
  return aviso.tipo === "ok" ? (
    <div className="pt-activar-ok" role="status" style={{ marginBottom: "1rem" }}><CheckCircle /> {aviso.texto}</div>
  ) : (
    <div className="pt-login-error" role="alert" style={{ marginBottom: "1rem" }}>
      <WarningCircle style={{ marginRight: 6, verticalAlign: "-2px" }} /> {aviso.texto}
    </div>
  );
}

export default function CuentaPortal() {
  const router = useRouter();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ contacto: "", telefono: "", correo: "" });
  const [aviso, setAviso] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [borrar, setBorrar] = useState("");
  const [avisoBorrar, setAvisoBorrar] = useState(null);
  const [borrando, setBorrando] = useState(false);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vivo = true;
    setError("");
    cuentaClienteAccion()
      .then((r) => {
        if (!vivo) return;
        if (!r.ok) { setError(r.motivo || "No se pudo cargar tu cuenta."); return; }
        setDatos(r);
        setForm({ contacto: r.empresa.contacto || "", telefono: r.empresa.telefono || "", correo: r.empresa.correo || "" });
      })
      .catch(() => vivo && setError("No se pudo cargar tu cuenta. Revisa tu conexión."));
    return () => { vivo = false; };
  }, [intento]);

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setAviso(null);
    const r = await guardarDatosClienteAccion(form);
    setGuardando(false);
    setAviso(r.ok ? { tipo: "ok", texto: "Guardado. Los avisos te llegarán a ese correo." } : { tipo: "error", texto: r.motivo || "No se guardó." });
  };

  const eliminar = async () => {
    setBorrando(true);
    setAvisoBorrar(null);
    const r = await eliminarMiCuentaAccion({ confirmacion: borrar });
    if (!r.ok) {
      setBorrando(false);
      setAvisoBorrar({ tipo: "error", texto: r.motivo || "No se pudo eliminar." });
      return;
    }
    await cerrarSesion().catch(() => {});
    router.replace("/portal/login?error=cuenta_eliminada");
  };

  const empresa = datos?.empresa;

  return (
    <>
      <MiCuenta />

      {error && (
        <div className="pt-login-error" role="alert" style={{ margin: "1.1rem 0" }}>
          {error}{" "}
          <button type="button" className="pt-btn" onClick={() => setIntento((n) => n + 1)}>Reintentar</button>
        </div>
      )}

      {empresa && (
        <div className="pt-grid pt-grid-2" style={{ gap: "1.1rem", alignItems: "start", marginTop: "1.1rem" }}>
          <div className="pt-card">
            <div className="pt-card-head"><h2>Datos de contacto de {empresa.empresa}</h2></div>
            <Aviso aviso={aviso} />
            <form onSubmit={guardar}>
              <div className="pt-campo">
                <label htmlFor="cc-contacto">Persona de contacto</label>
                <input id="cc-contacto" className="pt-input" value={form.contacto} onChange={(e) => setForm({ ...form, contacto: e.target.value })} />
              </div>
              <div className="pt-campo">
                <label htmlFor="cc-telefono">Teléfono (10 dígitos)</label>
                <input id="cc-telefono" className="pt-input" inputMode="tel" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
              </div>
              <div className="pt-campo">
                <label htmlFor="cc-correo">Correo para avisos</label>
                <input id="cc-correo" className="pt-input" type="email" required value={form.correo} onChange={(e) => setForm({ ...form, correo: e.target.value })} />
              </div>
              <button type="submit" className="pt-btn pt-btn-verde" disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</button>
            </form>
            <div style={{ borderTop: "1px solid var(--mc-linea)", marginTop: "1rem", paddingTop: "0.9rem", fontSize: "0.86rem", color: "var(--mc-gris)" }}>
              Razón social: <strong style={{ color: "var(--mc-tinta)" }}>{empresa.empresa}</strong>
              {" · "}RFC: <strong style={{ color: "var(--mc-tinta)" }}>{empresa.rfc || "—"}</strong>
              <div style={{ marginTop: "0.6rem" }}>
                <a className="pt-btn" href={enlaceWhatsApp(mensajeCambioFiscal(empresa))} target="_blank" rel="noopener noreferrer">
                  <WhatsappLogo /> Pedir un cambio de razón social o RFC
                </a>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: "1.1rem" }}>
            <div className="pt-card">
              <div className="pt-card-head"><h2>Mis puntos de recolección</h2></div>
              {datos.puntos.length === 0 ? (
                <p style={{ color: "var(--mc-gris)", fontSize: "0.88rem" }}>Todavía no tienes puntos registrados.</p>
              ) : (
                datos.puntos.map((p) => (
                  <div key={p.id} style={{ display: "flex", gap: "0.6rem", padding: "0.55rem 0", borderBottom: "1px solid var(--mc-linea)" }}>
                    <MapPin aria-hidden="true" style={{ flexShrink: 0, marginTop: 3 }} />
                    <div>
                      <strong>{p.alias}</strong>
                      <div style={{ fontSize: "0.82rem", color: "var(--mc-gris)" }}>{p.direccion || "Sin dirección"}</div>
                      <div style={{ fontSize: "0.82rem", color: "var(--mc-gris)" }}>
                        {p.ruta ? `${p.ruta}${p.dias.length ? ` · pasa ${p.dias.join(", ")}` : ""}${p.pausado ? " · en pausa" : ""}` : "Sin ruta asignada"}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <TarjetaSoporte empresa={empresa.empresa} folio={empresa.folio} />
          </div>
        </div>
      )}

      {empresa && (
        <div className="pt-card" style={{ marginTop: "1.1rem", borderColor: "#b3261e55" }}>
          <div className="pt-card-head"><h2>Eliminar mi cuenta</h2></div>
          <p style={{ fontSize: "0.88rem", color: "var(--mc-gris)", marginTop: 0 }}>
            Se borra tu usuario y ya no podrás entrar. El historial y los documentos de {empresa.empresa} se conservan,
            y Morcast los guarda como lo pide la ley. Escribe <strong>{CONFIRMAR_ELIMINAR}</strong> para confirmar.
          </p>
          <Aviso aviso={avisoBorrar} />
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            <input className="pt-input" value={borrar} onChange={(e) => setBorrar(e.target.value)} placeholder={CONFIRMAR_ELIMINAR} style={{ maxWidth: 220 }} aria-label="Confirmación" />
            <button type="button" className="pt-btn" style={{ color: "#b3261e" }} disabled={!confirmaEliminar(borrar) || borrando} onClick={eliminar}>
              <Trash /> {borrando ? "Eliminando…" : "Eliminar mi cuenta"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
