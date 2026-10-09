"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "@phosphor-icons/react/dist/ssr";
import { listarClientesParaAvisos } from "@/lib/datos-avisos";
import { puntosDeCliente } from "@/lib/datos-solicitudes";
import { TIPOS_RESIDUO } from "@/lib/cotizar-whatsapp";
import { hoyISO } from "@/lib/vencimiento";
import { crearRecoleccionOficinaAccion } from "@/app/acciones-auditadas";

/**
 * "NUEVA RECOLECCIÓN" DE LA OFICINA (Entrega 3, 9-oct-2026).
 *
 * Para los pedidos por teléfono o WhatsApp: cliente → punto → fecha →
 * residuo → nota. Nace "solicitada", o ya "confirmada" con hora y chofer si
 * la oficina la programa de una vez (entonces se avisa al cliente y al chofer
 * igual que con "Confirmar"). Las reglas viven en lib/recoleccion-nueva.mjs.
 */
const VACIO = { clienteId: "", domicilioId: "", fecha: "", tipoResiduo: "", nota: "", origen: "extra", confirmar: false, hora: "", choferId: "" };
const normal = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function NuevaRecoleccion({ choferes = [], onCerrar, onCreada }) {
  const [form, setForm] = useState(VACIO);
  const [clientes, setClientes] = useState([]);
  const [buscar, setBuscar] = useState("");
  const [puntos, setPuntos] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const pon = (patch) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    listarClientesParaAvisos().then((cs) => setClientes((cs || []).filter((c) => c.estado !== "baja")));
  }, []);

  useEffect(() => {
    let vivo = true;
    setPuntos([]);
    if (!form.clienteId) return;
    puntosDeCliente(form.clienteId).then((ps) => {
      if (!vivo) return;
      setPuntos(ps);
      // Con un solo punto, ya está escogido.
      if (ps.length === 1) pon({ domicilioId: ps[0].id });
    });
    return () => { vivo = false; };
  }, [form.clienteId]);

  const encontrados = useMemo(() => {
    const q = normal(buscar).trim();
    const lista = q ? clientes.filter((c) => normal(`${c.empresa} ${c.folio || ""}`).includes(q)) : clientes;
    return lista.slice(0, 50);
  }, [buscar, clientes]);
  const cliente = clientes.find((c) => c.id === form.clienteId) || null;

  const crear = async (e) => {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setError("");
    const r = await crearRecoleccionOficinaAccion(form);
    setEnviando(false);
    if (!r.ok) { setError(r.motivo || "No se pudo crear."); return; }
    onCreada?.(r);
  };

  const etiqueta = { display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: 4 };

  return (
    <div className="pt-card" style={{ marginBottom: "1.1rem" }}>
      <div className="pt-card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Nueva recolección</h2>
        <button type="button" className="pt-btn" onClick={onCerrar} aria-label="Cerrar"><X /></button>
      </div>
      {error && <div className="pt-login-error" role="alert" style={{ marginBottom: "0.9rem" }}>{error}</div>}
      <form onSubmit={crear}>
        <div className="pt-grid pt-grid-2" style={{ gap: "0.8rem", marginBottom: "0.9rem" }}>
          <div>
            <label htmlFor="nr-cliente" style={etiqueta}>Cliente</label>
            {cliente ? (
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <strong style={{ flex: 1 }}>{cliente.empresa}</strong>
                <button type="button" className="pt-btn" onClick={() => { pon({ clienteId: "", domicilioId: "" }); setBuscar(""); }}>Cambiar</button>
              </div>
            ) : (
              <>
                <input id="nr-cliente" className="pt-input" value={buscar} onChange={(e) => setBuscar(e.target.value)}
                  placeholder="Busca por empresa o folio" autoComplete="off" style={{ width: "100%" }} />
                <div style={{ border: "1px solid var(--mc-linea)", borderRadius: 10, marginTop: 4, maxHeight: 200, overflowY: "auto" }}>
                  {encontrados.map((c) => (
                    <button key={c.id} type="button" onClick={() => pon({ clienteId: c.id, domicilioId: "" })}
                      style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: 0, borderBottom: "1px solid var(--mc-linea)", padding: "0.5rem 0.7rem", color: "var(--mc-tinta)", cursor: "pointer" }}>
                      {c.empresa} <span style={{ color: "var(--mc-gris)", fontSize: "0.78rem" }}>{[c.folio, c.estado !== "activo" ? c.estado : null].filter(Boolean).join(" · ")}</span>
                    </button>
                  ))}
                  {!encontrados.length && <div style={{ padding: "0.6rem", color: "var(--mc-gris)", fontSize: "0.85rem" }}>Ningún cliente.</div>}
                </div>
              </>
            )}
          </div>
          <div>
            <label htmlFor="nr-punto" style={etiqueta}>Punto de recolección</label>
            <select id="nr-punto" className="pt-input" value={form.domicilioId} disabled={!form.clienteId}
              onChange={(e) => pon({ domicilioId: e.target.value })} style={{ width: "100%" }}>
              <option value="">{form.clienteId ? (puntos.length ? "Elige el punto" : "Este cliente no tiene puntos") : "Primero elige el cliente"}</option>
              {puntos.map((p) => <option key={p.id} value={p.id}>{p.texto}{p.ruta ? ` — ${p.ruta}` : " — sin ruta"}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="nr-fecha" style={etiqueta}>Fecha</label>
            <input id="nr-fecha" type="date" className="pt-input" min={hoyISO()} value={form.fecha}
              onChange={(e) => pon({ fecha: e.target.value })} style={{ width: "100%" }} />
          </div>
          <div>
            <label htmlFor="nr-tipo" style={etiqueta}>Tipo de residuo</label>
            <select id="nr-tipo" className="pt-input" value={form.tipoResiduo} onChange={(e) => pon({ tipoResiduo: e.target.value })} style={{ width: "100%" }}>
              <option value="" disabled>Elige qué se va a recoger</option>
              {TIPOS_RESIDUO.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: "0.86rem", marginBottom: "0.7rem" }}>
          <label><input type="radio" name="nr-origen" checked={form.origen === "extra"} onChange={() => pon({ origen: "extra" })} /> Recolección extra</label>
          <label><input type="radio" name="nr-origen" checked={form.origen === "ruta"} onChange={() => pon({ origen: "ruta" })} /> Día de su ruta</label>
        </div>
        <textarea className="pt-input" rows={2} placeholder={form.tipoResiduo === "Otro" ? "Describe el residuo (obligatorio con «Otro»)" : "Nota para el chofer (opcional)"}
          value={form.nota} onChange={(e) => pon({ nota: e.target.value })} style={{ width: "100%", marginBottom: "0.8rem" }} />

        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.88rem", marginBottom: "0.6rem" }}>
          <input type="checkbox" checked={form.confirmar} onChange={(e) => pon({ confirmar: e.target.checked })} />
          Confirmarla ya (se avisa al cliente y al chofer)
        </label>
        {form.confirmar && (
          <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap", marginBottom: "0.8rem" }}>
            <label style={{ fontSize: "0.8rem", color: "var(--mc-gris)" }}>
              Hora (opcional)
              <input type="time" className="pt-input" value={form.hora} onChange={(e) => pon({ hora: e.target.value })} style={{ display: "block", marginTop: 4 }} />
            </label>
            <label style={{ fontSize: "0.8rem", color: "var(--mc-gris)" }}>
              Chofer
              <select className="pt-input" value={form.choferId} onChange={(e) => pon({ choferId: e.target.value })} style={{ display: "block", marginTop: 4, minWidth: 200 }}>
                <option value="">El de la ruta</option>
                {choferes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </label>
          </div>
        )}
        <button type="submit" className="pt-btn pt-btn-verde" disabled={enviando}>
          {enviando ? "Creando…" : form.confirmar ? "Crear y confirmar" : "Crear solicitud"}
        </button>
      </form>
    </div>
  );
}
