"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { PencilSimple, FloppyDisk, ArrowCounterClockwise, Eraser, X, ArrowsClockwise } from "@phosphor-icons/react/dist/ssr";
import { guardarZonaSector } from "@/lib/datos-sectores";
import { conteoPorSector, sectorDePunto, tieneZona, dentroDeMatamoros } from "@/lib/sectores.mjs";
import { tieneUbicacion } from "@/lib/mapas.mjs";
import SectorInsignia from "@/components/admin/SectorInsignia";

const SectorMapa = dynamic(() => import("@/components/admin/SectorMapa"), {
  ssr: false,
  loading: () => <div className="mc-mapa" style={{ height: 480 }} />,
});

// Un punto con pin que no cae en ningún sector se pinta en el color de
// ALERTA: es justo lo que el dueño tiene que ver para saber por dónde le
// falta cerrar un borde. Hex porque Leaflet no lee var(--…).
const ALERTA = "#D6A44A";

/**
 * Pestaña SECTORES de /admin/sectores: el mapa con los cuatro sectores y el
 * dibujo de los límites de uno.
 *
 * Sigue el enfoque de /admin/rutas (clic para agregar esquinas, Deshacer,
 * Guardar), con dos diferencias pensadas para los dueños:
 *  - "Editar" arranca con las esquinas que ya tenía el sector, y cada una se
 *    puede ARRASTRAR. Corregir un borde no obliga a redibujar todo.
 *  - Guardar los límites recalcula de una vez el sector de los puntos.
 */
export default function SectorEditor({ sectores, puntos, onGuardar, onRecalcular, recalculando }) {
  const [seleccion, setSeleccion] = useState(sectores[0]?.id || "");
  const [dibujando, setDibujando] = useState(false);
  const [trazo, setTrazo] = useState([]);
  const [guardando, setGuardando] = useState(false);
  // { tipo: "ok" | "error", texto }
  const [mensaje, setMensaje] = useState(null);

  const sector = sectores.find((s) => s.id === seleccion);

  // Mientras se dibuja, los conteos se hacen con el trazo en lugar del
  // polígono guardado: así se ve cuántos puntos va a abarcar ANTES de guardar.
  const sectoresVivos = useMemo(
    () => (dibujando ? sectores.map((s) => (s.id === seleccion ? { ...s, zona: trazo } : s)) : sectores),
    [sectores, dibujando, seleccion, trazo]
  );
  const conteo = useMemo(() => conteoPorSector(puntos, sectoresVivos), [puntos, sectoresVivos]);

  const zonas = useMemo(
    () =>
      sectores
        // El que se está dibujando no se pinta con su forma vieja: se vería
        // doble y no se sabría cuál es cuál.
        .filter((s) => !(dibujando && s.id === seleccion))
        .map((s) => ({ id: s.id, nombre: s.nombre, color: s.color, poligono: s.zona, resaltada: s.id === seleccion })),
    [sectores, dibujando, seleccion]
  );

  const marcas = useMemo(
    () =>
      puntos.filter(tieneUbicacion).map((p) => {
        const s = sectorDePunto(p, sectoresVivos);
        return {
          lat: p.lat,
          lng: p.lng,
          color: s ? s.color : ALERTA,
          titulo: `${p.empresa} · ${p.alias}${s ? ` · ${s.nombre}` : " · en ningún sector"}`,
        };
      }),
    [puntos, sectoresVivos]
  );

  const elegir = (id) => {
    if (dibujando && id !== seleccion) {
      if (!window.confirm("Estás dibujando un sector. ¿Descartar lo que llevas?")) return;
      setDibujando(false);
      setTrazo([]);
    }
    setSeleccion(id);
    setMensaje(null);
  };

  const empezar = () => {
    if (!sector) return;
    // Editar = partir de las esquinas que ya tiene, no de cero.
    setTrazo(tieneZona(sector) ? sector.zona.map((v) => [v[0], v[1]]) : []);
    setDibujando(true);
    setMensaje(null);
  };

  const cancelar = () => {
    setDibujando(false);
    setTrazo([]);
  };

  const guardar = async () => {
    if (!sector) return;
    if (trazo.length > 0 && trazo.length < 3) return;
    if (trazo.some((v) => !dentroDeMatamoros(v[0], v[1]))) {
      setMensaje({ tipo: "error", texto: "Una de las esquinas quedó fuera de Matamoros. Muévela o quítala con Deshacer." });
      return;
    }
    if (
      trazo.length === 0 &&
      !window.confirm(`¿Quitarle los límites al ${sector.nombre}? Sus puntos se quedarán sin sector.`)
    ) {
      return;
    }

    setGuardando(true);
    setMensaje(null);
    // Se redondea a 6 decimales (~10 cm): más precisión no existe en un clic
    // sobre el mapa y solo engorda el jsonb.
    const zona = trazo.map(([la, ln]) => [Number(la.toFixed(6)), Number(ln.toFixed(6))]);
    const r = await guardarZonaSector(sector.id, zona);
    if (!r.ok) {
      // El trazo NO se pierde: sigue en pantalla para volver a intentar.
      setGuardando(false);
      setMensaje({ tipo: "error", texto: r.motivo || "No se pudieron guardar los límites. Revisa tu conexión." });
      return;
    }

    setDibujando(false);
    setTrazo([]);
    const rec = await onGuardar(sector.id, zona);
    setGuardando(false);
    const base = zona.length ? `Límites del ${sector.nombre} guardados.` : `Se quitaron los límites del ${sector.nombre}.`;
    if (!rec.ok) {
      setMensaje({ tipo: "error", texto: `${base} Pero el sector de los puntos no se pudo actualizar: ${rec.motivo}` });
      return;
    }
    setMensaje({
      tipo: "ok",
      texto: rec.actualizados
        ? `${base} ${rec.actualizados} ${rec.actualizados === 1 ? "punto cambió" : "puntos cambiaron"} de sector.`
        : `${base} Ningún punto cambió de sector.`,
    });
  };

  const puedeGuardar = trazo.length === 0 || trazo.length >= 3;

  return (
    <div className="pt-grid pt-grid-mapa">
      <div className="pt-card">
        <div className="pt-card-head" style={{ flexWrap: "wrap" }}>
          <h2>Mapa de sectores</h2>
          {!dibujando ? (
            <button type="button" className="pt-btn pt-btn-naranja" onClick={empezar} disabled={!sector}>
              <PencilSimple /> {sector && tieneZona(sector) ? `Editar límites del ${sector.nombre}` : `Dibujar el ${sector?.nombre || "sector"}`}
            </button>
          ) : (
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              <button type="button" className="pt-btn" onClick={() => setTrazo(trazo.slice(0, -1))} disabled={!trazo.length}>
                <ArrowCounterClockwise /> Deshacer
              </button>
              <button type="button" className="pt-btn" onClick={() => setTrazo([])} disabled={!trazo.length}>
                <Eraser /> Limpiar
              </button>
              <button type="button" className="pt-btn pt-btn-naranja" onClick={guardar} disabled={!puedeGuardar || guardando}>
                <FloppyDisk /> {guardando ? "Guardando…" : "Guardar límites"}
              </button>
              <button type="button" className="pt-btn" onClick={cancelar} disabled={guardando}>
                <X /> Cancelar
              </button>
            </div>
          )}
        </div>

        <SectorMapa
          zonas={zonas}
          puntos={marcas}
          vertices={dibujando ? trazo : undefined}
          onVertices={dibujando ? setTrazo : null}
          colorTrazo={sector?.color}
          enfoque={seleccion}
          alto="480px"
        />
        <p className="mc-mapa-nota">
          {dibujando
            ? `Toca el mapa para agregar esquinas del ${sector?.nombre} (llevas ${trazo.length}, mínimo 3). ` +
              "Arrastra una esquina para moverla; Deshacer quita la última."
            : "Cada punto se pinta del color de su sector; los amarillos no caen en ninguno."}
        </p>
        {dibujando && trazo.length > 0 && trazo.length < 3 && (
          <p className="mc-mapa-nota" style={{ color: "var(--pt-alerta)" }}>
            Faltan {3 - trazo.length} {3 - trazo.length === 1 ? "esquina" : "esquinas"} para cerrar el sector.
          </p>
        )}
      </div>

      <div className="pt-card">
        <div className="pt-card-head">
          <h2>Sectores</h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
          {sectores.map((s) => {
            const vivo = sectoresVivos.find((x) => x.id === s.id);
            const elegido = s.id === seleccion;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => elegir(s.id)}
                aria-pressed={elegido}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.7rem",
                  width: "100%",
                  textAlign: "left",
                  padding: "0.65rem 0.8rem",
                  borderRadius: 8,
                  border: `1px solid ${elegido ? "var(--pt-accion)" : "var(--mc-linea)"}`,
                  background: elegido ? "var(--pt-accion-tinte)" : "transparent",
                  color: "var(--mc-tinta)",
                  cursor: "pointer",
                }}
              >
                <SectorInsignia clave={s.clave} color={s.color} nombre={s.nombre} decorativa />
                <span style={{ flex: 1, fontWeight: 600 }}>{s.nombre}</span>
                {tieneZona(vivo) ? (
                  <span style={{ fontSize: "0.84rem", color: "var(--mc-gris)" }}>
                    {conteo.porSector[s.id] || 0} {conteo.porSector[s.id] === 1 ? "punto" : "puntos"}
                  </span>
                ) : (
                  <span className="pt-badge" style={{ background: "var(--pt-alerta-tinte)", color: "var(--pt-alerta)" }}>Sin límites</span>
                )}
              </button>
            );
          })}
        </div>

        <div
          style={{
            marginTop: "1rem",
            paddingTop: "0.9rem",
            borderTop: "1px solid var(--mc-linea)",
            fontSize: "0.86rem",
            display: "grid",
            gap: "0.35rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: "50%", background: ALERTA }} />
              Con pin, en ningún sector
            </span>
            <strong>{conteo.ninguno}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
            <span>Sin ubicación (sin pin)</span>
            <strong>{conteo.sinUbicacion}</strong>
          </div>
          {conteo.encimados > 0 && (
            <p style={{ margin: "0.3rem 0 0", color: "var(--pt-alerta)" }}>
              {conteo.encimados === 1 ? "1 punto cae" : `${conteo.encimados} puntos caen`} en dos sectores a la vez:
              se queda{conteo.encimados === 1 ? "" : "n"} con el primero (A antes que B…). Conviene revisar ese borde.
            </p>
          )}
          {conteo.sinUbicacion > 0 && (
            <p style={{ margin: "0.3rem 0 0", color: "var(--mc-gris)" }}>
              Los puntos sin ubicación se arreglan en la pestaña <strong>Puntos</strong>, o solos cuando el chofer
              guarda la ubicación en su primera visita.
            </p>
          )}
        </div>

        {mensaje && (
          <div
            role={mensaje.tipo === "error" ? "alert" : "status"}
            className={mensaje.tipo === "error" ? "pt-login-error" : undefined}
            style={
              mensaje.tipo === "ok"
                ? { color: "var(--pt-ok)", fontSize: "0.86rem", marginTop: "0.9rem" }
                : { marginTop: "0.9rem", marginBottom: 0 }
            }
          >
            {mensaje.texto}
          </div>
        )}

        <div style={{ marginTop: "1.1rem", paddingTop: "0.9rem", borderTop: "1px solid var(--mc-linea)" }}>
          <button
            type="button"
            className="pt-btn"
            onClick={onRecalcular}
            disabled={recalculando || dibujando}
            style={{ whiteSpace: "normal", textAlign: "left" }}
          >
            <ArrowsClockwise /> {recalculando ? "Recalculando…" : "Recalcular sectores de todos los puntos"}
          </button>
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem", color: "var(--mc-gris)" }}>
            Guardar unos límites o un pin ya lo hace solo. Úsalo si el chofer dejó ubicaciones nuevas desde su
            teléfono.
          </p>
        </div>
      </div>
    </div>
  );
}
