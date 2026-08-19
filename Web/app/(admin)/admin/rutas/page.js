"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { FiPlus, FiSave, FiMapPin, FiTrash2 } from "react-icons/fi";
import { TIPOS_RUTA, DIAS_SEMANA, nombreTipoRuta } from "@/lib/rutas-datos";
import {
  listarRutas,
  guardarRuta,
  crearRuta,
  borrarRuta,
  alternarRutaActiva,
} from "@/lib/datos-rutas";
import { UNIDADES } from "@/lib/cotizacion-datos";

const MapaZonas = dynamic(() => import("@/components/MapaZonas"), {
  ssr: false,
  loading: () => <div className="mc-mapa" style={{ height: 420 }} />,
});

const COLORES = ["#4EB34A", "#DB652D", "#3FA9C9", "#B37ACB"];

const SIN_PUNTOS = [];

export default function RutasAdmin() {
  const [rutas, setRutas] = useState([]);
  const [seleccion, setSeleccion] = useState("");
  const [dibujando, setDibujando] = useState(false);
  const [trazo, setTrazo] = useState([]);
  const [cargando, setCargando] = useState(true);
  // null | "sucio" | "guardando" | "guardado" | "error"
  const [guardado, setGuardado] = useState(null);
  const [aviso, setAviso] = useState("");
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);

  // Traer las rutas de la base al abrir la pantalla.
  useEffect(() => {
    let vivo = true;
    listarRutas().then((lista) => {
      if (!vivo) return;
      setRutas(lista);
      setSeleccion((actual) => actual || lista[0]?.id || "");
      setCargando(false);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const ruta = rutas.find((r) => r.id === seleccion);

  const zonas = useMemo(() => {
    const base = rutas.filter((r) => r.activa).map((r, i) => ({
      id: r.id,
      nombre: r.nombre,
      poligono: r.zona,
      color: r.id === seleccion ? "#7cc576" : COLORES[i % COLORES.length],
    }));
    if (dibujando && trazo.length >= 3) {
      base.push({ id: "__nueva", nombre: "Zona nueva", poligono: trazo, color: "#DB652D" });
    }
    return base;
  }, [rutas, seleccion, dibujando, trazo]);

  // Memorizado: si naciera nuevo en cada render, el mapa se repintaría de más.
  const puntosTrazo = useMemo(
    () => (dibujando ? trazo.map((p, i) => ({ lat: p[0], lng: p[1], titulo: `Punto ${i + 1}` })) : SIN_PUNTOS),
    [dibujando, trazo]
  );

  // Los cambios se quedan en pantalla hasta que se pulsa Guardar. Escribir en
  // la base con cada tecla sería una llamada por letra tecleada.
  const cambia = (campo, valor) => {
    setRutas(rutas.map((r) => (r.id === seleccion ? { ...r, [campo]: valor } : r)));
    setGuardado("sucio");
  };

  /** Manda a la base la ruta que se está editando. */
  const guardar = async (rutaAGuardar = ruta) => {
    if (!rutaAGuardar) return;
    setGuardado("guardando");
    const r = await guardarRuta(rutaAGuardar);
    setGuardado(r.ok ? "guardado" : "error");
  };

  const alternaDia = (dia) => {
    if (!ruta) return;
    const dias = ruta.dias.includes(dia)
      ? ruta.dias.filter((d) => d !== dia)
      : [...ruta.dias, dia];
    // Se reordena según DIAS_SEMANA para que siempre salgan en orden natural.
    cambia("dias", DIAS_SEMANA.filter((d) => dias.includes(d)));
  };

  /**
   * Dibujar una zona sí se guarda de inmediato: es una acción deliberada y
   * costosa de repetir. Perder un trazo de veinte clics por no haber pulsado
   * Guardar después sería una crueldad.
   */
  const guardarZona = async () => {
    if (trazo.length < 3) return;
    const actualizada = { ...ruta, zona: trazo };
    setRutas(rutas.map((r) => (r.id === seleccion ? actualizada : r)));
    setTrazo([]);
    setDibujando(false);
    await guardar(actualizada);
  };

  /**
   * Alta de ruta. Nace SIN zona: hasta que alguien se la dibuje, no cubre a
   * nadie, que es justo lo correcto (más vale no cubrir que prometer de más).
   */
  /** Cierra o reabre la ruta seleccionada. */
  const alternarActiva = async () => {
    if (!ruta) return;
    setAviso("");
    setGuardado("guardando");
    const r = await alternarRutaActiva(ruta.id, !ruta.activa);
    if (!r.ok) {
      setAviso(r.motivo);
      setGuardado("error");
      return;
    }
    setRutas(rutas.map((x) => (x.id === ruta.id ? { ...x, activa: !x.activa } : x)));
    setGuardado("guardado");
  };

  /** Borra la ruta seleccionada, si nadie depende de ella. */
  const eliminar = async () => {
    if (!ruta) return;
    setAviso("");
    setGuardado("guardando");
    const r = await borrarRuta(ruta);
    if (!r.ok) {
      setAviso(r.motivo);
      setGuardado("error");
      setConfirmarBorrado(false);
      return;
    }
    const quedan = rutas.filter((x) => x.id !== ruta.id);
    setRutas(quedan);
    setSeleccion(quedan[0]?.id ?? null);
    setConfirmarBorrado(false);
    setGuardado(null);
  };

  const nuevaRuta = async () => {
    setAviso("");
    setGuardado("guardando");
    const r = await crearRuta(rutas);
    if (!r.ok) {
      // Antes esto solo pintaba "error" en chiquito y se pasaba de largo:
      // parecía que la ruta se había creado cuando no.
      setAviso(r.motivo || "No se pudo crear la ruta. Vuelve a intentarlo.");
      setGuardado("error");
      return;
    }
    setRutas([...rutas, r.ruta]);
    setSeleccion(r.ruta.id);
    setDibujando(false);
    setTrazo([]);
    setGuardado("guardado");
  };

  return (
    <>
      <div className="pt-page-head">
        <h1>Rutas</h1>
        <p>Define los días, la unidad y la zona que cubre cada ruta.</p>
      </div>

      <div className="pt-grid pt-grid-mapa">
        <div className="pt-card">
          <div className="pt-card-head">
            <h2>Mapa de zonas</h2>
            {!dibujando ? (
              <button type="button" className="pt-btn" onClick={() => { setDibujando(true); setTrazo([]); }}>
                <FiPlus /> Dibujar zona
              </button>
            ) : (
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                <button type="button" className="pt-btn" onClick={() => setTrazo(trazo.slice(0, -1))} disabled={!trazo.length}>
                  Deshacer
                </button>
                <button type="button" className="pt-btn pt-btn-naranja" onClick={guardarZona} disabled={trazo.length < 3}>
                  <FiSave /> Guardar zona
                </button>
                <button type="button" className="pt-btn" onClick={() => { setDibujando(false); setTrazo([]); }}>
                  Cancelar
                </button>
              </div>
            )}
          </div>

          <MapaZonas
            zonas={zonas}
            puntos={puntosTrazo}
            onPin={dibujando ? (c) => setTrazo((t) => [...t, c]) : null}
            alto="480px"
          />
          <p className="mc-mapa-nota">
            {dibujando
              ? `Toca el mapa para ir marcando las esquinas de la zona. Llevas ${trazo.length} (mínimo 3).`
              : "Selecciona una ruta para resaltar su zona, o dibuja una nueva."}
          </p>
        </div>

        <div className="pt-card">
          <div className="pt-card-head">
            <h2>Rutas</h2>
            <button type="button" className="pt-btn pt-btn-verde" onClick={nuevaRuta}>
              <FiPlus /> Nueva ruta
            </button>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1rem" }}>
            {rutas.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`pt-btn ${r.id === seleccion ? "pt-btn-naranja" : ""}`}
                style={{ padding: "0.4rem 0.7rem", fontSize: "0.84rem" }}
                onClick={() => {
                  setSeleccion(r.id);
                  // Que no se quede el "Guardado" de la ruta anterior.
                  setGuardado(null);
                  setAviso("");
                  setConfirmarBorrado(false);
                }}
              >
                {/* Una ruta cerrada tiene que verse cerrada en la lista: si no,
                    se busca en el mapa, no aparece, y parece que se borró. */}
                {r.nombre}
                {!r.activa && (
                  <span style={{ opacity: 0.75, marginLeft: 6, fontSize: "0.78rem" }}>· cerrada</span>
                )}
              </button>
            ))}
          </div>

          {cargando && (
            <p style={{ fontSize: "0.86rem", color: "var(--mc-gris)" }}>Cargando rutas…</p>
          )}
          {!cargando && rutas.length === 0 && (
            <p style={{ fontSize: "0.86rem", color: "var(--mc-gris)" }}>
              Todavía no hay rutas. Crea la primera con <strong>Nueva ruta</strong> y
              dibújale su zona en el mapa.
            </p>
          )}

          {ruta && (
            <>
              <div className="pt-campo">
                <label>Nombre</label>
                <input className="pt-input" value={ruta.nombre} onChange={(e) => cambia("nombre", e.target.value)} style={{ width: "100%" }} />
              </div>

              <div className="pt-campo">
                <label>Tipo de ruta</label>
                <select className="pt-input" value={ruta.tipo} onChange={(e) => cambia("tipo", e.target.value)} style={{ width: "100%" }}>
                  {TIPOS_RUTA.map((t) => (
                    <option key={t.id} value={t.id}>{t.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="pt-campo">
                <label>Unidad</label>
                <select className="pt-input" value={ruta.unidad} onChange={(e) => cambia("unidad", e.target.value)} style={{ width: "100%" }}>
                  {UNIDADES.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>

              <div className="pt-campo">
                <label>Días</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                  {DIAS_SEMANA.map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={`pt-btn ${ruta.dias.includes(d) ? "pt-btn-naranja" : ""}`}
                      style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem" }}
                      onClick={() => alternaDia(d)}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-campo">
                <label>Chofer</label>
                <input
                  className="pt-input"
                  value={ruta.chofer}
                  onChange={(e) => cambia("chofer", e.target.value)}
                  placeholder="Nombre del chofer"
                  style={{ width: "100%" }}
                />
              </div>

              <div className="pt-campo">
                <label>Cupo por día</label>
                <input
                  className="pt-input"
                  type="number"
                  min="1"
                  value={ruta.cupo}
                  onChange={(e) => cambia("cupo", Number(e.target.value) || 1)}
                  style={{ width: "100%" }}
                />
              </div>

              {ruta.zona.length < 3 ? (
                <p style={{ fontSize: "0.82rem", color: "#f0895c", display: "flex", gap: 7, alignItems: "flex-start" }}>
                  <FiMapPin aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
                  Esta ruta todavía no tiene zona dibujada, así que no le aparece a
                  ningún cliente. Usa <strong>Dibujar zona</strong> en el mapa.
                </p>
              ) : (
                <p style={{ fontSize: "0.8rem", color: "var(--mc-gris)" }}>
                  {nombreTipoRuta(ruta.tipo)} · {ruta.zona.length} vértices en su zona
                  {ruta.chofer ? ` · chofer ${ruta.chofer}` : " · sin chofer asignado"}
                </p>
              )}

              {/* Guardar explícito: con base de datos, el usuario necesita ver
                  que lo suyo quedó grabado, no suponerlo. */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", marginTop: "0.9rem" }}>
                <button
                  type="button"
                  className="pt-btn pt-btn-naranja"
                  onClick={() => guardar()}
                  disabled={guardado === "guardando" || guardado === "guardado"}
                >
                  {guardado === "guardando" ? "Guardando…" : "Guardar cambios"}
                </button>
                {guardado === "guardado" && (
                  <span style={{ fontSize: "0.82rem", color: "var(--mc-verde-claro)" }}>
                    Guardado
                  </span>
                )}
                {guardado === "sucio" && (
                  <span style={{ fontSize: "0.82rem", color: "#f0895c" }}>
                    Hay cambios sin guardar
                  </span>
                )}
                {guardado === "error" && !aviso && (
                  <span style={{ fontSize: "0.82rem", color: "#ef8080" }}>
                    No se pudo guardar. Revisa tu conexión.
                  </span>
                )}
              </div>

              {/* Un fallo al crear o borrar no puede quedarse en una palabra
                  chiquita: se dice completo y en su propio recuadro. */}
              {aviso && (
                <div className="pt-login-error" role="alert" style={{ marginTop: "0.9rem" }}>
                  {aviso}
                </div>
              )}

              {/* ---------- Cerrar / reabrir y eliminar ---------- */}
              <div
                style={{
                  marginTop: "1.4rem",
                  paddingTop: "1rem",
                  borderTop: "1px solid var(--mc-linea)",
                  display: "flex",
                  gap: "0.6rem",
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <button type="button" className="pt-btn" onClick={alternarActiva}>
                  {ruta.activa ? "Cerrar ruta" : "Reabrir ruta"}
                </button>

                {!confirmarBorrado ? (
                  <button
                    type="button"
                    className="pt-btn"
                    onClick={() => { setAviso(""); setConfirmarBorrado(true); }}
                  >
                    <FiTrash2 /> Eliminar
                  </button>
                ) : (
                  <>
                    <span style={{ fontSize: "0.86rem" }}>
                      ¿Eliminar <strong>{ruta.nombre}</strong>? No se puede deshacer.
                    </span>
                    <button type="button" className="pt-btn pt-btn-naranja" onClick={eliminar}>
                      Sí, eliminar
                    </button>
                    <button type="button" className="pt-btn" onClick={() => setConfirmarBorrado(false)}>
                      Cancelar
                    </button>
                  </>
                )}
              </div>

              <p style={{ margin: "0.7rem 0 0", fontSize: "0.84rem", color: "var(--mc-gris)" }}>
                {ruta.activa
                  ? "Cerrar una ruta la quita del mapa de cobertura: quien viva ahí pasa a «fuera de cobertura». No se pierde nada y se puede reabrir."
                  : "Esta ruta está cerrada: no aparece en el mapa de cobertura ni en la página pública."}
                {" "}Eliminar solo se permite si ningún cliente ni servicio depende de ella.
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
