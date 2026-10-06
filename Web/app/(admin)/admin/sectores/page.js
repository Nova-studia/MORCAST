"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowsClockwise, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { listarSectores, listarPuntos, recalcularSectores } from "@/lib/datos-sectores";
import { cambiosDeSector, tieneZona } from "@/lib/sectores.mjs";
import { tieneUbicacion } from "@/lib/mapas.mjs";
import SectorEditor from "@/components/admin/SectorEditor";
import PuntoEditor from "@/components/admin/PuntoEditor";
import PestanasMapa from "@/components/admin/PestanasMapa";

/**
 * SECTORES Y PUNTOS (pedido de los dueños, 4-oct-2026).
 *
 * Dos pestañas sobre los MISMOS datos: en "Sectores" se dibujan los límites
 * de A, B, C y D; en "Puntos" se pone el pin exacto de cada domicilio. Las dos
 * cambian a qué sector pertenece un punto, así que los datos viven aquí y no
 * en cada pestaña: si vivieran abajo, dibujar un sector no movería los
 * conteos de la otra pestaña hasta recargar.
 *
 * Situación inicial real: los cuatro sectores nacen sin límites (db/023) y
 * los 70 puntos sin coordenadas. La pantalla lo dice en grande en vez de
 * enseñar un mapa vacío sin explicación.
 */

const ESTILO_AVISO = {
  display: "flex",
  gap: "0.75rem",
  alignItems: "flex-start",
  flexWrap: "wrap",
  background: "var(--pt-alerta-tinte)",
  border: "1px solid rgba(214, 164, 74, 0.4)",
  borderRadius: "var(--mc-radio)",
  padding: "0.85rem 1rem",
  marginBottom: "1.1rem",
  fontSize: "0.88rem",
  lineHeight: 1.5,
};

export default function SectoresAdmin() {
  const [sectores, setSectores] = useState([]);
  const [puntos, setPuntos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [pestana, setPestana] = useState("sectores");
  // { tipo: "ok" | "error", texto } del botón de recalcular.
  const [recalculo, setRecalculo] = useState(null);
  const [recalculando, setRecalculando] = useState(false);

  useEffect(() => {
    let vivo = true;
    Promise.all([listarSectores(), listarPuntos()]).then(([s, p]) => {
      if (!vivo) return;
      setSectores(s);
      setPuntos(p);
      setCargando(false);
    });
    return () => { vivo = false; };
  }, []);

  // `?ver=puntos` (la pestaña "Puntos" desde Rutas) abre directo en Puntos.
  // Se lee aquí y no con useSearchParams para no partir la página en Suspense.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("ver") === "puntos") setPestana("puntos");
  }, []);

  const sinLimites = sectores.filter((s) => !tieneZona(s));
  // Puntos cuyo sector guardado ya no coincide con su pin y los límites
  // actuales. Pasa sobre todo con los pines que deja el chofer desde su
  // teléfono: la base los guarda, pero el sector se calcula aquí.
  const desactualizados = useMemo(() => cambiosDeSector(puntos, sectores), [puntos, sectores]);

  /**
   * Recalcula y guarda el sector de los puntos que lo tengan mal, y refleja
   * en pantalla SOLO lo que la base confirmó. La usan el botón general y el
   * guardado de un sector.
   */
  const recalcular = async (sectoresBase = sectores, puntosBase = puntos) => {
    const r = await recalcularSectores(puntosBase, sectoresBase);
    if (r.cambios.length) {
      const nuevo = new Map(r.cambios.map((c) => [c.id, c.despues]));
      setPuntos((lista) => lista.map((p) => (nuevo.has(p.id) ? { ...p, sectorId: nuevo.get(p.id) } : p)));
    }
    return r;
  };

  const recalcularTodo = async () => {
    setRecalculando(true);
    setRecalculo(null);
    const r = await recalcular();
    setRecalculando(false);
    if (!r.ok) {
      setRecalculo({ tipo: "error", texto: r.motivo || "No se pudo recalcular. Revisa tu conexión." });
      return;
    }
    setRecalculo({
      tipo: "ok",
      texto: r.actualizados
        ? `Listo: ${r.actualizados} ${r.actualizados === 1 ? "punto cambió" : "puntos cambiaron"} de sector.`
        : "Listo: todos los puntos ya estaban en su sector.",
    });
  };

  /** Un sector guardó sus límites: se actualiza y se reacomodan los puntos. */
  const alGuardarSector = async (sectorId, zona) => {
    const nuevos = sectores.map((s) => (s.id === sectorId ? { ...s, zona } : s));
    setSectores(nuevos);
    setRecalculo(null);
    return recalcular(nuevos, puntos);
  };

  /** Un punto guardó su ubicación o sus referencias. */
  const alGuardarPunto = (puntoId, cambios) => {
    setPuntos((lista) => lista.map((p) => (p.id === puntoId ? { ...p, ...cambios } : p)));
  };

  const sinUbicacion = puntos.filter((p) => !tieneUbicacion(p)).length;

  return (
    <>
      <div className="pt-page-head">
        <h1>Rutas, sectores y puntos</h1>
        <p>
          Dibuja los límites de los sectores A, B, C y D, y pon el pin exacto de cada punto de
          recolección. El sector de cada punto se calcula solo.
        </p>
      </div>

      {/* Arriba de los avisos, en el mismo lugar que en Rutas: si quedaran
          debajo, las pestañas "brincarían" al pasar de una pantalla a otra. */}
      <PestanasMapa
        actual={pestana}
        onCambiar={setPestana}
        locales={["sectores", "puntos"]}
        etiquetas={cargando ? {} : { puntos: `Puntos (${puntos.length})` }}
      />

      {cargando && <p style={{ fontSize: "0.86rem", color: "var(--mc-gris)" }}>Cargando sectores y puntos…</p>}

      {!cargando && sectores.length === 0 && (
        <div className="pt-login-error" role="alert">
          No se pudieron leer los sectores. Si la base es nueva, falta correr la migración
          db/023-operacion-ampliada.sql.
        </div>
      )}

      {!cargando && sectores.length > 0 && (
        <>
          {/* La situación inicial real: se dice qué falta y qué significa,
              no solo "no hay datos". */}
          {sinLimites.length > 0 && (
            <div role="note" style={ESTILO_AVISO}>
              <WarningCircle size={20} weight="fill" style={{ color: "var(--pt-alerta)", flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1, minWidth: 220 }}>
                {sinLimites.length === sectores.length ? (
                  <>
                    <strong>Los sectores todavía no tienen límites.</strong> Mientras no se
                    dibujen, ningún punto tiene sector y el filtro por sector de Clientes sale
                    vacío. Elige un sector en la pestaña <em>Sectores</em> y marca sus esquinas en
                    el mapa.
                  </>
                ) : (
                  <>
                    <strong>
                      {sinLimites.length === 1
                        ? `Al ${sinLimites[0].nombre} le faltan sus límites.`
                        : `A ${sinLimites.map((s) => s.nombre).join(", ")} les faltan sus límites.`}
                    </strong>{" "}
                    Los puntos que queden ahí no tendrán sector hasta que se dibujen.
                  </>
                )}
                {sinUbicacion > 0 && (
                  <> Además, {sinUbicacion} de {puntos.length} puntos no tienen ubicación: sin pin no hay sector.</>
                )}
              </div>
            </div>
          )}

          {desactualizados.length > 0 && (
            <div role="note" style={ESTILO_AVISO}>
              <ArrowsClockwise size={20} style={{ color: "var(--pt-alerta)", flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1, minWidth: 220 }}>
                <strong>
                  {desactualizados.length === 1
                    ? "1 punto tiene el sector desactualizado."
                    : `${desactualizados.length} puntos tienen el sector desactualizado.`}
                </strong>{" "}
                Suele pasar con las ubicaciones que guarda el chofer desde su teléfono.
              </div>
              <button type="button" className="pt-btn" onClick={recalcularTodo} disabled={recalculando}>
                <ArrowsClockwise /> {recalculando ? "Recalculando…" : "Recalcular ahora"}
              </button>
            </div>
          )}

          {recalculo && (
            <div
              role={recalculo.tipo === "error" ? "alert" : "status"}
              className={recalculo.tipo === "error" ? "pt-login-error" : undefined}
              style={recalculo.tipo === "ok" ? { color: "var(--pt-ok)", fontSize: "0.86rem", marginBottom: "1rem" } : undefined}
            >
              {recalculo.texto}
            </div>
          )}


          {/* Solo se monta la pestaña visible: un mapa de Leaflet que nace
              escondido calcula mal su tamaño y sale gris. */}
          {pestana === "sectores" ? (
            <SectorEditor
              sectores={sectores}
              puntos={puntos}
              onGuardar={alGuardarSector}
              onRecalcular={recalcularTodo}
              recalculando={recalculando}
            />
          ) : (
            <PuntoEditor sectores={sectores} puntos={puntos} onGuardado={alGuardarPunto} />
          )}
        </>
      )}
    </>
  );
}
