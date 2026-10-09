"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Check,
  X,
  Warning,
  CalendarBlank,
  Scales,
  Camera,
  WarningCircle,
  PencilSimple,
} from "@phosphor-icons/react/dist/ssr";
import { ESTADOS_SOLICITUD_REC } from "@/lib/rutas-datos";
import { buscarSolicitudesPanel, pendientesPanel, fotoNoProcedio } from "@/lib/datos-solicitudes";
import { rangoPorOmision, POR_PAGINA } from "@/lib/consulta-recolecciones.mjs";
import { haySupabaseNavegador } from "@/lib/supabase-navegador";
import { leerKg, textoKg, textoPeso } from "@/lib/peso.mjs";
import { ponerPesoRealRecoleccion } from "@/app/acciones-peso";
import EnPortal from "@/app/(admin)/admin/viajes/EnPortal";
import { listarOperadores } from "@/lib/datos-clientes";
import { listarRutas } from "@/lib/datos-rutas";
import { fechaConDia } from "@/lib/portal-datos";
import {
  estadoVencimiento,
  ordenarPorUrgencia,
  opcionesReagenda,
  textoAtraso,
  hoyISO,
} from "@/lib/vencimiento";
import { cambiarEstadoSolicitudAuditado } from "@/app/acciones-auditadas";
import { pesoRealActivo } from "@/lib/estado-sistema";
import { textoChoferPorOmision, avisoRutaSinChofer } from "@/lib/rutas-chofer.mjs";
import NuevaRecoleccion from "@/components/admin/NuevaRecoleccion";

export default function RecoleccionesAdmin() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [filtro, setFiltro] = useState("todas");
  const [motivo, setMotivo] = useState({});
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(null); // folio en proceso
  const [error, setError] = useState("");
  const [choferes, setChoferes] = useState([]);
  // Los días en que pasa cada ruta, para poder proponer "el próximo día de su
  // ruta" al reagendar. Van por clave, que es lo que trae la solicitud.
  const [diasPorRuta, setDiasPorRuta] = useState({});
  const hoy = hoyISO();
  // Lo que el admin decide al confirmar, por folio: { fecha, hora, choferId }.
  // Antes no se decidía nada: se confirmaba con la fecha que hubiera pedido el
  // cliente, sin hora y con el chofer que trajera la ruta.
  const [plan, setPlan] = useState({});
  // Folios CONFIRMADOS que el admin abrió para cambiarles día, hora o chofer
  // (6-oct-2026). Antes, una vez confirmada, una recolección ya no se podía
  // tocar hasta que se vencía: si el chofer faltaba, no había cómo pasarla
  // a otro.
  const [editando, setEditando] = useState({});
  // "Poner peso real" de una recolección: { s, kg, error, guardando }.
  const [pesoReal, setPesoReal] = useState(null);
  // Foto de un "No procedió", por folio: "cargando" | url | "sin-foto".
  const [fotosNP, setFotosNP] = useState({});
  // Búsqueda en la BASE (Entrega 3): antes se traía todo y se cortaba en
  // silencio a las 1,000. Fechas por omisión: desde hace 30 días, sin tope.
  const [busqueda, setBusqueda] = useState("");
  const [q, setQ] = useState(""); // la búsqueda ya "asentada" (pausa al teclear)
  const [rango, setRango] = useState(() => rangoPorOmision(hoyISO()));
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [errorCarga, setErrorCarga] = useState("");
  const [vencidasLista, setVencidasLista] = useState([]);
  const [porConfirmar, setPorConfirmar] = useState(0);
  const [recarga, setRecarga] = useState(0);
  // "Nueva recolección" de la oficina (Entrega 3) y el folio recién creado.
  const [nueva, setNueva] = useState(false);
  const [creada, setCreada] = useState(null);

  /**
   * Lo que el admin lleva elegido para esta solicitud.
   *
   * ⚠️ Si la solicitud YA SE VENCIÓ, la fecha por omisión es HOY y no la que
   * se pasó. Antes heredaba `fechaConfirmada || fechaPedida`, así que apretar
   * "Reagendar y confirmar" sin tocar nada la habría vuelto a confirmar para
   * un día que ya pasó — y el correo al cliente habría salido con esa fecha.
   */
  const planPorOmision = (s) => {
    const vencida = estadoVencimiento(s, hoy).vencida;
    return {
      fecha: vencida ? hoy : s.fechaConfirmada || s.fechaPedida,
      // Al cambiar una confirmada se parte de lo ya acordado, no de cero:
      // si no, cambiar solo el chofer le quitaría la hora sin avisar.
      hora: s.horaConfirmada ? String(s.horaConfirmada).slice(0, 5) : "",
      choferId: s.choferId || "",
    };
  };
  const planDe = (s) => plan[s.folio] || planPorOmision(s);
  // El cambio se monta sobre lo que la tarjeta ENSEÑA (con el día sugerido),
  // no sobre `{}`: antes escribir solo la hora o el chofer borraba el día, y
  // al confirmar caía a la fecha pedida aunque ya hubiera pasado (3-oct-2026).
  const setPlanDe = (s, patch) =>
    setPlan((p) => ({ ...p, [s.folio]: { ...(p[s.folio] || planPorOmision(s)), ...patch } }));

  useEffect(() => {
    let vivo = true;
    listarOperadores().then((o) => { if (vivo) setChoferes(o); });
    listarRutas().then((rs) => {
      if (!vivo) return;
      // ⚠️ OJO CON EL NOMBRE: `listarRutas()` devuelve la CLAVE en el campo
      // `id` y el UUID en `uuid` (ver aFormatoPantalla en lib/datos-rutas.js).
      // La solicitud trae `rutaId`, que también es la clave. Leyendo `r.clave`
      // —que no existe— todas las llaves salían `undefined` y el atajo
      // "próximo día de su ruta" no aparecía nunca.
      setDiasPorRuta(Object.fromEntries((rs || []).map((r) => [r.id, r.dias || []])));
    });
    return () => {
      vivo = false;
    };
  }, []);

  // Pausa corta al teclear: no se consulta la base en cada letra.
  useEffect(() => {
    const t = setTimeout(() => { setQ(busqueda); setPagina(1); }, 350);
    return () => clearTimeout(t);
  }, [busqueda]);

  // La página de recolecciones: filtro de estado, búsqueda, fechas y página.
  useEffect(() => {
    if (filtro === "vencidas") return;
    let vivo = true;
    setCargando(true);
    buscarSolicitudesPanel({ q, desde: rango.desde, hasta: rango.hasta, estado: filtro === "todas" ? "" : filtro, pagina })
      .then((r) => {
        if (!vivo) return;
        setSolicitudes(r.filas);
        setTotal(r.total);
        setErrorCarga(r.ok ? "" : r.motivo);
        setCargando(false);
      });
    return () => { vivo = false; };
  }, [filtro, q, rango, pagina, recarga]);

  // Lo que no se puede perder aunque quede fuera del rango: vencidas y por confirmar.
  useEffect(() => {
    let vivo = true;
    pendientesPanel(hoy).then((r) => {
      if (!vivo) return;
      setVencidasLista(r.vencidas);
      setPorConfirmar(r.porConfirmar);
    });
    return () => { vivo = false; };
  }, [hoy, recarga]);

  // `?cambiar=<folio>` (el enlace "Cambiar" de la Agenda de servicios) abre
  // esa recolección ya lista para editar.
  const [pedidoCambiar, setPedidoCambiar] = useState("");
  // `?folio=<folio>` (el correo "Ver en el panel" cuando un cliente cancela o
  // reagenda, Entrega 4): esa solicitud, con cualquier estado.
  useEffect(() => {
    const folio = new URLSearchParams(window.location.search).get("folio");
    if (!folio) return;
    setFiltro("todas");
    setBusqueda(folio);
    setQ(folio);
    setRango({ desde: "", hasta: "" });
  }, []);
  useEffect(() => {
    const folio = new URLSearchParams(window.location.search).get("cambiar");
    if (!folio) return;
    setPedidoCambiar(folio);
    setFiltro("confirmada");
    // Que salga aunque esté fuera del rango de fechas o en otra página.
    setBusqueda(folio);
    setQ(folio);
    setRango({ desde: "", hasta: "" });
    setEditando((e) => ({ ...e, [folio]: true }));
  }, []);
  useEffect(() => {
    if (cargando || !pedidoCambiar) return;
    document.getElementById(`rec-${pedidoCambiar}`)?.scrollIntoView({ block: "center" });
  }, [cargando, pedidoCambiar]);

  const badge = (id) => ESTADOS_SOLICITUD_REC.find((e) => e.id === id) || { texto: id, clase: "prog" };

  /**
   * Se guarda PRIMERO y se pinta después.
   *
   * Lo contrario (pintar y guardar en segundo plano) es más ágil, pero aquí
   * se está comprometiendo un camión a una fecha: si la escritura falla,
   * Morcast se habría quedado creyendo que confirmó un servicio que nadie
   * registró.
   */
  const aplicar = async (s, accion, cambiosLocales) => {
    setOcupado(s.folio);
    setError("");
    const r = await accion();
    if (!r.ok) {
      setError(`No se pudo guardar (${s.folio}). ${r.motivo || "Vuelve a intentarlo."}`);
      setOcupado(null);
      return false;
    }
    setSolicitudes((lista) =>
      lista.map((x) => (x.folio === s.folio ? { ...x, ...cambiosLocales } : x))
    );
    setVencidasLista((lista) =>
      lista.map((x) => (x.folio === s.folio ? { ...x, ...cambiosLocales } : x))
    );
    // Vencidas, "por confirmar" y la página se vuelven a pedir a la base: con
    // el filtro de estado en el servidor, la fila que cambió de estado ya no
    // va en esta lista (y el total cambió).
    pendientesPanel(hoy).then((r) => { setVencidasLista(r.vencidas); setPorConfirmar(r.porConfirmar); });
    setRecarga((n) => n + 1);
    setOcupado(null);
    return true;
  };

  /** Cierra el editor de una recolección y olvida lo que se llevaba escrito. */
  const cerrarEditor = (folio) => {
    setEditando((e) => ({ ...e, [folio]: false }));
    setPlan((pl) => {
      const { [folio]: _, ...resto } = pl;
      return resto;
    });
  };

  // Van por el servidor (no por el navegador) para que queden en la bitácora
  // y para que se cuenten las filas que devolvió la base: un UPDATE que el
  // RLS bloquea no da error, actualiza cero y responde que todo bien.
  const confirmar = async (s) => {
    const p = planDe(s);
    const chofer = choferes.find((c) => c.id === p.choferId);
    const cambio = s.estado === "confirmada" && editando[s.folio];
    const ok = await aplicar(
      s,
      () =>
        cambiarEstadoSolicitudAuditado(
          s.id,
          {
            estado: "confirmada",
            fecha_confirmada: p.fecha || s.fechaPedida,
            // Nulos a propósito cuando no se eligen: "sin hora" y "el de la
            // ruta" son respuestas válidas, no campos a medio llenar.
            hora_confirmada: p.hora || null,
            chofer_id: p.choferId || null,
          },
          // La bitácora tiene que poder responder "¿cuántas se reagendaron
          // porque se nos pasaron?". Con un solo nombre no se puede.
          estadoVencimiento(s, hoy).vencida
            ? "reagendar_recoleccion_vencida"
            : cambio
              ? "cambiar_recoleccion_confirmada"
              : "confirmar_recoleccion"
        ),
      {
        estado: "confirmada",
        fechaConfirmada: p.fecha || s.fechaPedida,
        horaConfirmada: p.hora || "",
        choferId: p.choferId || null,
        choferAsignado: chofer?.nombre || "",
        choferEfectivo: chofer?.nombre || s.chofer,
      }
    );
    // Si falló, el error queda en pantalla y el editor abierto con lo que
    // se llevaba escrito; si guardó, se cierra.
    if (ok) cerrarEditor(s.folio);
  };

  const rechazar = (s) => {
    const texto = motivo[s.folio] || "Sin cupo en la ruta.";
    return aplicar(
      s,
      () =>
        cambiarEstadoSolicitudAuditado(
          s.id,
          { estado: "rechazada", motivo_rechazo: texto },
          "rechazar_recoleccion"
        ),
      { estado: "rechazada", motivoRechazo: texto }
    );
  };

  /**
   * Peso real de UNA recolección (el "por si acaso" de los dueños). Va por
   * el servidor: comprueba el rol, cuenta la fila y lo anota en la bitácora
   * con el valor de antes. Vacío = quitarlo.
   */
  const guardarPesoReal = async (quitar = false) => {
    const { s, kg } = pesoReal;
    let valor = null;
    if (!quitar) {
      const p = leerKg(kg);
      if (p.error) return setPesoReal((x) => ({ ...x, error: p.error }));
      valor = p.kg;
    }
    setPesoReal((x) => ({ ...x, guardando: true, error: "" }));
    const r = await ponerPesoRealRecoleccion(s.evidencia.id, quitar ? null : String(valor));
    if (!r.ok) {
      return setPesoReal((x) => ({ ...x, guardando: false, error: r.motivo || "No se pudo guardar." }));
    }
    const en = r.demo ? (quitar ? null : new Date().toISOString()) : r.en;
    setSolicitudes((lista) =>
      lista.map((x) =>
        x.folio === s.folio ? { ...x, evidencia: { ...x.evidencia, realKg: valor, realEn: en } } : x
      )
    );
    setPesoReal(null);
  };

  const verFotoNP = async (s) => {
    setFotosNP((f) => ({ ...f, [s.folio]: "cargando" }));
    const url = await fotoNoProcedio(s.id);
    setFotosNP((f) => ({ ...f, [s.folio]: url || "sin-foto" }));
  };

  // El orden es lo primero que fallaba: estaba de la más nueva a la más
  // vieja, así que una recolección atrasada se hundía un lugar cada vez que
  // entraba una nueva. Ahora manda la urgencia.
  const vencidas = vencidasLista.filter((s) => estadoVencimiento(s, hoy).vencida);
  // El estado ya lo filtró la base; "Vencidas" es su propia consulta.
  const base = filtro === "vencidas" ? vencidas : solicitudes;
  const lista = ordenarPorUrgencia(base, hoy);
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const cambiaFiltro = (f) => { setFiltro(f); setPagina(1); };

  return (
    <>
      <div className="pt-page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1>Recolecciones</h1>
          <p>
            {porConfirmar === 0
              ? "No hay solicitudes por confirmar."
              : `${porConfirmar} solicitud${porConfirmar === 1 ? "" : "es"} por confirmar.`}
          </p>
        </div>
        <button type="button" className="pt-btn pt-btn-naranja" onClick={() => { setNueva((v) => !v); setCreada(null); }}>
          {nueva ? "Cancelar" : "Nueva recolección"}
        </button>
      </div>

      {nueva && (
        <NuevaRecoleccion
          choferes={choferes}
          onCerrar={() => setNueva(false)}
          onCreada={(r) => {
            setNueva(false);
            setCreada(r);
            setRecarga((n) => n + 1);
          }}
        />
      )}
      {creada && (
        <div className="pt-activar-ok" role="status" style={{ marginBottom: "1rem" }}>
          Listo: {creada.folio} quedó {creada.estado === "confirmada" ? "confirmada (ya se avisó al cliente y al chofer)" : "como solicitud por confirmar"}.
          {creada.motivo ? ` ${creada.motivo}` : ""}
        </div>
      )}

      {/* Lo vencido va ARRIBA de los filtros y del listado. Si hay una
          recolección que se pasó de fecha, eso es lo que hay que resolver
          hoy: no puede estar al mismo nivel que el resto. */}
      {vencidas.length > 0 && (
        <div className="pt-aviso-vencidas">
          <Warning aria-hidden="true" />
          <div>
            <strong>
              {vencidas.length === 1
                ? "1 recolección se pasó de fecha"
                : `${vencidas.length} recolecciones se pasaron de fecha`}
            </strong>
            <span>Reagéndalas abajo: puedes ponerlas para hoy mismo.</span>
          </div>
          <button type="button" className="pt-btn" onClick={() => cambiaFiltro("vencidas")}>
            Ver sólo esas
          </button>
        </div>
      )}

      {error && (
        <div
          className="pt-card"
          style={{ borderColor: "#ef8080", color: "#ef8080", marginBottom: "1rem", fontSize: "0.9rem" }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1rem" }}>
        <button type="button" className={`pt-btn ${filtro === "todas" ? "pt-btn-naranja" : ""}`} onClick={() => cambiaFiltro("todas")}>
          Todas
        </button>
        {vencidas.length > 0 && (
          <button
            type="button"
            className={`pt-btn pt-btn-vencida ${filtro === "vencidas" ? "activo" : ""}`}
            onClick={() => cambiaFiltro("vencidas")}
          >
            <Warning aria-hidden="true" /> Vencidas ({vencidas.length})
          </button>
        )}
        {ESTADOS_SOLICITUD_REC.map((e) => (
          <button
            key={e.id}
            type="button"
            className={`pt-btn ${filtro === e.id ? "pt-btn-naranja" : ""}`}
            onClick={() => cambiaFiltro(e.id)}
          >
            {e.texto}
          </button>
        ))}
      </div>

      {/* Buscar por folio o empresa y por rango de fechas (fecha efectiva:
          la confirmada si la hay). La búsqueda la hace la base. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", alignItems: "flex-end", marginBottom: "1rem" }}>
        <label style={{ flex: "1 1 220px", fontSize: "0.8rem", color: "var(--mc-gris)" }}>
          Buscar
          <input
            className="pt-input"
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Folio (REC-…) o empresa"
            style={{ width: "100%", marginTop: 4 }}
          />
        </label>
        <label style={{ fontSize: "0.8rem", color: "var(--mc-gris)" }}>
          Desde
          <input className="pt-input" type="date" value={rango.desde} disabled={filtro === "vencidas"}
            onChange={(e) => { setRango((r) => ({ ...r, desde: e.target.value })); setPagina(1); }}
            style={{ display: "block", marginTop: 4 }} />
        </label>
        <label style={{ fontSize: "0.8rem", color: "var(--mc-gris)" }}>
          Hasta
          <input className="pt-input" type="date" value={rango.hasta} disabled={filtro === "vencidas"}
            onChange={(e) => { setRango((r) => ({ ...r, hasta: e.target.value })); setPagina(1); }}
            style={{ display: "block", marginTop: 4 }} />
        </label>
        {(busqueda || rango.desde !== rangoPorOmision(hoy).desde || rango.hasta) && (
          <button type="button" className="pt-btn" onClick={() => { setBusqueda(""); setQ(""); setRango(rangoPorOmision(hoy)); setPagina(1); }}>
            Limpiar
          </button>
        )}
      </div>

      {errorCarga && (
        <div className="pt-login-error" role="alert" style={{ marginBottom: "1rem" }}>
          {errorCarga}{" "}
          <button type="button" className="pt-btn" onClick={() => setRecarga((n) => n + 1)}>Reintentar</button>
        </div>
      )}

      <div className="pt-card">
        {cargando && filtro !== "vencidas" ? (
          <div className="pt-vacio">Cargando recolecciones…</div>
        ) : lista.length === 0 ? (
          <div className="pt-vacio">
            {q || rango.hasta ? "Ninguna recolección con esa búsqueda o esas fechas." : "No hay recolecciones con ese estado en estas fechas."}
          </div>
        ) : (
          lista.map((s) => {
            const b = badge(s.estado);
            const venc = estadoVencimiento(s, hoy);
            return (
              <div
                key={s.folio}
                id={`rec-${s.folio}`}
                className={`pt-recoleccion ${venc.vencida ? "vencida" : ""}`}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.7rem", flexWrap: "wrap" }}>
                  <div>
                    <strong>{s.folio}</strong>
                    <span style={{ color: "var(--mc-gris)", marginLeft: 8, fontSize: "0.88rem" }}>
                      {s.cliente}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                    {/* La insignia de vencida va ANTES que la de estado: es lo
                        que hay que ver primero. "Sin atender" y "No se
                        cumplió" no son lo mismo y por eso no dicen lo mismo. */}
                    {venc.vencida && (
                      <span className="pt-badge mal">
                        {venc.texto} · {textoAtraso(venc.dias)}
                      </span>
                    )}
                    <span className={`pt-badge ${b.clase}`}>{b.texto}</span>
                  </div>
                </div>

                <div style={{ fontSize: "0.84rem", color: "var(--mc-gris)", marginTop: 5 }}>
                  {/* Los pedazos vacios se caen ANTES de unirlos: escritos a mano
                      con "·" en medio, una solicitud sin ruta salia como
                      "Matriz · Zona Centro · · pedida para…", con el separador
                      colgando de la nada. */}
                  {[
                    s.domicilio,
                    s.rutaNombre,
                    `pedida para ${fechaConDia(s.fechaPedida)}`,
                    s.origen === "extra" ? "Extra" : "De ruta",
                  ]
                    .filter((t) => t && String(t).trim() && String(t).trim() !== "—")
                    .join(" · ")}
                </div>

                {/* Lo que pidió el cliente al agendar (db/023). Es lo que el
                    chofer compara con lo que encuentra: si no es eso, la
                    parada termina en "No procedió". */}
                {s.tipoResiduo && (
                  <div style={{ fontSize: "0.84rem", marginTop: 5 }}>
                    <span style={{ color: "var(--mc-gris)" }}>Residuo que pidió: </span>
                    {s.tipoResiduo}
                  </div>
                )}

                {venc.vencida && (
                  <div className="pt-recoleccion-motivo">{venc.detalle}</div>
                )}

                {s.fechaConfirmada && (
                  <div style={{ fontSize: "0.84rem", color: "var(--mc-ok)", marginTop: 5 }}>
                    Acordado: {fechaConDia(s.fechaConfirmada)}
                    {s.horaConfirmada ? ` a las ${String(s.horaConfirmada).slice(0, 5)}` : " (sin hora)"}
                    {" · "}
                    {/* Sin chofer se imprimia la palabra "undefined" tal cual.
                        Y no es un caso raro: hoy las 5 rutas reales tienen el
                        chofer vacio. */}
                    {s.choferAsignado
                      ? `${s.choferAsignado} (asignado)`
                      : s.chofer
                        ? `${s.chofer} (de la ruta)`
                        : "sin chofer asignado"}
                    {/* Solo mientras está confirmada: en ruta el chofer ya
                        la empezó, y moverla le cambiaría la parada en la
                        mano. Vencida ya trae su propio editor abajo. */}
                    {s.estado === "confirmada" && !venc.vencida && !editando[s.folio] && (
                      <button
                        type="button"
                        className="pt-btn"
                        onClick={() => setEditando((e) => ({ ...e, [s.folio]: true }))}
                        style={{ marginLeft: 10, padding: "0.2rem 0.6rem", fontSize: "0.8rem" }}
                      >
                        <PencilSimple aria-hidden="true" /> Cambiar día, hora o chofer
                      </button>
                    )}
                  </div>
                )}

                {s.nota && (
                  <div style={{ fontSize: "0.84rem", color: "var(--mc-gris)", marginTop: 5, fontStyle: "italic" }}>
                    “{s.nota}”
                  </div>
                )}

                {s.motivoRechazo && (
                  <div style={{ fontSize: "0.84rem", color: "#f0895c", marginTop: 5 }}>
                    Rechazada: {s.motivoRechazo}
                  </div>
                )}

                {/* "No procedió": el chofer sí llegó. Se enseña su motivo como
                    respaldo ante el cliente, y no cuenta como incumplida
                    (lib/vencimiento.js) ni se cobra. */}
                {s.estado === "no-procedio" && (
                  // Ámbar y no rojo: el rojo de esta lista es "Morcast falló"
                  // (vencidas), y aquí el camión sí llegó.
                  <div style={{ fontSize: "0.84rem", marginTop: 6, lineHeight: 1.4, borderLeft: "3px solid var(--mc-alerta)", paddingLeft: "0.7rem" }}>
                    <strong style={{ color: "var(--mc-alerta)" }}>No procedió: {s.motivoNoProcedio || "sin motivo registrado"}</strong>
                    {s.detalleNoProcedio && <div style={{ marginTop: 3 }}>{s.detalleNoProcedio}</div>}
                    <div style={{ marginTop: 6, display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                      {fotosNP[s.folio] === undefined && haySupabaseNavegador() && (
                        <button type="button" className="pt-btn" onClick={() => verFotoNP(s)}>
                          <Camera /> Ver foto del chofer
                        </button>
                      )}
                      {fotosNP[s.folio] === "cargando" && <span style={{ fontSize: "0.8rem" }}>Buscando la foto…</span>}
                      {fotosNP[s.folio] === "sin-foto" && (
                        <span style={{ fontSize: "0.8rem", color: "var(--mc-gris)" }}>El chofer no dejó foto.</span>
                      )}
                      {fotosNP[s.folio] && !["cargando", "sin-foto"].includes(fotosNP[s.folio]) && (
                        <a href={fotosNP[s.folio]} target="_blank" rel="noopener noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={fotosNP[s.folio]}
                            alt={`Foto de la visita ${s.folio}`}
                            style={{ maxWidth: 220, maxHeight: 160, borderRadius: 10, border: "1px solid var(--mc-linea)", display: "block" }}
                          />
                        </a>
                      )}
                      {!haySupabaseNavegador() && (
                        <span style={{ fontSize: "0.8rem", color: "var(--mc-gris)" }}>
                          (En modo demostración no hay fotos.)
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* El peso: el del chofer es un ESTIMADO. El real lo da la
                    báscula del relleno, por viaje (/admin/viajes) o, por si
                    acaso, por recolección con el botón de aquí. */}
                {s.estado === "completada" && (
                  <div style={{ fontSize: "0.84rem", marginTop: 6, display: "flex", gap: "0.5rem 1rem", flexWrap: "wrap", alignItems: "center" }}>
                    {!s.evidencia ? (
                      <span style={{ color: "var(--mc-gris)" }}>Sin evidencia del chofer: no hay peso.</span>
                    ) : (
                      <>
                        <span>
                          <span style={{ color: "var(--mc-gris)" }}>Estimado del chofer: </span>
                          {s.evidencia.estimadoKg ? textoKg(s.evidencia.estimadoKg) : "sin peso"}
                        </span>
                        {pesoRealActivo() && s.evidencia.realKg && (
                          <span style={{ color: "var(--mc-ok)" }}>
                            Peso real: <strong>{textoKg(s.evidencia.realKg)}</strong>
                          </span>
                        )}
                        {pesoRealActivo() && s.evidencia.viaje && (
                          <Link href="/admin/viajes" style={{ color: "var(--mc-azul-txt, #6ba3cf)" }}>
                            Va en el viaje del {fechaConDia(s.evidencia.viaje.fecha)}
                            {s.evidencia.viaje.pesoRealKg ? ` · ${textoPeso(s.evidencia.viaje.pesoRealKg)} reales en total` : ""}
                            {s.evidencia.viaje.folioTicket ? ` · ticket ${s.evidencia.viaje.folioTicket}` : ""}
                          </Link>
                        )}
                        {/* Apagado por ahora (lib/estado-sistema.js, PESO_REAL). */}
                        {pesoRealActivo() && (
                          <button
                            type="button"
                            className="pt-btn"
                            onClick={() => setPesoReal({ s, kg: s.evidencia.realKg ? String(s.evidencia.realKg) : "", error: "" })}
                          >
                            <Scales /> {s.evidencia.realKg ? "Cambiar peso real" : "Poner peso real"}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}

                {(s.estado === "solicitada" || venc.vencida || (s.estado === "confirmada" && editando[s.folio])) && (
                  <>
                  {/* Qué día, a qué hora y con quién. Antes esto no se
                      preguntaba: se confirmaba con la fecha que hubiera
                      puesto el cliente y el chofer que trajera la ruta.

                      Y antes SOLO salía si el estado era "solicitada". Ese era
                      el hueco grave: una recolección ya confirmada que se
                      pasaba del día no se podía reagendar desde ningún lado,
                      justo el caso en que Morcast ya se había comprometido. */}

                  {/* Atajos de fecha. El sistema NO sabe cuántas paradas caben
                      en un camión —eso no está en la base—, así que propone y
                      no decide: "hoy" y "mañana" son recolección extra, y el
                      otro es el día en que la unidad ya va a pasar por ahí.
                      La disponibilidad real la pone quien conoce la operación,
                      y para eso queda el selector de fecha libre. */}
                  <div className="pt-reagenda">
                    <span className="pt-reagenda-tit">
                      <CalendarBlank aria-hidden="true" />
                      {venc.vencida ? "Reagendar para" : editando[s.folio] ? "Cambiar a" : "Agendar para"}
                    </span>
                    {opcionesReagenda(diasPorRuta[s.rutaId] || [], hoy).map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        className={`pt-btn ${planDe(s).fecha === o.fecha ? "pt-btn-naranja" : ""}`}
                        onClick={() => setPlanDe(s, { fecha: o.fecha })}
                      >
                        {o.texto}
                        <span className="pt-reagenda-fecha">{fechaConDia(o.fecha)}</span>
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.7rem", flexWrap: "wrap", alignItems: "center" }}>
                    <label style={{ fontSize: "0.8rem", color: "var(--mc-gris)" }}>
                      Día
                      <input
                        type="date"
                        className="pt-input"
                        value={planDe(s).fecha || ""}
                        onChange={(e) => setPlanDe(s, { fecha: e.target.value })}
                        /* 150 px no alcanzaban: con el relleno de `.pt-input`
                           y el icono del calendario, la fecha se veia
                           "02/09/202" — con el ano cortado a la mitad. */
                        style={{ marginLeft: 6, width: 190 }}
                      />
                    </label>
                    <label style={{ fontSize: "0.8rem", color: "var(--mc-gris)" }}>
                      Hora
                      <input
                        type="time"
                        className="pt-input"
                        value={planDe(s).hora || ""}
                        onChange={(e) => setPlanDe(s, { hora: e.target.value })}
                        /* Igual que el dia: el icono del reloj se comia el
                           final de la hora. */
                        style={{ marginLeft: 6, width: 155 }}
                      />
                      <span style={{ marginLeft: 4 }}>(opcional)</span>
                    </label>
                    <label style={{ fontSize: "0.8rem", color: "var(--mc-gris)" }}>
                      Chofer
                      <select
                        className="pt-input"
                        value={planDe(s).choferId || ""}
                        onChange={(e) => setPlanDe(s, { choferId: e.target.value })}
                        style={{ marginLeft: 6, minWidth: 190 }}
                      >
                        {/* El chofer REAL de la ruta (rutas.chofer_id), no el texto viejo. */}
                        <option value="">
                          {textoChoferPorOmision({ choferId: s.rutaChoferId, chofer: s.rutaChofer })}
                        </option>
                        {choferes.map((c) => (
                          <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {avisoRutaSinChofer({ choferElegido: planDe(s).choferId, ruta: { choferId: s.rutaChoferId } }) && (
                    <p style={{ margin: "0.5rem 0 0", fontSize: "0.82rem", color: "#f0895c" }}>
                      {avisoRutaSinChofer({ choferElegido: planDe(s).choferId, ruta: { choferId: s.rutaChoferId } })}
                    </p>
                  )}
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.7rem", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="pt-btn pt-btn-verde"
                      onClick={() => confirmar(s)}
                      disabled={ocupado === s.folio}
                    >
                      <Check />{" "}
                      {ocupado === s.folio
                        ? "Guardando…"
                        : venc.vencida
                          ? "Reagendar y confirmar"
                          : editando[s.folio]
                            ? "Guardar cambios"
                            : "Confirmar"}
                    </button>
                    {/* Cambiar una confirmada no es rechazarla: ahí solo se
                        ofrece salir sin guardar. El correo al cliente y al
                        chofer sale de nuevo con lo nuevo al guardar. */}
                    {editando[s.folio] && !venc.vencida ? (
                      <button
                        type="button"
                        className="pt-btn"
                        onClick={() => cerrarEditor(s.folio)}
                        disabled={ocupado === s.folio}
                      >
                        Cancelar
                      </button>
                    ) : (
                    <>
                    <input
                      className="pt-input"
                      placeholder="Motivo del rechazo"
                      value={motivo[s.folio] || ""}
                      onChange={(e) => setMotivo({ ...motivo, [s.folio]: e.target.value })}
                      style={{ flex: 1, minWidth: 180 }}
                    />
                    <button
                      type="button"
                      className="pt-btn"
                      onClick={() => rechazar(s)}
                      disabled={ocupado === s.folio}
                    >
                      <X /> Rechazar
                    </button>
                    </>
                    )}
                  </div>
                  </>
                )}
              </div>
            );
          })
        )}
        {filtro !== "vencidas" && total > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", paddingTop: "0.9rem", fontSize: "0.85rem", color: "var(--mc-gris)" }}>
            <span>
              {total} recolecci{total === 1 ? "ón" : "ones"} · página {pagina} de {paginas}
            </span>
            <span style={{ display: "flex", gap: "0.4rem" }}>
              <button type="button" className="pt-btn" disabled={pagina <= 1 || cargando} onClick={() => setPagina((n) => n - 1)}>Anterior</button>
              <button type="button" className="pt-btn" disabled={pagina >= paginas || cargando} onClick={() => setPagina((n) => n + 1)}>Siguiente</button>
            </span>
          </div>
        )}
      </div>

      {pesoReal && (
        <EnPortal>
          <div className="pt-modal-fondo" onClick={() => !pesoReal.guardando && setPesoReal(null)}>
            <div
              className="pt-modal"
              style={{ width: "min(460px, 100%)" }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Poner peso real"
            >
              <div className="pt-modal-head">
                <div>
                  <strong>Peso real · {pesoReal.s.folio}</strong>
                  <span>{pesoReal.s.cliente}</span>
                </div>
                <button type="button" className="pt-btn" onClick={() => setPesoReal(null)} disabled={pesoReal.guardando} aria-label="Cerrar"><X /></button>
              </div>
              <div style={{ padding: "1.2rem" }}>
                <p style={{ fontSize: "0.84rem", color: "var(--mc-gris)", marginTop: 0 }}>
                  El chofer estimó{" "}
                  <strong style={{ color: "var(--mc-tinta)" }}>
                    {pesoReal.s.evidencia.estimadoKg ? textoKg(pesoReal.s.evidencia.estimadoKg) : "nada"}
                  </strong>
                  . Úsalo cuando la báscula pesó solo esta recolección (un roll-off, un viaje con un
                  solo contenedor). Si iba con otras en el camión, registra el viaje completo en{" "}
                  <Link href="/admin/viajes" style={{ color: "var(--mc-azul-txt, #6ba3cf)" }}>Peso real (relleno)</Link>.
                </p>
                {pesoReal.s.evidencia.viaje && (
                  <p className="pt-nota-demo" style={{ margin: "0 0 0.9rem" }}>
                    <WarningCircle /> Esta recolección ya va en un viaje con peso real. En los reportes
                    manda el peso del viaje; este dato queda como referencia.
                  </p>
                )}
                <div className="pt-campo">
                  <label htmlFor="peso-real-kg">Peso real (kg)</label>
                  <input
                    id="peso-real-kg"
                    inputMode="decimal"
                    autoFocus
                    value={pesoReal.kg}
                    placeholder="Ej. 3460"
                    onChange={(e) => setPesoReal((x) => ({ ...x, kg: e.target.value, error: "" }))}
                    onKeyDown={(e) => { if (e.key === "Enter") guardarPesoReal(); }}
                    style={{ fontFamily: "var(--fuente-mono), 'JetBrains Mono', monospace" }}
                  />
                </div>
                {pesoReal.error && (
                  <div className="pt-login-error" role="alert" style={{ marginBottom: "0.9rem" }}>{pesoReal.error}</div>
                )}
                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "space-between", flexWrap: "wrap" }}>
                  <div>
                    {pesoReal.s.evidencia.realKg && (
                      <button type="button" className="pt-btn" onClick={() => guardarPesoReal(true)} disabled={pesoReal.guardando}>
                        Quitar peso real
                      </button>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button type="button" className="pt-btn" onClick={() => setPesoReal(null)} disabled={pesoReal.guardando}>Cancelar</button>
                    <button type="button" className="pt-btn pt-btn-verde" onClick={() => guardarPesoReal()} disabled={pesoReal.guardando}>
                      <Check /> {pesoReal.guardando ? "Guardando…" : "Guardar"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </EnPortal>
      )}
    </>
  );
}
