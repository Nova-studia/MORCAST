"use client";

import { useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { FloppyDisk, MagnifyingGlass, MapPin, ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import { guardarPunto } from "@/lib/datos-sectores";
import {
  estadoUbicacion,
  filtrarPuntos,
  sectorDePunto,
  leerCoordenadas,
  dentroDeMatamoros,
} from "@/lib/sectores.mjs";
import { tieneUbicacion, direccionDe, enlaceVerEnMapa } from "@/lib/mapas.mjs";
import SectorInsignia from "@/components/admin/SectorInsignia";
import BuscadorDireccion from "@/components/BuscadorDireccion";

const SectorMapa = dynamic(() => import("@/components/admin/SectorMapa"), {
  ssr: false,
  loading: () => <div className="mc-mapa" style={{ height: 340 }} />,
});

const FILTROS_UBICACION = [
  { id: "todos", texto: "Todos" },
  { id: "sin", texto: "Sin ubicación" },
  { id: "chofer", texto: "La puso el chofer" },
  { id: "cliente", texto: "Por revisar" },
  { id: "panel", texto: "La puso la oficina" },
];

/** "25.871230, -97.503110": el mismo formato que copia Google Maps. */
const textoCoordenadas = (pin) => (pin ? `${pin[0].toFixed(6)}, ${pin[1].toFixed(6)}` : "");

/** Fecha y hora en Matamoros, aunque la compu de la oficina tenga otra zona. */
function cuando(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Matamoros" });
}

/** El borrador de edición, a partir de lo guardado. */
function borradorDe(p) {
  const pin = p && tieneUbicacion(p) ? [Number(p.lat), Number(p.lng)] : null;
  return { pin, coordenadas: textoCoordenadas(pin), referencias: p?.referencias || "" };
}

/**
 * Pestaña PUNTOS de /admin/sectores: la lista de domicilios y, del elegido,
 * el pin exacto y las referencias para llegar.
 *
 * Por qué importa: hoy los 70 puntos tienen calle y colonia pero no
 * coordenadas, y en un parque industrial la dirección escrita deja al chofer
 * lejos de la puerta. Con el pin, "Cómo llegar" (lib/mapas.mjs) lo lleva al
 * lugar exacto, y el punto queda en su sector.
 */
export default function PuntoEditor({ sectores, puntos, onGuardado }) {
  const [filtros, setFiltros] = useState({ ubicacion: "todos", sector: "", texto: "" });
  const [seleccion, setSeleccion] = useState("");
  const [borrador, setBorrador] = useState(borradorDe(null));
  // Sube cada vez que se elige una dirección del buscador: cambia la clave
  // `enfoque` del mapa para que se acerque al pin nuevo.
  const [vueltaBusqueda, setVueltaBusqueda] = useState(0);
  const [errorCoord, setErrorCoord] = useState("");
  const [guardando, setGuardando] = useState(false);
  // { tipo: "ok" | "error", texto }
  const [mensaje, setMensaje] = useState(null);
  const detalle = useRef(null);

  const porId = useMemo(() => new Map(sectores.map((s) => [s.id, s])), [sectores]);
  const punto = puntos.find((p) => p.id === seleccion);
  const lista = useMemo(() => filtrarPuntos(puntos, filtros), [puntos, filtros]);
  const cuenta = useMemo(
    () => Object.fromEntries(FILTROS_UBICACION.map((f) => [f.id, filtrarPuntos(puntos, { ...filtros, ubicacion: f.id }).length])),
    [puntos, filtros]
  );

  const original = borradorDe(punto);
  const pinCambio =
    Boolean(borrador.pin) &&
    (!original.pin || borrador.pin[0] !== original.pin[0] || borrador.pin[1] !== original.pin[1]);
  const refsCambio = punto ? borrador.referencias.trim() !== (punto.referencias || "").trim() : false;
  // Pin que puso el cliente en su alta: la oficina lo puede dar por bueno sin
  // moverlo ("Confirmar ubicación"), y con eso pasa a ser de la oficina.
  const porRevisar = Boolean(punto && borrador.pin && estadoUbicacion(punto).id === "cliente");
  const sucio = pinCambio || refsCambio || porRevisar;

  // El sector que le tocará con el pin del borrador, para decirlo antes de guardar.
  const sectorNuevo = borrador.pin ? sectorDePunto({ lat: borrador.pin[0], lng: borrador.pin[1] }, sectores) : null;
  const zonas = useMemo(
    () => sectores.map((s) => ({ id: s.id, nombre: s.nombre, color: s.color, poligono: s.zona })),
    [sectores]
  );

  const elegir = (p) => {
    if (p.id === seleccion) return;
    if (sucio && !window.confirm("Hay cambios sin guardar en este punto. ¿Descartarlos?")) return;
    setSeleccion(p.id);
    setBorrador(borradorDe(p));
    setErrorCoord("");
    setMensaje(null);
    // En el teléfono el detalle queda debajo de la lista: se baja hasta él
    // para que el clic tenga una respuesta visible.
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 991.98px)").matches) {
      requestAnimationFrame(() => detalle.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  const ponerPin = (c) => {
    const pin = [Number(c[0].toFixed(6)), Number(c[1].toFixed(6))];
    setBorrador((b) => ({ ...b, pin, coordenadas: textoCoordenadas(pin) }));
    setErrorCoord("");
    setMensaje(null);
  };

  const leerCampoCoordenadas = () => {
    const texto = borrador.coordenadas.trim();
    if (!texto) return;
    const c = leerCoordenadas(texto);
    if (!c) {
      setErrorCoord("No se entendieron esas coordenadas o no caen en Matamoros. Deben verse así: 25.871230, -97.503110");
      return;
    }
    ponerPin(c);
  };

  const descartar = () => {
    setBorrador(borradorDe(punto));
    setErrorCoord("");
    setMensaje(null);
  };

  const guardar = async () => {
    if (!punto || !sucio) return;
    if (borrador.pin && !dentroDeMatamoros(borrador.pin[0], borrador.pin[1])) {
      setMensaje({ tipo: "error", texto: "Ese pin quedó fuera de Matamoros. Muévelo antes de guardar." });
      return;
    }
    // El sector se manda solo si cambió el pin o si el guardado estaba mal:
    // así una edición de referencias no toca nada más.
    const sectorId = borrador.pin ? sectorNuevo?.id ?? null : null;
    const mandarSector = pinCambio || (borrador.pin && sectorId !== punto.sectorId);

    setGuardando(true);
    setMensaje(null);
    const r = await guardarPunto(punto.id, {
      pin: pinCambio || porRevisar ? borrador.pin : undefined,
      referencias: refsCambio ? borrador.referencias : undefined,
      sectorId: mandarSector ? sectorId : undefined,
    });
    setGuardando(false);
    if (!r.ok) {
      setMensaje({ tipo: "error", texto: r.motivo || "No se pudo guardar. Revisa tu conexión." });
      return;
    }

    const f = r.fila || {};
    const cambios = {};
    if ("lat" in f) Object.assign(cambios, { lat: f.lat, lng: f.lng, origen: "panel", fecha: f.ubicacion_fecha });
    if ("referencias" in f) cambios.referencias = f.referencias || "";
    if ("sector_id" in f) cambios.sectorId = f.sector_id;
    onGuardado(punto.id, cambios);
    setMensaje({
      tipo: "ok",
      texto: borrador.pin
        ? `Guardado. ${sectorNuevo ? `Queda en el ${sectorNuevo.nombre}.` : "No cae en ningún sector todavía."}`
        : "Guardado.",
    });
  };

  const estado = punto ? estadoUbicacion(punto) : null;
  const sectorGuardado = punto?.sectorId ? porId.get(punto.sectorId) : null;
  // El enlace sigue al borrador: si se acaba de mover el pin, "Ver en Google
  // Maps" enseña el lugar nuevo, no el viejo.
  const paraEnlace = punto ? { ...punto, lat: borrador.pin?.[0] ?? null, lng: borrador.pin?.[1] ?? null } : null;

  return (
    <div className="pt-grid pt-grid-mapa">
      <div className="pt-card">
        <div className="pt-card-head" style={{ flexWrap: "wrap" }}>
          <h2>Puntos de recolección</h2>
          <span style={{ fontSize: "0.84rem", color: "var(--mc-gris)" }}>
            {lista.length} de {puntos.length}
          </span>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.8rem" }}>
          {FILTROS_UBICACION.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`pt-chip ${filtros.ubicacion === f.id ? "activo" : ""}`}
              aria-pressed={filtros.ubicacion === f.id}
              onClick={() => setFiltros({ ...filtros, ubicacion: f.id })}
            >
              {f.texto} ({cuenta[f.id]})
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
          <label style={{ position: "relative", flex: "1 1 220px" }}>
            <span className="pt-solo-lectores">Buscar</span>
            <MagnifyingGlass
              aria-hidden="true"
              style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--mc-gris)" }}
            />
            <input
              className="pt-input"
              type="search"
              placeholder="Empresa, calle, colonia…"
              value={filtros.texto}
              onChange={(e) => setFiltros({ ...filtros, texto: e.target.value })}
              style={{ width: "100%", paddingLeft: 32 }}
            />
          </label>
          <label style={{ flex: "0 0 auto" }}>
            <span className="pt-solo-lectores">Sector</span>
            <select
              className="pt-input"
              value={filtros.sector}
              onChange={(e) => setFiltros({ ...filtros, sector: e.target.value })}
              style={{ width: "auto", minWidth: 190 }}
            >
              <option value="">Todos los sectores</option>
              {sectores.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
              <option value="ninguno">Sin sector</option>
            </select>
          </label>
        </div>

        <div className="pt-tabla-wrap">
          {/* Sin el ancho mínimo de 620px de .pt-tabla: con dos columnas cabe
              en el teléfono sin scroll lateral. */}
          <table className="pt-tabla pt-tabla-compacta" style={{ minWidth: 0 }}>
            <thead>
              {/* Dos columnas y no cuatro: en el teléfono una tabla ancha
                  escondía detrás del scroll justo lo que se viene a ver
                  (sector y ubicación). La dirección va debajo del nombre. */}
              <tr>
                <th>Punto</th>
                <th style={{ textAlign: "right" }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => {
                const s = p.sectorId ? porId.get(p.sectorId) : null;
                const e = estadoUbicacion(p);
                const elegido = p.id === seleccion;
                return (
                  <tr
                    key={p.id}
                    onClick={() => elegir(p)}
                    style={{ cursor: "pointer", background: elegido ? "var(--pt-accion-tinte)" : undefined }}
                  >
                    <td>
                      {/* El botón es lo que se enfoca con el teclado; la fila
                          entera responde al clic para que sea fácil atinarle. */}
                      <button
                        type="button"
                        onClick={(ev) => { ev.stopPropagation(); elegir(p); }}
                        aria-pressed={elegido}
                        style={{ all: "unset", cursor: "pointer", display: "block" }}
                      >
                        <strong style={{ display: "block" }}>{p.empresa}</strong>
                        <span style={{ display: "block", fontSize: "0.8rem", color: "var(--mc-gris)" }}>
                          {p.alias}
                          {p.calle || p.colonia ? ` · ${[p.calle, p.colonia].filter(Boolean).join(", ")}` : ""}
                        </span>
                      </button>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
                        {s && <SectorInsignia clave={s.clave} color={s.color} nombre={s.nombre} chica />}
                        <span className={`pt-badge ${e.clase}`} title={e.texto}>{e.corto}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!lista.length && (
                <tr>
                  <td colSpan={2} className="pt-vacio">
                    {puntos.length ? "Ningún punto coincide con esos filtros." : "Todavía no hay puntos de recolección."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="pt-card" ref={detalle} style={{ scrollMarginTop: "5rem" }}>
        {!punto ? (
          <div className="pt-vacio" style={{ padding: "2.5rem 1rem" }}>
            <MapPin size={28} aria-hidden="true" />
            <p style={{ margin: "0.6rem 0 0" }}>
              Elige un punto de la lista para ponerle su ubicación exacta y las referencias para llegar.
            </p>
          </div>
        ) : (
          <>
            <div className="pt-card-head" style={{ alignItems: "flex-start" }}>
              <div style={{ minWidth: 0 }}>
                <h2>{punto.empresa}</h2>
                <p style={{ margin: "0.2rem 0 0", fontSize: "0.86rem", color: "var(--mc-gris)" }}>
                  {punto.alias}
                  {punto.clienteFolio ? ` · ${punto.clienteFolio}` : ""}
                </p>
              </div>
              {sectorGuardado && (
                <SectorInsignia clave={sectorGuardado.clave} color={sectorGuardado.color} nombre={sectorGuardado.nombre} />
              )}
            </div>

            <p style={{ margin: "0 0 0.6rem", fontSize: "0.88rem" }}>{direccionDe(punto)}</p>
            <p style={{ margin: "0 0 0.9rem", display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", fontSize: "0.82rem", color: "var(--mc-gris)" }}>
              <span className={`pt-badge ${estado.clase}`}>{estado.texto}</span>
              {estado.id !== "sin" && punto.fecha && <span>el {cuando(punto.fecha)}</span>}
            </p>

            {/* Al elegir una dirección se pone el pin Y se vuelve a encuadrar:
                `enfoque` es la clave que le dice al mapa que se acerque. */}
            <BuscadorDireccion
              id="punto-buscar-direccion"
              onElegir={(c) => {
                ponerPin(c);
                setVueltaBusqueda((n) => n + 1);
              }}
            />
            <SectorMapa
              zonas={zonas}
              pin={borrador.pin}
              onPin={ponerPin}
              enfoque={`${punto.id}:${vueltaBusqueda}`}
              alto="340px"
            />
            <p className="mc-mapa-nota">
              {borrador.pin
                ? "Arrastra el pin hasta la entrada por donde se recoge, o toca otro lugar del mapa."
                : "Este punto no tiene ubicación. Toca el mapa en la entrada del lugar, o pega abajo las coordenadas de Google Maps."}
            </p>

            <div className="pt-campo" style={{ marginTop: "0.9rem" }}>
              <label htmlFor="punto-coordenadas">Coordenadas</label>
              <input
                id="punto-coordenadas"
                className="pt-input"
                inputMode="decimal"
                placeholder="25.871230, -97.503110"
                value={borrador.coordenadas}
                onChange={(e) => { setBorrador({ ...borrador, coordenadas: e.target.value }); setErrorCoord(""); }}
                onBlur={leerCampoCoordenadas}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); leerCampoCoordenadas(); } }}
                style={{ width: "100%" }}
              />
              <p style={{ margin: "0.35rem 0 0", fontSize: "0.78rem", color: errorCoord ? "var(--pt-error)" : "var(--mc-gris)" }}>
                {errorCoord || "En Google Maps, clic derecho sobre el lugar copia sus coordenadas; pégalas aquí."}
              </p>
            </div>

            <div className="pt-campo">
              <label htmlFor="punto-referencias">Referencias para llegar</label>
              <textarea
                id="punto-referencias"
                className="pt-input"
                rows={3}
                placeholder="Ej. portón azul, entrar por la calle Uniones"
                value={borrador.referencias}
                onChange={(e) => { setBorrador({ ...borrador, referencias: e.target.value }); setMensaje(null); }}
                style={{ width: "100%", resize: "vertical" }}
              />
            </div>

            <a
              href={enlaceVerEnMapa(paraEnlace)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.86rem", color: "var(--mc-azul-txt)" }}
            >
              <ArrowSquareOut aria-hidden="true" />
              {borrador.pin ? "Ver en Google Maps" : "Buscar la dirección en Google Maps"}
            </a>

            {borrador.pin && (
              <p style={{ margin: "0.8rem 0 0", fontSize: "0.84rem", color: "var(--mc-gris)" }}>
                {sectorNuevo ? (
                  <>Con este pin queda en el <strong style={{ color: "var(--mc-tinta)" }}>{sectorNuevo.nombre}</strong>.</>
                ) : (
                  "Con este pin no cae en ningún sector."
                )}
                {pinCambio && estado.id === "chofer" && " Al guardar, la ubicación pasa a ser de la oficina y el chofer ya no podrá cambiarla."}
              </p>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", marginTop: "1rem" }}>
              <button type="button" className="pt-btn pt-btn-naranja" onClick={guardar} disabled={!sucio || guardando}>
                <FloppyDisk />{" "}
                {guardando ? "Guardando…" : porRevisar && !pinCambio && !refsCambio ? "Confirmar ubicación" : "Guardar"}
              </button>
              {sucio && (
                <button type="button" className="pt-btn" onClick={descartar} disabled={guardando}>
                  Descartar cambios
                </button>
              )}
              {sucio && !mensaje && <span style={{ fontSize: "0.82rem", color: "var(--pt-alerta)" }}>Hay cambios sin guardar</span>}
            </div>

            {mensaje && (
              <div
                role={mensaje.tipo === "error" ? "alert" : "status"}
                className={mensaje.tipo === "error" ? "pt-login-error" : undefined}
                style={
                  mensaje.tipo === "ok"
                    ? { color: "var(--pt-ok)", fontSize: "0.86rem", marginTop: "0.8rem" }
                    : { marginTop: "0.8rem", marginBottom: 0 }
                }
              >
                {mensaje.texto}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
