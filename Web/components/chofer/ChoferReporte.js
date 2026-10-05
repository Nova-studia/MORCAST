"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Siren,
  Clock,
  Wrench,
  ChatCircleText,
  Package,
  ArrowsLeftRight,
  Question,
  Phone,
  Camera,
  MapPin,
  CheckCircle,
} from "@phosphor-icons/react/dist/ssr";
import {
  TIPOS_INCIDENTE,
  TELEFONO_OFICINA,
  TELEFONO_OFICINA_ENLACE,
  LIMITES_REPORTE,
  validarReporte,
  esDeContenedor,
  tipoIncidente,
} from "@/lib/chofer-reportes.mjs";
import { rutaDelDia, hoyISO, contenedoresDelPunto, subirFotoIncidente } from "@/lib/datos-chofer";
import useUbicacion, { esConfiable } from "@/lib/ubicacion";
import { reportarIncidente } from "@/app/acciones-chofer";

const ICONOS = {
  accidente: Siren,
  retraso: Clock,
  "falla-mecanica": Wrench,
  otro: ChatCircleText,
  "contenedor-danado": Package,
  "contenedor-movido": ArrowsLeftRight,
  "contenedor-no-esta": Question,
};

/**
 * Llamar a la oficina. El número va en una sola pieza que no se parte: a
 * 390 px "868 384 / 9478" quedaba en dos renglones y así no se lee de un
 * vistazo. Fuera del componente principal para no recrearlo en cada render.
 */
function BotonLlamar() {
  return (
    <a className="ch-llamar" href={TELEFONO_OFICINA_ENLACE} aria-label={`Llamar a la oficina, ${TELEFONO_OFICINA}`}>
      <Phone aria-hidden="true" weight="fill" /> Llamar
      <span className="ch-num">{TELEFONO_OFICINA}</span>
    </a>
  );
}

/** Atajos de minutos: teclear con guantes cuesta, tocar un botón no. */
const MINUTOS_RAPIDOS = [15, 30, 45, 60, 90];

const EJEMPLOS = {
  accidente: "Ej. me pegaron por detrás en Av. Uniones, sin heridos",
  retraso: "Ej. tráfico en el puente, voy atrasado a las siguientes",
  "falla-mecanica": "Ej. se prendió el foco de temperatura",
  otro: "¿Qué pasó?",
  "contenedor-danado": "Ej. la tapa está rota y no cierra",
  "contenedor-movido": "Ej. lo pasaron al patio de atrás",
  "contenedor-no-esta": "Ej. el vigilante no sabe dónde está",
};

/**
 * REPORTAR UN PROBLEMA desde la calle.
 *
 * Pedidos de los dueños (4-oct-2026): avisar de un accidente, un retraso o
 * una falla, y de un contenedor dañado, movido o que no está. El reporte se
 * guarda en `incidentes` y a la oficina le llega un correo (acción
 * `reportarIncidente`).
 *
 * Se pide lo mínimo: qué pasó, y solo lo que ese tipo necesita (minutos en
 * el retraso, cuál contenedor en los de contenedor). La foto y la
 * descripción ayudan, pero no detienen el reporte; el GPS va solo si el
 * teléfono lo da. En un accidente lo primero es LLAMAR, y la pantalla lo
 * dice antes que cualquier formulario.
 */
export default function ChoferReporte({ paradaInicial = "" }) {
  const [tipo, setTipo] = useState("");
  const [minutos, setMinutos] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [paradas, setParadas] = useState([]);
  const [paradaId, setParadaId] = useState(paradaInicial);
  const [contenedores, setContenedores] = useState([]);
  const [contenedorId, setContenedorId] = useState("");
  const [foto, setFoto] = useState(null); // { ruta, url }
  const [subiendo, setSubiendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [listo, setListo] = useState(null); // { tipo }
  const refFoto = useRef(null);

  // El GPS se pide al abrir: para cuando el chofer termina de escribir, la
  // lectura ya afinó. Si no lo da, el reporte se manda igual.
  const { lectura, estado: estadoGps } = useUbicacion();

  useEffect(() => {
    let vivo = true;
    rutaDelDia(hoyISO()).then((lista) => {
      if (!vivo) return;
      setParadas(lista);
      // Una parada que no está en la ruta de hoy no se ofrece: la base
      // rechazaría el reporte de todos modos.
      if (paradaInicial && !lista.some((p) => p.id === paradaInicial)) setParadaId("");
    });
    return () => {
      vivo = false;
    };
  }, [paradaInicial]);

  const parada = useMemo(() => paradas.find((p) => p.id === paradaId) || null, [paradas, paradaId]);
  const deContenedor = esDeContenedor(tipo);

  // Los contenedores del punto, solo cuando hacen falta.
  useEffect(() => {
    let vivo = true;
    setContenedorId("");
    if (!deContenedor || !parada?.punto?.id) {
      setContenedores([]);
      return;
    }
    contenedoresDelPunto(parada.punto.id).then((lista) => {
      if (vivo) setContenedores(lista);
    });
    return () => {
      vivo = false;
    };
  }, [deContenedor, parada]);

  useEffect(() => {
    return () => {
      if (foto?.url) URL.revokeObjectURL(foto.url);
    };
  }, [foto]);

  const tomarFoto = async (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setError("");
    setSubiendo(true);
    // Se sube YA, como la evidencia: si se va la señal al mandar, la foto
    // ya está a salvo y solo falta reintentar el reporte.
    const r = await subirFotoIncidente(archivo);
    setSubiendo(false);
    if (!r.ok) {
      setError("No se pudo subir la foto. Puedes mandar el reporte sin ella.");
      return;
    }
    setFoto({ ruta: r.ruta || null, url: URL.createObjectURL(archivo) });
  };

  const enviar = async () => {
    const entrada = {
      tipo,
      descripcion,
      retrasoMin: minutos === "" ? "" : Number(minutos),
      solicitudId: paradaId || null,
      contenedorId: contenedorId || null,
      ubicacion: lectura || null,
    };
    const v = validarReporte(entrada);
    if (!v.ok) {
      setError(v.mensaje);
      return;
    }
    setEnviando(true);
    setError("");
    const r = await reportarIncidente({ ...entrada, foto: foto?.ruta || null });
    setEnviando(false);
    if (!r.ok) {
      setError(r.motivo || "No se pudo mandar. Revisa tu señal e intenta otra vez.");
      return;
    }
    setListo({ tipo });
  };

  const elegirTipo = (id) => {
    setTipo(id);
    setError("");
  };

  if (listo) {
    const urgente = tipoIncidente(listo.tipo)?.urgente;
    return (
      <>
        <div className="pt-card ch-listo">
          <CheckCircle aria-hidden="true" weight="fill" />
          <strong>Reporte enviado</strong>
          <span>La oficina ya lo tiene. Si necesitan algo más, te llaman.</span>
        </div>
        {urgente && (
          <div className="ch-urgente">
            <strong>Si todavía no hablaste con la oficina, llama ahora.</strong>
            <BotonLlamar />
          </div>
        )}
        <Link href="/chofer" className="pt-btn ch-boton-sec" style={{ marginTop: "1rem" }}>
          <ArrowLeft aria-hidden="true" /> Volver a mi ruta
        </Link>
      </>
    );
  }

  const camino = TIPOS_INCIDENTE.filter((t) => t.grupo === "camino");
  const contenedor = TIPOS_INCIDENTE.filter((t) => t.grupo === "contenedor");
  const boton = (t) => {
    const Icono = ICONOS[t.id] || ChatCircleText;
    return (
      <button
        key={t.id}
        type="button"
        className={`ch-tipo ${t.urgente ? "urgente" : ""} ${tipo === t.id ? "activo" : ""}`}
        onClick={() => elegirTipo(t.id)}
        aria-pressed={tipo === t.id}
      >
        <Icono aria-hidden="true" weight={tipo === t.id ? "fill" : "regular"} />
        {t.texto}
        <span className="ch-tipo-ayuda">{t.ayuda}</span>
      </button>
    );
  };

  return (
    <>
      <Link href={paradaInicial ? `/chofer/recoleccion/${paradaInicial}` : "/chofer"} className="pt-btn ch-volver">
        <ArrowLeft /> {paradaInicial ? "Volver a la parada" : "Mi ruta"}
      </Link>

      <div className="pt-page-head ch-encabezado">
        <h1>Reportar un problema</h1>
        <p>Le llega a la oficina al momento.</p>
      </div>

      <h2 className="ch-grupo">En el camino</h2>
      <div className="ch-tipos">{camino.map(boton)}</div>

      {tipo === "accidente" && (
        <div className="ch-urgente" role="alert">
          <strong>¿Hay alguien herido? Llama primero al 911.</strong>
          Después llama a la oficina. Este reporte es para que quede por escrito,
          no reemplaza la llamada.
          <BotonLlamar />
        </div>
      )}

      <h2 className="ch-grupo">Contenedor</h2>
      <div className="ch-tipos">{contenedor.map(boton)}</div>

      {tipo && (
        <div className="pt-card" style={{ marginTop: "1.1rem" }}>
          {tipo === "retraso" && (
            <>
              <span className="ch-etiqueta" style={{ marginTop: 0 }}>¿Cuánto retraso, más o menos?</span>
              <div className="ch-minutos">
                {MINUTOS_RAPIDOS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`pt-btn ${Number(minutos) === m ? "activo" : ""}`}
                    onClick={() => setMinutos(String(m))}
                    aria-pressed={Number(minutos) === m}
                  >
                    {m} min
                  </button>
                ))}
              </div>
              <input
                className="pt-input"
                type="number"
                inputMode="numeric"
                min="1"
                max="1440"
                value={minutos}
                onChange={(e) => setMinutos(e.target.value)}
                placeholder="Otro: minutos"
                aria-label="Minutos de retraso"
              />
            </>
          )}

          <label className="ch-etiqueta" htmlFor="parada-rep" style={tipo === "retraso" ? undefined : { marginTop: 0 }}>
            ¿En qué parada? <small>{deContenedor ? "(la del contenedor)" : "(si fue en una)"}</small>
          </label>
          <select
            id="parada-rep"
            className="pt-input"
            value={paradaId}
            onChange={(e) => setParadaId(e.target.value)}
            style={{ minHeight: 48 }}
          >
            <option value="">{deContenedor ? "Elige la parada" : "En el camino, ninguna"}</option>
            {paradas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.cliente} · {p.folio}
              </option>
            ))}
          </select>

          {deContenedor && parada && (
            <>
              <span className="ch-etiqueta" id="cont-rep">¿Cuál contenedor?</span>
              <div className="ch-opciones" role="radiogroup" aria-labelledby="cont-rep">
                {contenedores.map((c) => (
                  <label key={c.id} className={`ch-opcion ${contenedorId === c.id ? "activa" : ""}`}>
                    <input
                      type="radio"
                      name="contenedor-rep"
                      checked={contenedorId === c.id}
                      onChange={() => setContenedorId(c.id)}
                    />
                    <span>
                      <strong style={{ fontFamily: "var(--fuente-mono, monospace)" }}>{c.codigo}</strong>
                      {[c.tipo, c.medida].filter(Boolean).length ? ` · ${[c.tipo, c.medida].filter(Boolean).join(" · ")}` : ""}
                    </span>
                  </label>
                ))}
                <label className={`ch-opcion ${contenedorId === "" ? "activa" : ""}`}>
                  <input
                    type="radio"
                    name="contenedor-rep"
                    checked={contenedorId === ""}
                    onChange={() => setContenedorId("")}
                  />
                  {contenedores.length ? "No sé cuál / no tiene código" : "Este punto no tiene contenedores registrados"}
                </label>
              </div>
            </>
          )}

          <label className="ch-etiqueta" htmlFor="desc-rep">
            ¿Qué pasó? {tipo === "otro" ? "(obligatorio)" : <small>(opcional)</small>}
          </label>
          <textarea
            id="desc-rep"
            className="pt-input"
            rows={3}
            maxLength={LIMITES_REPORTE.descripcion}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder={EJEMPLOS[tipo] || ""}
          />

          <span className="ch-etiqueta">Foto <small>(opcional)</small></span>
          <input ref={refFoto} type="file" accept="image/*" capture="environment" hidden onChange={tomarFoto} />
          <button
            type="button"
            className="pt-btn ch-boton-sec"
            onClick={() => refFoto.current?.click()}
            disabled={subiendo}
          >
            <Camera aria-hidden="true" /> {subiendo ? "Subiendo la foto…" : foto ? "Tomar otra foto" : "Tomar foto"}
          </button>
          {foto?.url && <img src={foto.url} alt="Foto del problema" className="ch-foto-mini" />}

          {/* Se dice si va con ubicación o no; no se pide permiso dos veces
              ni se detiene el reporte por eso. */}
          <div className="ch-gps-linea">
            <MapPin aria-hidden="true" weight={lectura ? "fill" : "regular"} />
            {lectura
              ? esConfiable(lectura)
                ? `Va con tu ubicación (±${lectura.precision_m} m).`
                : `Va con tu ubicación aproximada (±${lectura.precision_m} m).`
              : estadoGps === "pidiendo"
                ? "Buscando tu ubicación…"
                : "Va sin ubicación (el teléfono no la dio)."}
          </div>

          {error && <div className="ch-error" role="alert">{error}</div>}

          <button
            type="button"
            className="pt-btn pt-btn-verde ch-boton-grande"
            style={{ width: "100%", justifyContent: "center", marginTop: "1rem" }}
            onClick={enviar}
            disabled={enviando || subiendo}
          >
            {enviando ? "Enviando…" : "Mandar reporte a la oficina"}
          </button>
        </div>
      )}
    </>
  );
}
