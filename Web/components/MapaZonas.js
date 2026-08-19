"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { MATAMOROS_CENTRO } from "@/lib/rutas-datos";

/**
 * Mapa de zonas con Leaflet sobre teselas de OpenStreetMap.
 *
 * Se carga solo en el navegador: Leaflet toca `window` y `document`, así que
 * revienta si Next intenta renderizarlo en el servidor. Por eso este archivo
 * es "use client" Y quien lo use debe importarlo con
 * `dynamic(() => import(...), { ssr: false })`.
 *
 * La atribución de OpenStreetMap es obligatoria por sus condiciones de uso.
 */

// Valores por defecto a nivel de módulo, NO literales en la firma: un `[]`
// escrito en los parámetros nace nuevo en cada render y dispararía el efecto
// que repinta el mapa con cada tecla que escriba el usuario en el formulario.
const SIN_ZONAS = [];
const SIN_PUNTOS = [];

export default function MapaZonas({
  zonas = SIN_ZONAS,
  pin = null,
  onPin = null,
  puntos = SIN_PUNTOS,
  alto = "420px",
  // Ajusta el zoom para que quepa todo lo dibujado. Sin esto, lo que caiga fuera
  // del encuadre fijo de Matamoros simplemente no se ve.
  encuadrar = false,
}) {
  const contenedor = useRef(null);
  const mapa = useRef(null);
  const capas = useRef([]);
  const marcadorPin = useRef(null);
  const alClic = useRef(onPin);

  // Se guarda en ref para que el listener siempre vea el callback más reciente
  // sin tener que recrear el mapa en cada render.
  useEffect(() => {
    alClic.current = onPin;
  }, [onPin]);

  // Crear el mapa una sola vez.
  useEffect(() => {
    let cancelado = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelado || !contenedor.current || mapa.current) return;

      mapa.current = L.map(contenedor.current).setView(MATAMOROS_CENTRO, 13);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; colaboradores de <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(mapa.current);

      mapa.current.on("click", (e) => {
        if (alClic.current) alClic.current([e.latlng.lat, e.latlng.lng]);
      });
    })();

    return () => {
      cancelado = true;
      if (mapa.current) {
        mapa.current.remove();
        mapa.current = null;
      }
    };
  }, []);

  // Repintar zonas y marcadores cuando cambien.
  useEffect(() => {
    let cancelado = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelado || !mapa.current) return;

      capas.current.forEach((c) => c.remove());
      capas.current = [];

      zonas.forEach((z) => {
        if (!z.poligono || z.poligono.length < 3) return;
        const capa = L.polygon(z.poligono, {
          color: z.color || "#4EB34A",
          weight: 2,
          fillOpacity: 0.18,
        }).addTo(mapa.current);
        if (z.nombre) capa.bindTooltip(z.nombre);
        capas.current.push(capa);
      });

      puntos.forEach((p) => {
        const m = L.circleMarker([p.lat, p.lng], {
          radius: 7,
          color: "#DB652D",
          fillColor: "#DB652D",
          fillOpacity: 0.9,
        }).addTo(mapa.current);
        if (p.titulo) m.bindTooltip(p.titulo);
        capas.current.push(m);
      });

      if (encuadrar && capas.current.length) {
        const grupo = L.featureGroup(capas.current);
        const limites = grupo.getBounds();
        if (limites.isValid()) {
          mapa.current.fitBounds(limites, { padding: [24, 24], maxZoom: 15 });
        }
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [zonas, puntos, encuadrar]);

  // Mover el pin del domicilio.
  useEffect(() => {
    let cancelado = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelado || !mapa.current) return;

      if (marcadorPin.current) {
        marcadorPin.current.remove();
        marcadorPin.current = null;
      }
      if (!pin) return;

      marcadorPin.current = L.circleMarker(pin, {
        radius: 10,
        color: "#144C4F",
        fillColor: "#7cc576",
        fillOpacity: 1,
        weight: 3,
      })
        .addTo(mapa.current)
        .bindTooltip("Tu domicilio");
    })();

    return () => {
      cancelado = true;
    };
  }, [pin]);

  return <div ref={contenedor} className="mc-mapa" style={{ height: alto }} />;
}
