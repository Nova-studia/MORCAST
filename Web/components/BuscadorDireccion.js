"use client";

import { useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { LIMITES_MATAMOROS } from "@/lib/sectores.mjs";

/**
 * "Escribe la dirección" encima de un mapa (6-oct-2026, Luis): en vez de
 * buscar a ojo la cuadra en el mapa, se escribe la calle y el número, se
 * elige el resultado y el pin cae ahí. Después se afina tocando el mapa o
 * en la vista Satélite.
 *
 * Usa Nominatim (OpenStreetMap), gratis y sin llave, mientras la empresa
 * saca la de Google Maps. Sus reglas de uso obligan a lo que se hace aquí:
 * se busca SOLO al apretar el botón (nada de buscar con cada tecla) y una
 * búsqueda a la vez. La búsqueda se limita a la caja de Matamoros, la misma
 * que valida la base (LIMITES_MATAMOROS).
 *
 * ⚠️ No es un <form>: vive dentro del formulario del alta, y un form dentro
 * de otro no existe en HTML. Enter se atrapa a mano para que no envíe el alta.
 */
const L = LIMITES_MATAMOROS;
const URL_BUSQUEDA = "https://nominatim.openstreetmap.org/search";

/**
 * Lo que se intenta, en orden. Medido el 6-oct-2026: en Matamoros OSM conoce
 * las calles y avenidas pero casi ningún número de casa ni la mayoría de las
 * colonias, así que "Calle Sexta 120 Zona Centro" no da nada y "Calle Sexta"
 * sí. Se prueba lo escrito; luego sin el número de casa; luego sin la
 * colonia (lo de antes de la primera coma o de "Col./Zona/Fracc."). Como
 * mucho tres búsquedas, una por segundo.
 *
 * Solo se quita el NÚMERO DE CASA (#120, No. 45, o cifras de 3 o más), no
 * cualquier número: "Calle 6" y "Sexta 2a" son nombres de calle.
 */
export function intentosDeBusqueda(texto) {
  const limpio = (t) =>
    t.replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ").replace(/^[\s,]+|[\s,]+$/g, "").trim();
  const completo = limpio(texto);
  const sinNumero = limpio(
    completo
      .replace(/#\s*\d+\s*[a-z]?(?![\p{L}\d])/giu, " ")
      .replace(/(?<![\p{L}\d])(no|núm|num|número|numero)\.?\s*\d+\s*[a-z]?(?![\p{L}\d])/giu, " ")
      .replace(/(?<![\p{L}\d])\d{3,}\s*[a-z]?(?![\p{L}\d])/giu, " ")
  );
  const sinColonia = limpio(
    sinNumero.split(",")[0].split(/(?<![\p{L}\d])(col|colonia|zona|fracc|fraccionamiento)(?![\p{L}\d])\.?/iu)[0]
  );
  return [...new Set([completo, sinNumero, sinColonia])].filter((t) => t.length >= 4);
}

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

export default function BuscadorDireccion({ onElegir, id = "buscar-direccion" }) {
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState("listo"); // listo | buscando | error
  const [resultados, setResultados] = useState(null);
  // true si lo encontrado es la CALLE y no el número exacto.
  const [aproximado, setAproximado] = useState(false);

  const buscar = async () => {
    const q = texto.trim();
    if (q.length < 4 || estado === "buscando") return;
    setEstado("buscando");
    setResultados(null);
    setAproximado(false);
    const consultar = async (consulta) => {
      const params = new URLSearchParams({
        q: consulta,
        format: "jsonv2",
      countrycodes: "mx",
      viewbox: `${L.lngMin},${L.latMax},${L.lngMax},${L.latMin}`,
      bounded: "1",
        limit: "5",
        "accept-language": "es",
      });
      const r = await fetch(`${URL_BUSQUEDA}?${params}`, { headers: { Accept: "application/json" } });
      if (!r.ok) throw new Error(String(r.status));
      return (await r.json()) || [];
    };
    try {
      const intentos = intentosDeBusqueda(q);
      let lista = [];
      for (let i = 0; i < intentos.length && !lista.length; i++) {
        if (i > 0) await pausa(1100); // regla de Nominatim: una por segundo
        lista = await consultar(intentos[i]);
        if (lista.length && i > 0) setAproximado(true);
      }
      setResultados(
        lista.map((x) => ({
          id: x.place_id,
          nombre: x.display_name,
          lat: Number(x.lat),
          lng: Number(x.lon),
        }))
      );
      setEstado("listo");
    } catch {
      setEstado("error");
    }
  };

  const elegir = (x) => {
    onElegir([Number(x.lat.toFixed(6)), Number(x.lng.toFixed(6))], x.nombre);
    setResultados(null);
  };

  return (
    <div style={{ marginBottom: "0.7rem" }}>
      <label htmlFor={id} style={{ fontSize: "0.8rem", color: "var(--mc-gris)", display: "block", marginBottom: 4 }}>
        Escribe la dirección para ubicarla en el mapa
      </label>
      <div style={{ display: "flex", gap: "0.4rem" }}>
        <input
          id={id}
          className="pt-input"
          placeholder="Calle y número, colonia"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              buscar();
            }
          }}
          style={{ flex: 1, minWidth: 0 }}
          autoComplete="street-address"
        />
        <button
          type="button"
          className="pt-btn"
          onClick={buscar}
          disabled={estado === "buscando" || texto.trim().length < 4}
        >
          <MagnifyingGlass aria-hidden="true" /> {estado === "buscando" ? "Buscando…" : "Buscar"}
        </button>
      </div>

      {estado === "error" && (
        <p className="mc-mapa-nota" role="alert">
          No se pudo buscar ahorita. Toca el mapa en el lugar, o vuelve a intentar en un momento.
        </p>
      )}
      {resultados && resultados.length === 0 && (
        <p className="mc-mapa-nota" role="status">
          No encontramos esa dirección en Matamoros. Prueba solo con la calle y la colonia, o toca el mapa.
        </p>
      )}
      {resultados && resultados.length > 0 && aproximado && (
        <p className="mc-mapa-nota" role="status">
          No ubicamos el número exacto: esto te deja en la calle. Después toca tu entrada en el mapa
          (en Satélite se ve mejor).
        </p>
      )}
      {resultados && resultados.length > 0 && (
        <ul role="list" style={{ listStyle: "none", padding: 0, margin: "0.4rem 0 0", display: "grid", gap: 4 }}>
          {resultados.map((x) => (
            <li key={x.id}>
              <button
                type="button"
                className="pt-btn"
                onClick={() => elegir(x)}
                style={{ width: "100%", justifyContent: "flex-start", textAlign: "left", whiteSpace: "normal", fontWeight: 500 }}
              >
                {x.nombre}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
