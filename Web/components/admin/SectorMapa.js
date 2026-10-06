"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { MATAMOROS_CENTRO } from "@/lib/rutas-datos";
import { agregarCapasBase } from "@/lib/capas-mapa";

/**
 * Mapa de /admin/sectores: los cuatro sectores, los puntos de recolección, y
 * las dos cosas que se editan ahí — las esquinas de un sector y el pin de un
 * punto.
 *
 * Es primo de `components/MapaZonas.js` (mismo Leaflet, mismas teselas de
 * OpenStreetMap, misma regla de cargarse solo en el navegador con
 * `dynamic(..., { ssr: false })`), pero MapaZonas solo sabe agregar puntos con
 * clic. Aquí hace falta ARRASTRAR: corregir un borde de sector moviendo una
 * esquina, o mover el pin de un punto hasta la puerta exacta. Volver a dibujar
 * veinte esquinas para arreglar una sola sería una crueldad, y MapaZonas lo
 * usan pantallas públicas que no deben cargar con esto.
 *
 * Los marcadores son `divIcon` dibujados aquí mismo: el icono por defecto de
 * Leaflet es una imagen que Next no sirve sin configurarlo, y saldría roto.
 */

// Valores por defecto fuera de la firma: un `[]` literal nacería nuevo en cada
// render y repintaría el mapa con cada tecla (ver la nota en MapaZonas).
const NADA = [];

// Leaflet pinta sobre <canvas>/SVG: no entiende var(--mc-*), necesita el hex.
const TINTA = "#ECEDEA";
const NEGRO = "#0B0E0F";

function iconoVertice(L, color, primero) {
  // 28px de caja para el dedo; el punto visible es de 14 (16 el primero, que
  // es donde se "cierra" el polígono y conviene distinguirlo).
  const d = primero ? 16 : 14;
  return L.divIcon({
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html:
      `<span style="display:grid;place-items:center;width:28px;height:28px;cursor:grab">` +
      `<span style="width:${d}px;height:${d}px;border-radius:50%;background:${primero ? color : TINTA};` +
      `border:3px solid ${primero ? TINTA : color};box-shadow:0 0 0 1px ${NEGRO}"></span></span>`,
  });
}

function iconoPin(L) {
  return L.divIcon({
    className: "",
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    html:
      `<svg width="30" height="40" viewBox="0 0 30 40" style="cursor:grab;filter:drop-shadow(0 2px 2px rgba(0,0,0,.5))">` +
      `<path d="M15 1C7.3 1 1 7.3 1 15c0 10.4 14 24 14 24s14-13.6 14-24C29 7.3 22.7 1 15 1z" fill="${TINTA}" stroke="${NEGRO}" stroke-width="2"/>` +
      `<circle cx="15" cy="15" r="5" fill="${NEGRO}"/></svg>`,
  });
}

export default function SectorMapa({
  // [{ id, nombre, color, poligono, resaltada }]
  zonas = NADA,
  // [{ lat, lng, titulo, color }] — los puntos de recolección, de referencia
  puntos = NADA,
  // Esquinas del sector que se está dibujando, y quién recibe los cambios.
  // Con `onVertices` puesto, el clic en el mapa AGREGA una esquina.
  vertices = NADA,
  onVertices = null,
  colorTrazo = TINTA,
  // Pin del punto que se está ubicando. Con `onPin` puesto, el clic lo pone
  // ahí y se puede arrastrar.
  pin = null,
  onPin = null,
  // Cambia esta clave para volver a encuadrar (al elegir otro punto o sector).
  enfoque = "",
  alto = "460px",
}) {
  const contenedor = useRef(null);
  const mapa = useRef(null);
  const leaflet = useRef(null);
  const capasFijas = useRef([]);
  const capasTrazo = useRef([]);
  const marcadorPin = useRef(null);

  // Callbacks en refs: el listener del mapa se registra una vez y siempre
  // debe ver la versión más reciente.
  const alVertices = useRef(onVertices);
  const alPin = useRef(onPin);
  const verticesActuales = useRef(vertices);
  useEffect(() => {
    alVertices.current = onVertices;
    alPin.current = onPin;
    verticesActuales.current = vertices;
  }, [onVertices, onPin, vertices]);

  // Crear el mapa una sola vez.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelado || !contenedor.current || mapa.current) return;
      leaflet.current = L;
      mapa.current = L.map(contenedor.current).setView(MATAMOROS_CENTRO, 12);
      // Mapa de calles y Satélite: en la foto se ve el portón exacto.
      agregarCapasBase(L, mapa.current);

      mapa.current.on("click", (e) => {
        const c = [e.latlng.lat, e.latlng.lng];
        // Dibujar un sector tiene prioridad: mientras se dibuja, un clic es
        // una esquina, nunca un pin.
        if (alVertices.current) alVertices.current([...verticesActuales.current, c]);
        else if (alPin.current) alPin.current(c);
      });
      // Avisar a los demás efectos que ya hay mapa: re-disparan con este evento.
      contenedor.current?.dispatchEvent(new Event("mapa-listo"));
    })();
    return () => {
      cancelado = true;
      if (mapa.current) {
        mapa.current.remove();
        mapa.current = null;
      }
    };
  }, []);

  // Los efectos de abajo pueden correr antes de que Leaflet termine de
  // cargar. En vez de perder ese primer pintado, cada uno se vuelve a correr
  // cuando el mapa avisa que ya está.
  const conMapa = (fn) => {
    if (mapa.current && leaflet.current) {
      fn(leaflet.current, mapa.current);
      return () => {};
    }
    const el = contenedor.current;
    const correr = () => mapa.current && fn(leaflet.current, mapa.current);
    el?.addEventListener("mapa-listo", correr, { once: true });
    return () => el?.removeEventListener("mapa-listo", correr);
  };

  // Sectores guardados y puntos de referencia.
  useEffect(
    () =>
      conMapa((L, m) => {
        capasFijas.current.forEach((c) => c.remove());
        capasFijas.current = [];
        zonas.forEach((z) => {
          if (!Array.isArray(z.poligono) || z.poligono.length < 3) return;
          const capa = L.polygon(z.poligono, {
            color: z.color,
            weight: z.resaltada ? 3 : 2,
            fillOpacity: z.resaltada ? 0.28 : 0.14,
            // Que el clic atraviese el polígono y llegue al mapa: si no, no
            // se podría poner una esquina ni un pin DENTRO de un sector.
            interactive: false,
          }).addTo(m);
          capasFijas.current.push(capa);
        });
        puntos.forEach((p) => {
          const lat = Number(p.lat);
          const lng = Number(p.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
          const marca = L.circleMarker([lat, lng], {
            radius: 5,
            color: NEGRO,
            weight: 1,
            fillColor: p.color || TINTA,
            fillOpacity: 0.95,
          }).addTo(m);
          if (p.titulo) marca.bindTooltip(p.titulo);
          capasFijas.current.push(marca);
        });
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [zonas, puntos]
  );

  // El sector que se está dibujando: su contorno y sus esquinas arrastrables.
  useEffect(
    () =>
      conMapa((L, m) => {
        capasTrazo.current.forEach((c) => c.remove());
        capasTrazo.current = [];
        if (!onVertices) return;

        const forma =
          vertices.length >= 3
            ? L.polygon(vertices, { color: colorTrazo, weight: 3, dashArray: "6 6", fillOpacity: 0.22, interactive: false })
            : L.polyline(vertices, { color: colorTrazo, weight: 3, dashArray: "6 6", interactive: false });
        forma.addTo(m);
        capasTrazo.current.push(forma);

        vertices.forEach((v, i) => {
          const marca = L.marker(v, { draggable: true, icon: iconoVertice(L, colorTrazo, i === 0), keyboard: false })
            .addTo(m)
            .bindTooltip(i === 0 ? "Primera esquina" : `Esquina ${i + 1}`);
          // Mientras se arrastra se mueve solo el dibujo (sin pasar por React,
          // que reconstruiría los marcadores a media arrastrada); al soltar se
          // avisa una sola vez.
          marca.on("drag", (e) => {
            const copia = verticesActuales.current.slice();
            copia[i] = [e.latlng.lat, e.latlng.lng];
            forma.setLatLngs(copia);
          });
          marca.on("dragend", (e) => {
            const ll = e.target.getLatLng();
            const copia = verticesActuales.current.slice();
            copia[i] = [ll.lat, ll.lng];
            alVertices.current?.(copia);
          });
          capasTrazo.current.push(marca);
        });
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vertices, onVertices ? 1 : 0, colorTrazo]
  );

  // El pin del punto.
  useEffect(
    () =>
      conMapa((L, m) => {
        if (marcadorPin.current) {
          marcadorPin.current.remove();
          marcadorPin.current = null;
        }
        if (!pin) return;
        marcadorPin.current = L.marker(pin, { draggable: Boolean(onPin), icon: iconoPin(L), keyboard: false })
          .addTo(m)
          .bindTooltip(onPin ? "Arrástralo a la entrada exacta" : "Ubicación del punto");
        marcadorPin.current.on("dragend", (e) => {
          const ll = e.target.getLatLng();
          alPin.current?.([ll.lat, ll.lng]);
        });
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pin?.[0], pin?.[1], onPin ? 1 : 0]
  );

  // Encuadre: al elegir otro punto se acerca a su pin; si no tiene, a lo que
  // haya dibujado; si no hay nada, al centro de Matamoros.
  useEffect(
    () =>
      conMapa((L, m) => {
        if (pin) {
          m.setView(pin, 17);
          return;
        }
        const conForma = zonas.filter((z) => Array.isArray(z.poligono) && z.poligono.length >= 3);
        // Si hay un sector elegido con límites, se encuadra ése; si no, todos.
        const elegida = conForma.filter((z) => z.resaltada);
        const base = elegida.length ? elegida : conForma;
        const todo = [...base.flatMap((z) => z.poligono), ...vertices];
        if (todo.length >= 2) {
          const limites = L.latLngBounds(todo);
          if (limites.isValid()) {
            m.fitBounds(limites, { padding: [24, 24], maxZoom: 15 });
            return;
          }
        }
        m.setView(MATAMOROS_CENTRO, 12);
      }),
    // Solo cuando cambia la clave: encuadrar con cada esquina nueva movería
    // el mapa debajo del dedo mientras se dibuja.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enfoque]
  );

  return <div ref={contenedor} className="mc-mapa" style={{ height: alto }} />;
}
