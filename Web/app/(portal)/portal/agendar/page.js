"use client";

import { useEffect, useMemo, useState } from "react";
import { FiCalendar, FiPlusCircle } from "react-icons/fi";
import { ESTADOS_SOLICITUD_REC, nombreTipoRuta } from "@/lib/rutas-datos";
import { fechaConDia } from "@/lib/portal-datos";
import {
  miSuscripcion,
  listarSolicitudes,
  pedirRecoleccion,
} from "@/lib/datos-solicitudes";

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

/** Hoy en formato AAAA-MM-DD, armado con la fecha LOCAL. */
function hoyISO() {
  const d = new Date();
  // Nada de toISOString(): pasa a UTC y de noche devuelve el día siguiente.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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
  const [enviado, setEnviado] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  const ruta = suscripcion?.ruta || null;

  // Las solicitudes que llegan son SOLO las de esta empresa: no hace falta
  // filtrarlas aquí porque el RLS ya las filtró en la base.
  useEffect(() => {
    let vivo = true;
    Promise.all([miSuscripcion(), listarSolicitudes()]).then(([s, lista]) => {
      if (!vivo) return;
      setSuscripcion(s);
      setMias(lista);
      setCargando(false);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const fechas = useMemo(() => (ruta ? proximasFechas(ruta.dias) : []), [ruta]);

  const enviar = async () => {
    if (!fecha || enviando) return;
    setEnviando(true);
    setError("");

    const r = await pedirRecoleccion({
      rutaClave: ruta?.clave || null,
      fecha,
      nota,
      origen: modo,
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

          <div style={{ fontSize: "0.86rem", color: "var(--mc-gris)", marginBottom: "0.9rem" }}>
            {ruta ? (
              // Sin paréntesis alrededor del tipo: su nombre ya trae los suyos
              // ("Industrial (Roll Off)") y quedaban anidados.
              <>Estás dado de alta en <strong style={{ color: "var(--mc-tinta)" }}>{ruta.nombre}</strong> · {nombreTipoRuta(ruta.tipo)}. Pasa {ruta.dias.join(", ")}.</>
            ) : (
              <>Aún no tienes una ruta asignada.</>
            )}
          </div>

          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
            <button type="button" className={`pt-btn ${modo === "ruta" ? "pt-btn-verde" : ""}`} onClick={() => { setModo("ruta"); setFecha(""); }}>
              <FiCalendar /> Día de mi ruta
            </button>
            <button type="button" className={`pt-btn ${modo === "extra" ? "pt-btn-verde" : ""}`} onClick={() => { setModo("extra"); setFecha(""); }}>
              <FiPlusCircle /> Recolección extra
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

          <textarea
            className="pt-input"
            placeholder="Nota para la cuadrilla (opcional)"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={3}
            style={{ width: "100%", marginBottom: "1rem" }}
          />

          <button type="button" className="pt-btn pt-btn-verde" style={{ width: "100%", justifyContent: "center" }} onClick={enviar} disabled={!fecha || enviando}>
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
          {cargando ? (
            <div className="pt-vacio">Cargando tus solicitudes…</div>
          ) : mias.length === 0 ? (
            <div className="pt-vacio">Todavía no has pedido ninguna recolección.</div>
          ) : (
            mias.map((s) => {
              const b = badge(s.estado);
              return (
                <div key={s.folio} style={{ borderTop: "1px solid var(--mc-linea)", padding: "0.7rem 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.6rem" }}>
                    <strong style={{ fontSize: "0.9rem" }}>{s.folio}</strong>
                    <span className={`pt-badge ${b.clase}`}>{b.texto}</span>
                  </div>
                  <div style={{ fontSize: "0.83rem", color: "var(--mc-gris)", marginTop: 3 }}>
                    {fechaConDia(s.fechaPedida)} · {s.origen === "extra" ? "Extra" : "De ruta"}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
