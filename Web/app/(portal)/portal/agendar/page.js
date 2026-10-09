"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarBlank,
  PlusCircle,
} from "@phosphor-icons/react/dist/ssr";
import { ESTADOS_SOLICITUD_REC, nombreTipoRuta } from "@/lib/rutas-datos";
import { TIPOS_RESIDUO } from "@/lib/cotizar-whatsapp";
import { fechaConDia } from "@/lib/portal-datos";
import { clienteActual } from "@/lib/portal-sesion";
import { permisosDeEstado } from "@/lib/estado-cliente.mjs";
import { estadoVencimiento, ordenarPorUrgencia, textoAtraso, hoyISO } from "@/lib/vencimiento";
import {
  miSuscripcion,
  misPuntos,
  listarSolicitudes,
  pedirRecoleccion,
} from "@/lib/datos-solicitudes";
import { puntoInicial } from "@/lib/puntos-cliente.mjs";
import { puedeCancelar, puedeReagendar, estadoParaMostrar } from "@/lib/solicitud-cliente.mjs";
import { cambiarMiSolicitudAccion } from "@/app/acciones-solicitud";
import TarjetaSoporte from "@/components/portal/TarjetaSoporte";
import ErrorCarga from "@/components/portal/ErrorCarga";

/**
 * Fecha en YYYY-MM-DD con la hora LOCAL.
 * No usar `toISOString()`: pasa a UTC y, según la zona horaria, devuelve el día
 * anterior. Aquí las fechas son de calendario, no instantes.
 */
function aISO(f) {
  const mes = String(f.getMonth() + 1).padStart(2, "0");
  const dia = String(f.getDate()).padStart(2, "0");
  return `${f.getFullYear()}-${mes}-${dia}`;
}

/** Próximas fechas (hasta 6) en que pasa la ruta, a partir de mañana. */
function proximasFechas(dias, cuantas = 6) {
  const nombres = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const fechas = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  for (let i = 1; i <= 60 && fechas.length < cuantas; i++) {
    const f = new Date(d);
    f.setDate(d.getDate() + i);
    if (dias.includes(nombres[f.getDay()])) fechas.push(aISO(f));
  }
  return fechas;
}

// `hoyISO` ahora viene de lib/vencimiento.js. Era idéntica a la que estaba
// aquí —incluida la razón de no usar toISOString()— y tenerla dos veces es
// pedir que un día se arreglen distinto.

/** Un año adelante: tope contra el dedazo en el año. */
function enUnAño() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AgendarPortal() {
  const [suscripcion, setSuscripcion] = useState(null);
  const [mias, setMias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modo, setModo] = useState("ruta"); // "ruta" | "extra"
  const [fecha, setFecha] = useState("");
  const [nota, setNota] = useState("");
  // Sin valor por defecto A PROPÓSITO: si viniera puesto "RSU", el cliente
  // que no lo lee mandaría RSU aunque entregue otra cosa, y el chofer
  // llegaría preparado para lo que no es.
  const [tipoResiduo, setTipoResiduo] = useState("");
  const [enviado, setEnviado] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  // Cuenta suspendida (Entrega 1): ve sus solicitudes, pero no pide nuevas.
  // La base también lo rechaza (db/028); esto solo lo explica.
  const [puedeOperar, setPuedeOperar] = useState(true);
  useEffect(() => {
    clienteActual().then((c) => setPuedeOperar(permisosDeEstado(c?.estado).puedeOperar)).catch(() => {});
  }, []);

  // Los puntos con servicio activo (Entrega 3). Con varios, el cliente elige
  // primero en cuál; la ruta (y sus días) son los de ESE punto.
  const [puntos, setPuntos] = useState([]);
  const [puntoId, setPuntoId] = useState("");
  const punto = puntos.find((p) => p.domicilioId === puntoId) || null;
  const ruta = puntos.length ? punto?.ruta || null : suscripcion?.ruta || null;

  // Cancelar o cambiar la fecha de una solicitud (Entrega 4): { id, modo, fecha, motivo, enviando, error }.
  const [cambio, setCambio] = useState(null);
  const [hecho, setHecho] = useState("");
  const [errorCarga, setErrorCarga] = useState("");
  const [intento, setIntento] = useState(0);
  const aplicarCambio = async () => {
    if (!cambio || cambio.enviando) return;
    setCambio((c) => ({ ...c, enviando: true, error: "" }));
    const r = await cambiarMiSolicitudAccion({
      id: cambio.id,
      accion: cambio.modo,
      fecha: cambio.fecha,
      motivo: cambio.motivo,
    });
    if (!r.ok) {
      setCambio((c) => ({ ...c, enviando: false, error: r.motivo || "No se pudo." }));
      return;
    }
    setHecho(cambio.modo === "cancelar" ? `Cancelaste ${cambio.folio}. Ya le avisamos a Morcast.` : `${cambio.folio} quedó para el ${fechaConDia(r.fecha || cambio.fecha)}. Morcast la confirma y te avisa.`);
    setCambio(null);
    setMias(await listarSolicitudes());
  };

  // Las solicitudes que llegan son SOLO las de esta empresa: no hace falta
  // filtrarlas aquí porque el RLS ya las filtró en la base.
  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setErrorCarga("");
    Promise.all([miSuscripcion(), listarSolicitudes({ lanzar: true }), misPuntos({ lanzar: true })]).then(([s, lista, ps]) => {
      if (!vivo) return;
      setSuscripcion(s);
      setMias(lista);
      setPuntos(ps);
      setPuntoId(puntoInicial(ps));
      setCargando(false);
    }).catch((e) => {
      if (!vivo) return;
      setErrorCarga(e?.message || "No se pudieron cargar tus solicitudes.");
      setCargando(false);
    });
    return () => {
      vivo = false;
    };
  }, [intento]);

  const fechas = useMemo(() => (ruta ? proximasFechas(ruta.dias) : []), [ruta]);

  // Con «Otro» la nota pasa a ser obligatoria: "Otro" a secas no le dice al
  // chofer qué llevar ni a la oficina si lo puede recoger.
  const faltaDescribirOtro = tipoResiduo === "Otro" && !nota.trim();
  const faltaPunto = puntos.length > 1 && !punto;
  const puedeEnviar = Boolean(fecha && tipoResiduo && !faltaDescribirOtro && !faltaPunto);

  const enviar = async () => {
    if (!puedeEnviar || enviando || !puedeOperar) return;
    setEnviando(true);
    setError("");

    const r = await pedirRecoleccion({
      rutaClave: ruta?.clave || null,
      rutaId: ruta?.id || null,
      domicilioId: punto?.domicilioId || null,
      fecha,
      nota,
      origen: modo,
      tipoResiduo,
    });

    if (!r.ok) {
      // Se dice el motivo. Con un "vuelve a intentarlo" a secas, quien puso
      // una fecha imposible la vuelve a poner igual.
      setError(r.motivo || "No se pudo enviar tu solicitud. Vuelve a intentarlo.");
      setEnviando(false);
      return;
    }

    // Se relee de la base en vez de meter la fila a mano en la lista: así lo
    // que ve el cliente es lo que de verdad quedó guardado, con su folio real.
    setMias(await listarSolicitudes());
    setEnviado(r.folio);
    setFecha("");
    setNota("");
    setTipoResiduo("");
    setEnviando(false);
  };

  const badge = (id) => ESTADOS_SOLICITUD_REC.find((e) => e.id === id) || { texto: id, clase: "prog" };

  return (
    <>
      <div className="pt-page-head">
        <h1>Agendar recolección</h1>
        <p>Pide tu servicio en el día de tu ruta, o una recolección extra si se te juntó de más.</p>
      </div>

      <div className="pt-grid pt-grid-2" style={{ alignItems: "start" }}>
        <div className="pt-card">
          <div className="pt-card-head"><h2>Nueva solicitud</h2></div>
          {!puedeOperar && (
            <div className="pt-login-error" role="alert" style={{ marginBottom: "0.9rem" }}>
              Tu cuenta está suspendida: por ahora no puedes pedir recolecciones. Contáctanos para restablecerla.
            </div>
          )}

          {puntos.length > 1 && (
            <div style={{ marginBottom: "0.9rem" }}>
              <label htmlFor="punto" style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                ¿En cuál de tus puntos? <span style={{ color: "var(--pt-error)" }}>*</span>
              </label>
              <select
                id="punto"
                className="pt-input"
                value={puntoId}
                onChange={(e) => { setPuntoId(e.target.value); setFecha(""); }}
                style={{ width: "100%" }}
              >
                <option value="" disabled>Elige el punto de recolección</option>
                {puntos.map((p) => (
                  <option key={p.domicilioId} value={p.domicilioId}>{p.texto}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ fontSize: "0.86rem", color: "var(--mc-gris)", marginBottom: "0.9rem" }}>
            {errorCarga ? (
              <>No se pudieron cargar tus puntos y rutas.</>
            ) : faltaPunto ? (
              <>Elige primero el punto: cada uno tiene su ruta y sus días.</>
            ) : ruta ? (
              // Sin paréntesis alrededor del tipo: su nombre ya trae los suyos
              // ("Industrial (Roll Off)") y quedaban anidados.
              <>Estás dado de alta en <strong style={{ color: "var(--mc-tinta)" }}>{ruta.nombre}</strong> · {nombreTipoRuta(ruta.tipo)}. Pasa {ruta.dias.join(", ")}.</>
            ) : (
              <>Aún no tienes una ruta asignada.</>
            )}
          </div>

          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
            <button type="button" className={`pt-btn ${modo === "ruta" ? "pt-btn-verde" : ""}`} onClick={() => { setModo("ruta"); setFecha(""); }}>
              <CalendarBlank /> Día de mi ruta
            </button>
            <button type="button" className={`pt-btn ${modo === "extra" ? "pt-btn-verde" : ""}`} onClick={() => { setModo("extra"); setFecha(""); }}>
              <PlusCircle /> Recolección extra
            </button>
          </div>

          {modo === "ruta" ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem", marginBottom: "1rem" }}>
              {fechas.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`pt-btn ${fecha === f ? "pt-btn-verde" : ""}`}
                  style={{ padding: "0.4rem 0.7rem", fontSize: "0.84rem" }}
                  onClick={() => setFecha(f)}
                >
                  {/* Antes decía "2026-09-01". El cliente está eligiendo entre
                      los días en que pasa su ruta, así que la pregunta que se
                      hace es "¿el martes o el viernes?" — y con la fecha en
                      formato de máquina hay que sacar la cuenta de cabeza. */}
                  {fechaConDia(f)}
                </button>
              ))}
            </div>
          ) : (
            <input
              type="date"
              className="pt-input"
              // Sin `min` se podía agendar en el pasado: en la prueba entró
              // una recolección para 2020. El calendario ya no lo ofrece; la
              // regla de verdad está en la base (db/013), porque esto se
              // quita desde las herramientas del navegador.
              min={hoyISO()}
              max={enUnAño()}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              style={{ width: "100%", marginBottom: "1rem" }}
            />
          )}

          {/* Pedido de los dueños (4-oct-2026): especificar el residuo al
              agendar. Si al llegar el chofer encuentra otra cosa, la marca
              "No procedió" y no se cobra; por eso se pide aquí y no después. */}
          <label htmlFor="tipo-residuo" style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
            Tipo de residuo <span style={{ color: "var(--pt-error)" }}>*</span>
          </label>
          <select
            id="tipo-residuo"
            className="pt-input"
            value={tipoResiduo}
            onChange={(e) => setTipoResiduo(e.target.value)}
            required
            style={{ width: "100%", marginBottom: "0.4rem" }}
          >
            <option value="" disabled>Elige qué vamos a recoger</option>
            {TIPOS_RESIDUO.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <p style={{ fontSize: "0.8rem", color: "var(--mc-gris)", marginBottom: "1rem" }}>
            Si al llegar el residuo es otro, el chofer no lo puede recoger y la
            visita queda como «No procedió» (sin cobro).
          </p>

          <textarea
            className="pt-input"
            placeholder={
              tipoResiduo === "Otro"
                ? "Describe el residuo (obligatorio con «Otro»)"
                : "Nota para la cuadrilla (opcional)"
            }
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={3}
            style={{ width: "100%", marginBottom: "1rem" }}
          />

          <button type="button" className="pt-btn pt-btn-verde" style={{ width: "100%", justifyContent: "center" }} onClick={enviar} disabled={!puedeEnviar || enviando || !puedeOperar}>
            {enviando ? 'Enviando…' : 'Enviar solicitud'}
          </button>

          {error && (
            <p style={{ marginTop: '0.9rem', fontSize: '0.86rem', color: '#ef8080' }}>{error}</p>
          )}

          {enviado && (
            <p style={{ marginTop: "0.9rem", fontSize: "0.86rem", color: "var(--mc-verde-claro)" }}>
              Solicitud <strong>{enviado}</strong> enviada. Morcast la confirma y te avisa.
            </p>
          )}
        </div>

        <div className="pt-card">
          <div className="pt-card-head"><h2>Mis solicitudes</h2></div>
          {hecho && <div className="pt-activar-ok" role="status" style={{ marginBottom: "0.8rem" }}>{hecho}</div>}
          {cargando ? (
            <div className="pt-vacio">Cargando tus solicitudes…</div>
          ) : errorCarga ? (
            <ErrorCarga mensaje={errorCarga} onReintentar={() => setIntento((n) => n + 1)} />
          ) : mias.length === 0 ? (
            <div className="pt-vacio">Todavía no has pedido ninguna recolección.</div>
          ) : (
            ordenarPorUrgencia(mias, hoyISO()).map((s) => {
              // Una cancelada por el propio cliente se ve "Cancelada", no "Rechazada".
              const mostrar = estadoParaMostrar(s);
              const b = mostrar === "cancelada" ? { texto: "Cancelada", clase: "" } : badge(s.estado);
              const venc = estadoVencimiento(s, hoyISO());
              // Solo con id de verdad (los de ejemplo no traen): undefined === undefined abría todos.
              const abierto = Boolean(cambio && s.id && cambio.id === s.id);
              return (
                <div
                  key={s.folio}
                  className={`pt-solicitud-mia ${venc.vencida ? "vencida" : ""}`}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.6rem", flexWrap: "wrap" }}>
                    <strong style={{ fontSize: "0.9rem" }}>{s.folio}</strong>
                    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                      {/* El cliente pidió una recolección para el 25, nadie la
                          atendió, y su portal siguió diciendo "Solicitada"
                          como si todo fuera bien. Se enteró de casualidad. */}
                      {venc.vencida && (
                        <span className="pt-badge mal">
                          Se pasó la fecha · {textoAtraso(venc.dias)}
                        </span>
                      )}
                      <span className={`pt-badge ${b.clase}`}>{b.texto}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: "0.83rem", color: "var(--mc-gris)", marginTop: 3 }}>
                    {fechaConDia(s.fechaPedida)} · {s.origen === "extra" ? "Extra" : "De ruta"}
                  </div>
                  <div style={{ fontSize: "0.83rem", color: "var(--mc-tinta)", marginTop: 2 }}>
                    {s.tipoResiduo || "Residuo sin especificar"}
                  </div>
                  {s.estado === "no-procedio" && (
                    <div className="pt-solicitud-aviso">
                      No se pudo recolectar
                      {s.motivoNoProcedio ? `: ${s.motivoNoProcedio}` : ""}
                      {s.detalleNoProcedio ? ` (${s.detalleNoProcedio})` : ""}. No se te cobra.
                    </div>
                  )}
                  {venc.vencida && (
                    <div className="pt-solicitud-aviso">
                      {venc.detalleCliente}
                      <div style={{ marginTop: "0.45rem" }}>
                        <TarjetaSoporte compacta mensaje={`Hola, mi recolección ${s.folio} se pasó de fecha. ¿Me ayudan?`} />
                      </div>
                    </div>
                  )}
                  {puedeCancelar(s.estado) && !abierto && (
                    <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                      {puedeReagendar(s.estado) && (
                        <button type="button" className="pt-btn" style={{ padding: "0.3rem 0.65rem", fontSize: "0.82rem" }}
                          onClick={() => { setHecho(""); setCambio({ id: s.id, folio: s.folio, modo: "reagendar", fecha: s.fechaPedida, motivo: "" }); }}>
                          Cambiar fecha
                        </button>
                      )}
                      <button type="button" className="pt-btn" style={{ padding: "0.3rem 0.65rem", fontSize: "0.82rem" }}
                        onClick={() => { setHecho(""); setCambio({ id: s.id, folio: s.folio, modo: "cancelar", fecha: "", motivo: "" }); }}>
                        Cancelar
                      </button>
                    </div>
                  )}
                  {abierto && (
                    <div style={{ marginTop: "0.6rem", display: "grid", gap: "0.45rem" }}>
                      {cambio.modo === "reagendar" ? (
                        <input type="date" className="pt-input" min={hoyISO()} max={enUnAño()} value={cambio.fecha}
                          onChange={(e) => setCambio((c) => ({ ...c, fecha: e.target.value }))} aria-label="Fecha nueva" />
                      ) : (
                        <input className="pt-input" value={cambio.motivo} maxLength={200} placeholder="¿Por qué? (opcional)"
                          onChange={(e) => setCambio((c) => ({ ...c, motivo: e.target.value }))} aria-label="Motivo de la cancelación" />
                      )}
                      {cambio.error && <div className="pt-login-error" role="alert">{cambio.error}</div>}
                      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                        <button type="button" className={`pt-btn ${cambio.modo === "cancelar" ? "" : "pt-btn-verde"}`} disabled={cambio.enviando}
                          style={cambio.modo === "cancelar" ? { color: "#b3261e" } : undefined} onClick={aplicarCambio}>
                          {cambio.enviando ? "Guardando…" : cambio.modo === "cancelar" ? "Sí, cancelar" : "Guardar fecha"}
                        </button>
                        <button type="button" className="pt-btn" onClick={() => setCambio(null)} disabled={cambio.enviando}>No</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
