"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  PaperPlaneTilt,
  MagnifyingGlass,
  X,
  CheckCircle,
  WarningCircle,
  ArrowLeft,
  Users,
} from "@phosphor-icons/react/dist/ssr";
import { TarjetaAviso } from "@/components/AvisosCliente";
import {
  listarSectores,
  listarRutasParaAvisos,
  listarClientesParaAvisos,
  listarAvisos,
  vistaPreviaDestinatarios,
  mandarAviso,
} from "@/lib/datos-avisos";
import {
  ALCANCES_AVISO,
  MOTIVOS_AVISO,
  MAX_TITULO,
  MAX_MENSAJE,
  validarAviso,
  fraseResumen,
  textoAlcance,
  textoMotivo,
  borradorRetraso,
  hoyMatamoros,
} from "@/lib/avisos.mjs";
import { fechaHora } from "../incidentes/bandeja.mjs";

/**
 * El formulario y el historial de los avisos a clientes.
 *
 * Pedido de los dueños (4-oct-2026): avisar por sector, ruta o a un cliente
 * en específico cuando hay un retraso o se reagenda — por correo y en el
 * portal, sin WhatsApp.
 *
 * Dos decisiones de la pantalla:
 *  · ANTES de mandar se enseña a cuántas empresas y correos les llega, y
 *    cuántas no tienen correo (esas solo lo verán en su portal). Un aviso
 *    masivo no se puede "desmandar": la cifra es el último freno.
 *  · Mandar pide una segunda confirmación con esa misma cifra a la vista.
 */

const ETIQUETA = { display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" };

/** Para buscar "vidrieria" y encontrar "Vidriera": sin acentos ni mayúsculas. */
const normal = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const FORM_VACIO = {
  alcance: "todos",
  sectorId: "",
  rutaId: "",
  clienteId: "",
  motivo: "general",
  titulo: "",
  mensaje: "",
  vigenteHasta: "",
};

export default function PantallaAvisos() {
  const params = useSearchParams();
  const [sectores, setSectores] = useState([]);
  const [rutas, setRutas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [cargandoHist, setCargandoHist] = useState(true);
  const [form, setForm] = useState(FORM_VACIO);
  const [busqueda, setBusqueda] = useState("");
  const [vista, setVista] = useState({ cargando: false, resumen: null, motivo: "" });
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState(null);
  const prellenado = useRef(false);
  const hoy = hoyMatamoros();

  const cambia = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    // Cualquier cambio invalida la confirmación: la cifra que se confirmó ya
    // no es la del aviso que se mandaría.
    setConfirmando(false);
    setError("");
  };

  useEffect(() => {
    let vivo = true;
    Promise.allSettled([listarSectores(), listarRutasParaAvisos(), listarClientesParaAvisos()]).then(([s, r, c]) => {
      if (!vivo) return;
      if (s.status === "fulfilled") setSectores(s.value);
      if (r.status === "fulfilled") setRutas(r.value);
      if (c.status === "fulfilled") setClientes(c.value);
    });
    listarAvisos().then((h) => {
      if (!vivo) return;
      setHistorial(h);
      setCargandoHist(false);
    });
    return () => { vivo = false; };
  }, []);

  /**
   * Prellenado desde un incidente de retraso ("Avisar a los clientes de esta
   * ruta"). Espera a que lleguen las rutas para poder nombrarla en el
   * borrador, y se aplica UNA vez: si el admin ya empezó a corregir el texto,
   * no se le pisa al terminar de cargar algo más.
   */
  useEffect(() => {
    if (prellenado.current) return;
    const alcance = params.get("alcance");
    const motivo = params.get("motivo");
    if (!alcance && !motivo) {
      prellenado.current = true;
      return;
    }
    const rutaId = params.get("ruta") || "";
    if (rutaId && !rutas.length) return; // todavía no llegan las rutas
    prellenado.current = true;
    const ruta = rutas.find((r) => r.id === rutaId);
    const borrador = motivo === "retraso" ? borradorRetraso({ rutaNombre: ruta?.nombre, minutos: params.get("minutos") }) : {};
    setForm((f) => ({
      ...f,
      alcance: ALCANCES_AVISO.some((a) => a.id === alcance) ? alcance : f.alcance,
      rutaId: rutaId || f.rutaId,
      motivo: MOTIVOS_AVISO.some((m) => m.id === motivo) ? motivo : f.motivo,
      ...borrador,
    }));
  }, [params, rutas]);

  // ¿A cuántos les llega? Se recalcula al cambiar el destino, con una pausa
  // corta para no pedirlo en cada tecla del buscador.
  const idDestino = { sector: form.sectorId, ruta: form.rutaId, cliente: form.clienteId }[form.alcance] || "";
  useEffect(() => {
    let vivo = true;
    if (form.alcance !== "todos" && !idDestino) {
      setVista({ cargando: false, resumen: null, motivo: "" });
      return;
    }
    setVista((v) => ({ ...v, cargando: true }));
    const t = setTimeout(() => {
      vistaPreviaDestinatarios({
        alcance: form.alcance,
        sectorId: form.sectorId,
        rutaId: form.rutaId,
        clienteId: form.clienteId,
      }).then((r) => {
        if (!vivo) return;
        setVista(r?.ok ? { cargando: false, resumen: r.resumen, motivo: "" } : { cargando: false, resumen: null, motivo: r?.motivo || "" });
      });
    }, 250);
    return () => { vivo = false; clearTimeout(t); };
  }, [form.alcance, form.sectorId, form.rutaId, form.clienteId, idDestino]);

  const clienteElegido = clientes.find((c) => c.id === form.clienteId) || null;
  const coincidencias = useMemo(() => {
    const q = normal(busqueda).trim();
    if (!q) return [];
    return clientes
      .filter((c) => normal(`${c.empresa} ${c.folio || ""} ${c.correo || ""}`).includes(q))
      .slice(0, 8);
  }, [busqueda, clientes]);

  // En el selector van las activas, más la que llegó prellenada aunque esté
  // inactiva: si no, el select se quedaría en blanco sin decir por qué.
  const rutasVisibles = rutas.filter((r) => r.activa !== false || r.id === form.rutaId);

  /** Primer clic: valida y enseña la confirmación con la cifra. */
  const revisar = () => {
    const v = validarAviso(form, { hoy });
    if (!v.ok) {
      setError(v.motivo);
      return;
    }
    if (vista.resumen && vista.resumen.clientes === 0) {
      setError("Ningún cliente cae en este alcance. Elige otro destino.");
      return;
    }
    setError("");
    setResultado(null);
    setConfirmando(true);
  };

  /** Segundo clic: manda de verdad. */
  const enviar = async () => {
    setEnviando(true);
    setError("");
    const r = await mandarAviso(form);
    setEnviando(false);
    setConfirmando(false);
    if (!r?.ok) {
      setError(r?.motivo || "No se pudo mandar el aviso. Vuelve a intentarlo.");
      return;
    }
    setResultado(r);
    // Se agrega arriba del historial con los nombres que ya tiene la
    // pantalla, sin volver a pedir toda la lista.
    const sector = sectores.find((s) => s.id === form.sectorId);
    const ruta = rutas.find((x) => x.id === form.rutaId);
    setHistorial((h) => [
      {
        id: r.id,
        titulo: form.titulo.replace(/\s+/g, " ").trim(),
        mensaje: form.mensaje,
        motivo: form.motivo,
        alcance: form.alcance,
        vigente_hasta: form.vigenteHasta || null,
        correos_enviados: r.enviados ?? 0,
        creado: r.creado || new Date().toISOString(),
        sectores: form.alcance === "sector" && sector ? { nombre: sector.nombre } : null,
        rutas: form.alcance === "ruta" && ruta ? { nombre: ruta.nombre } : null,
        clientes: form.alcance === "cliente" && clienteElegido ? { empresa: clienteElegido.empresa } : null,
      },
      ...h,
    ]);
    setForm(FORM_VACIO);
    setBusqueda("");
  };

  const delIncidente = params.get("incidente");
  const avisoVistaPrevia = { ...form, vigente_hasta: form.vigenteHasta || null, creado: new Date().toISOString() };

  return (
    <>
      <div className="pt-page-head">
        <h1>Avisos a clientes</h1>
        <p>Retrasos, reagendas o avisos generales. Llegan por correo y se ven arriba del portal de cada cliente.</p>
      </div>

      {delIncidente && (
        <p style={{ margin: "-0.6rem 0 1rem", fontSize: "0.86rem", color: "var(--mc-gris)" }}>
          <Link href="/admin/incidentes" prefetch={false} style={{ color: "var(--pt-accion-txt)" }}>
            <ArrowLeft style={{ verticalAlign: "-2px" }} /> Volver a incidentes
          </Link>
          {" · "}Borrador armado desde un reporte de retraso. Revísalo antes de mandarlo.
        </p>
      )}

      <div className="pt-grid pt-grid-2" style={{ "--pt-cols": "1.15fr 1fr", gap: "1.1rem", alignItems: "start", marginBottom: "1.1rem" }}>
        {/* ---------- Formulario ---------- */}
        <div className="pt-card">
          <div className="pt-card-head"><h2>Nuevo aviso</h2></div>

          <div className="pt-campo">
            <span style={ETIQUETA} id="et-alcance">¿A quién?</span>
            <div className="pt-segmento" role="group" aria-labelledby="et-alcance" style={{ flexWrap: "wrap" }}>
              {ALCANCES_AVISO.map((a) => (
                <button key={a.id} type="button" className={form.alcance === a.id ? "activo" : ""} aria-pressed={form.alcance === a.id} onClick={() => cambia({ alcance: a.id })}>
                  {a.texto}
                </button>
              ))}
            </div>
          </div>

          {form.alcance === "sector" && (
            <div className="pt-campo">
              <span style={ETIQUETA} id="et-sector">Sector</span>
              <div role="group" aria-labelledby="et-sector" style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {sectores.length === 0 && <span style={{ color: "var(--mc-gris)", fontSize: "0.86rem" }}>Cargando sectores…</span>}
                {sectores.map((s) => (
                  <button key={s.id} type="button" className={`pt-chip ${form.sectorId === s.id ? "activo" : ""}`} aria-pressed={form.sectorId === s.id} onClick={() => cambia({ sectorId: s.id })}>
                    {s.nombre}
                  </button>
                ))}
              </div>
              <p style={{ margin: "0.4rem 0 0", fontSize: "0.8rem", color: "var(--mc-gris)" }}>
                Le llega a cada cliente con al menos un punto de recolección en ese sector.
              </p>
            </div>
          )}

          {form.alcance === "ruta" && (
            <div className="pt-campo">
              <label htmlFor="aviso-ruta" style={ETIQUETA}>Ruta</label>
              <select id="aviso-ruta" className="pt-input" value={form.rutaId} onChange={(e) => cambia({ rutaId: e.target.value })}>
                <option value="">Elige una ruta…</option>
                {rutasVisibles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}{r.clave && r.clave !== r.nombre ? ` (${r.clave})` : ""}{r.activa === false ? " · inactiva" : ""}
                  </option>
                ))}
              </select>
              <p style={{ margin: "0.4rem 0 0", fontSize: "0.8rem", color: "var(--mc-gris)" }}>
                Le llega a cada cliente con un servicio activo en esa ruta.
              </p>
            </div>
          )}

          {form.alcance === "cliente" && (
            <div className="pt-campo">
              <label htmlFor="aviso-buscar" style={ETIQUETA}>Cliente</label>
              {clienteElegido ? (
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", border: "1px solid var(--pt-accion-linea)", borderRadius: 10, padding: "0.6rem 0.8rem" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ display: "block", overflowWrap: "anywhere" }}>{clienteElegido.empresa}</strong>
                    <span style={{ color: "var(--mc-gris)", fontSize: "0.8rem", overflowWrap: "anywhere" }}>
                      {clienteElegido.correo || "Sin correo: solo lo verá en su portal"}
                    </span>
                  </div>
                  <button type="button" className="pt-btn" style={{ padding: "0.4rem" }} aria-label="Cambiar de cliente" onClick={() => { cambia({ clienteId: "" }); setBusqueda(""); }}>
                    <X />
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ position: "relative" }}>
                    <MagnifyingGlass aria-hidden="true" style={{ position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)", color: "var(--mc-gris)" }} />
                    <input
                      id="aviso-buscar"
                      className="pt-input"
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      placeholder="Busca por empresa, folio o correo"
                      autoComplete="off"
                      style={{ paddingLeft: "2.3rem" }}
                    />
                  </div>
                  {busqueda.trim() && (
                    <div role="listbox" aria-label="Clientes encontrados" style={{ border: "1px solid var(--mc-linea)", borderRadius: 10, marginTop: "0.4rem", overflow: "hidden" }}>
                      {coincidencias.length === 0 && (
                        <div style={{ padding: "0.7rem 0.8rem", color: "var(--mc-gris)", fontSize: "0.86rem" }}>Ningún cliente con «{busqueda.trim()}».</div>
                      )}
                      {coincidencias.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          role="option"
                          aria-selected={false}
                          onClick={() => cambia({ clienteId: c.id })}
                          style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: 0, borderBottom: "1px solid var(--mc-linea)", padding: "0.6rem 0.8rem", color: "var(--mc-tinta)", cursor: "pointer" }}
                        >
                          <strong style={{ display: "block", fontSize: "0.9rem", fontWeight: 500 }}>{c.empresa}</strong>
                          <span style={{ color: "var(--mc-gris)", fontSize: "0.78rem" }}>
                            {[c.folio, c.correo || "sin correo", c.estado && c.estado !== "activo" ? c.estado : null].filter(Boolean).join(" · ")}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="pt-campo">
            <span style={ETIQUETA} id="et-motivo">Motivo</span>
            <div className="pt-segmento" role="group" aria-labelledby="et-motivo" style={{ flexWrap: "wrap" }}>
              {MOTIVOS_AVISO.map((m) => (
                <button key={m.id} type="button" className={form.motivo === m.id ? "activo" : ""} aria-pressed={form.motivo === m.id} onClick={() => cambia({ motivo: m.id })}>
                  {m.texto}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-campo">
            <label htmlFor="aviso-titulo" style={ETIQUETA}>Título</label>
            <input
              id="aviso-titulo"
              className="pt-input"
              value={form.titulo}
              maxLength={MAX_TITULO}
              onChange={(e) => cambia({ titulo: e.target.value })}
              placeholder="Ej. Retraso en la Ruta Norte"
            />
          </div>

          <div className="pt-campo">
            <label htmlFor="aviso-mensaje" style={ETIQUETA}>Mensaje</label>
            <textarea
              id="aviso-mensaje"
              className="pt-input"
              rows={5}
              value={form.mensaje}
              maxLength={MAX_MENSAJE}
              onChange={(e) => cambia({ mensaje: e.target.value })}
              placeholder="Qué pasa, a quién le afecta y qué tiene que hacer el cliente (si algo)."
              style={{ resize: "vertical" }}
            />
            <div style={{ textAlign: "right", fontSize: "0.75rem", color: "var(--mc-gris)", marginTop: "0.25rem" }}>
              {form.mensaje.length} / {MAX_MENSAJE}
            </div>
          </div>

          <div className="pt-campo">
            <label htmlFor="aviso-vigente" style={ETIQUETA}>
              Vigente hasta <span style={{ fontWeight: 400, color: "var(--mc-gris)" }}>(opcional)</span>
            </label>
            <input
              id="aviso-vigente"
              type="date"
              className="pt-input"
              value={form.vigenteHasta}
              min={hoy}
              onChange={(e) => cambia({ vigenteHasta: e.target.value })}
              style={{ maxWidth: 220 }}
            />
            <p style={{ margin: "0.4rem 0 0", fontSize: "0.8rem", color: "var(--mc-gris)" }}>
              Después de esa fecha deja de verse en el portal. Sin fecha, se ve 30 días.
            </p>
          </div>

          {error && (
            <p role="alert" style={{ display: "flex", gap: "0.4rem", alignItems: "flex-start", color: "var(--pt-error)", fontSize: "0.86rem", margin: "0 0 0.8rem" }}>
              <WarningCircle style={{ flexShrink: 0, marginTop: "0.15rem" }} /> {error}
            </p>
          )}

          {confirmando ? (
            <div style={{ border: "1px solid var(--pt-accion-linea)", background: "var(--pt-accion-tinte)", borderRadius: 10, padding: "0.9rem" }}>
              <p style={{ margin: "0 0 0.7rem", fontSize: "0.9rem" }}>
                Vas a mandar <strong>«{form.titulo.trim()}»</strong>.{" "}
                {vista.resumen ? fraseResumen(vista.resumen) : "Calculando a quién le llega…"} Un aviso mandado no se puede retirar.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                <button type="button" className="pt-btn pt-btn-verde" disabled={enviando} onClick={enviar} style={{ padding: "0.6rem 1rem" }}>
                  <PaperPlaneTilt /> {enviando ? "Mandando… no cierres esta página" : "Sí, mandar el aviso"}
                </button>
                <button type="button" className="pt-btn" disabled={enviando} onClick={() => setConfirmando(false)}>
                  Corregir
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="pt-btn pt-btn-verde" onClick={revisar} style={{ width: "100%", justifyContent: "center", padding: "0.7rem" }}>
              <PaperPlaneTilt /> Revisar y mandar
            </button>
          )}

          {resultado && <Resultado r={resultado} />}
        </div>

        {/* ---------- Vista previa ---------- */}
        <div className="pt-card" style={{ position: "sticky", top: 90 }}>
          <div className="pt-card-head"><h2>Antes de mandar</h2></div>

          <div style={{ display: "flex", gap: "0.7rem", alignItems: "flex-start", marginBottom: "1.1rem" }}>
            <span aria-hidden="true" style={{ display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: 8, background: "var(--pt-accion-tinte)", color: "var(--pt-accion-txt)", flexShrink: 0 }}>
              <Users weight="bold" />
            </span>
            <div aria-live="polite" style={{ fontSize: "0.9rem", lineHeight: 1.5 }}>
              {form.alcance !== "todos" && !idDestino ? (
                <span style={{ color: "var(--mc-gris)" }}>
                  Elige {form.alcance === "sector" ? "el sector" : form.alcance === "ruta" ? "la ruta" : "el cliente"} para ver a cuántos les llega.
                </span>
              ) : vista.cargando ? (
                <span style={{ color: "var(--mc-gris)" }}>Calculando a quién le llega…</span>
              ) : vista.resumen ? (
                <>
                  <Cifras resumen={vista.resumen} />
                  <span style={{ color: "var(--mc-gris)", fontSize: "0.84rem" }}>{fraseResumen(vista.resumen)}</span>
                </>
              ) : (
                <span style={{ color: "var(--pt-error)" }}>{vista.motivo || "No se pudo calcular a quién le llega."}</span>
              )}
            </div>
          </div>

          <span style={{ color: "var(--mc-gris)", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Así lo verá el cliente en su portal
          </span>
          <div style={{ marginTop: "0.5rem" }}>
            <TarjetaAviso aviso={avisoVistaPrevia} />
          </div>
        </div>
      </div>

      {/* ---------- Historial ---------- */}
      <div className="pt-card">
        <div className="pt-card-head"><h2>Avisos enviados</h2></div>
        <div className="pt-tabla-wrap">
          <table className="pt-tabla" style={{ minWidth: 620 }}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>A quién</th>
                <th>Motivo</th>
                <th>Título</th>
                <th className="num">Correos</th>
              </tr>
            </thead>
            <tbody>
              {cargandoHist && <tr><td colSpan={5} className="pt-vacio">Cargando…</td></tr>}
              {!cargandoHist && historial.length === 0 && (
                <tr><td colSpan={5} className="pt-vacio">Todavía no se ha mandado ningún aviso.</td></tr>
              )}
              {historial.map((a) => (
                <tr key={a.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{fechaHora(a.creado)}</td>
                  <td>{textoAlcance(a)}</td>
                  <td><InsigniaMotivo motivo={a.motivo} /></td>
                  <td style={{ maxWidth: 320 }}>
                    <span style={{ display: "block", overflowWrap: "anywhere" }}>{a.titulo}</span>
                    {a.vigente_hasta && <span style={{ color: "var(--mc-gris)", fontSize: "0.78rem" }}>Vigente hasta {a.vigente_hasta.split("-").reverse().join("/")}</span>}
                  </td>
                  <td className="num"><span className="pt-mov">{a.correos_enviados ?? 0}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/** Retraso en ámbar (alerta), reagenda en el azul de "programado", general neutro. */
function InsigniaMotivo({ motivo }) {
  if (motivo === "retraso") {
    return <span className="pt-badge" style={{ background: "var(--pt-alerta-tinte)", color: "var(--pt-alerta)" }}>{textoMotivo(motivo)}</span>;
  }
  return <span className={`pt-badge ${motivo === "reagenda" ? "prog" : ""}`}>{textoMotivo(motivo)}</span>;
}

/** Las tres cifras, grandes y medidas (monoespaciada: son números). */
function Cifras({ resumen }) {
  const cifra = (n, texto, color) => (
    <div>
      <div className="pt-mov" style={{ fontSize: "1.35rem", color: color || "var(--mc-tinta)" }}>{n}</div>
      <div style={{ fontSize: "0.74rem", color: "var(--mc-gris)" }}>{texto}</div>
    </div>
  );
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "1.2rem", marginBottom: "0.4rem" }}>
      {cifra(resumen.clientes, resumen.clientes === 1 ? "cliente" : "clientes")}
      {cifra(resumen.correos, resumen.correos === 1 ? "correo" : "correos")}
      {cifra(resumen.sinCorreo, "sin correo", resumen.sinCorreo ? "var(--pt-alerta)" : undefined)}
    </div>
  );
}

/** Qué pasó al mandar, en palabras: cuántos salieron y a quién hay que llamar. */
function Resultado({ r }) {
  const fallidos = r.fallidos || [];
  const pl = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
  const clientes = pl(r.resumen?.clientes ?? 0, "cliente", "clientes");
  let titulo = "Aviso mandado";
  let detalle;
  if (r.demo) {
    titulo = "Modo prototipo: no se mandó nada";
    detalle = `Con la base conectada se habría guardado para el portal de ${clientes} y ${(r.resumen?.correos ?? 0) === 1 ? "habría salido" : "habrían salido"} ${pl(r.resumen?.correos ?? 0, "correo", "correos")}.`;
  } else if (r.sinResend) {
    detalle = `Ya aparece en el portal de ${clientes}, pero NO salió ningún correo: falta configurar el envío de correos (RESEND_API_KEY).`;
  } else {
    detalle = `Ya aparece en el portal de ${clientes}. Correos enviados: ${r.enviados}.`;
    if (r.resumen?.sinCorreo) detalle += ` Sin correo (solo portal): ${r.resumen.sinCorreo}.`;
  }
  const bien = !r.sinResend && fallidos.length === 0;
  return (
    <div
      role="status"
      style={{
        marginTop: "0.9rem",
        borderRadius: 10,
        padding: "0.8rem 0.9rem",
        fontSize: "0.88rem",
        background: bien ? "var(--pt-ok-tinte)" : "var(--pt-alerta-tinte)",
        border: `1px solid ${bien ? "rgba(111, 168, 103, 0.3)" : "rgba(214, 164, 74, 0.35)"}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 600, color: bien ? "var(--pt-ok)" : "var(--pt-alerta)" }}>
        {bien ? <CheckCircle weight="bold" /> : <WarningCircle weight="bold" />} {titulo}
      </div>
      <p style={{ margin: "0.3rem 0 0" }}>{detalle}</p>
      {fallidos.length > 0 && (
        <p style={{ margin: "0.4rem 0 0" }}>
          No se pudo mandar el correo a {fallidos.length === 1 ? "esta empresa" : `estas ${fallidos.length} empresas`} (sí lo ven en su portal):{" "}
          <strong>{fallidos.join(", ")}</strong>.
        </p>
      )}
    </div>
  );
}
