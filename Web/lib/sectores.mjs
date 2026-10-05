/**
 * SECTORES A, B, C y D: en qué sector cae cada punto de recolección.
 *
 * Pedido de los dueños (4-oct-2026): cubrir todo Matamoros en cuatro sectores
 * y separar a los clientes por zona. Los LÍMITES los dibujan ellos en
 * /admin/sectores; aquí solo vive la regla para decidir a qué sector
 * pertenece un punto, sin tocar la base ni el navegador, para poder probarla
 * con `node --test` (tests/sectores.test.mjs).
 *
 * El sector se GUARDA en `domicilios.sector_id` (db/023) en vez de calcularse
 * cada vez: así el portal, los avisos por sector y el filtro de clientes lo
 * leen con una consulta simple. El precio es que hay que recalcularlo cuando
 * cambia el pin o el polígono, y para eso están `cambiosDeSector()` y
 * `agruparCambios()`.
 */

import { puntoEnZona } from "./punto-en-zona.mjs";
import { tieneUbicacion } from "./mapas.mjs";

/**
 * Caja de Matamoros: la MISMA que exige `fijar_ubicacion_punto()` en db/023.
 * Un pin fuera de aquí es un dedazo (o coordenadas al revés), no un cliente.
 */
export const LIMITES_MATAMOROS = { latMin: 25.5, latMax: 26.2, lngMin: -98.0, lngMax: -97.0 };

/** ¿El par [lat, lng] cae dentro de la caja de Matamoros? */
export function dentroDeMatamoros(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return false;
  const L = LIMITES_MATAMOROS;
  return la >= L.latMin && la <= L.latMax && ln >= L.lngMin && ln <= L.lngMax;
}

/** ¿El polígono sirve para decidir algo? Con menos de 3 esquinas no encierra nada. */
export function tieneZona(sector) {
  return Array.isArray(sector?.zona) && sector.zona.length >= 3;
}

/**
 * Sectores en orden de clave (A→D). El orden NO es cosmético: si un punto
 * cae en dos sectores (bordes que se enciman al dibujar a mano), se queda
 * con el primero de esta lista. Se ordena aquí y no se confía en el orden en
 * que llegaron, para que la regla no dependa de cómo respondió la base.
 */
export function ordenarSectores(sectores) {
  if (!Array.isArray(sectores)) return [];
  return [...sectores].sort((a, b) =>
    String(a?.clave ?? "").localeCompare(String(b?.clave ?? ""), "es")
  );
}

/** Sectores activos y con polígono que contienen al punto, en orden A→D. */
export function sectoresQueContienen(punto, sectores) {
  if (!tieneUbicacion(punto)) return [];
  const par = [Number(punto.lat), Number(punto.lng)];
  return ordenarSectores(sectores).filter(
    (s) => s?.activo !== false && tieneZona(s) && puntoEnZona(par, s.zona)
  );
}

/**
 * El sector de un punto, o `null` si no cae en ninguno (o no tiene
 * ubicación). Si cayera en dos, gana el primero por clave.
 */
export function sectorDePunto(punto, sectores) {
  return sectoresQueContienen(punto, sectores)[0] || null;
}

/**
 * Los puntos cuyo sector GUARDADO no coincide con el que les toca hoy.
 *
 * Un punto sin ubicación se queda sin sector: si alguna vez lo tuvo y le
 * borraron el pin, ese sector ya no se puede sostener. También agarra los
 * pines que puso el chofer desde su teléfono (`fijar_ubicacion_punto()` no
 * calcula sectores, eso vive aquí, en la web).
 *
 * @returns {Array<{ id: string, antes: string|null, despues: string|null }>}
 */
export function cambiosDeSector(puntos, sectores) {
  if (!Array.isArray(puntos)) return [];
  const cambios = [];
  for (const p of puntos) {
    const despues = sectorDePunto(p, sectores)?.id ?? null;
    const antes = p?.sectorId ?? null;
    if (antes !== despues) cambios.push({ id: p.id, antes, despues });
  }
  return cambios;
}

/**
 * Agrupa los cambios por sector destino. Con 70 puntos, un UPDATE por punto
 * son 70 viajes a la base; agrupados son, como mucho, cinco (A, B, C, D y
 * "ninguno").
 *
 * @returns {Array<{ sectorId: string|null, ids: string[] }>}
 */
export function agruparCambios(cambios) {
  const grupos = new Map();
  for (const c of cambios || []) {
    const clave = c.despues ?? null;
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(c.id);
  }
  return [...grupos.entries()].map(([sectorId, ids]) => ({ sectorId, ids }));
}

/**
 * Lo que se ve en la pestaña de Sectores: cuántos puntos caen en cada uno,
 * cuántos tienen pin pero no caen en ninguno, cuántos ni pin tienen, y
 * cuántos caen en dos a la vez (un borde mal dibujado que conviene corregir).
 * Se cuenta con el cálculo vivo, no con `sectorId`, para que el número se
 * mueva mientras se dibuja.
 */
export function conteoPorSector(puntos, sectores) {
  const porSector = Object.fromEntries((sectores || []).map((s) => [s.id, 0]));
  let ninguno = 0;
  let sinUbicacion = 0;
  let encimados = 0;
  for (const p of puntos || []) {
    if (!tieneUbicacion(p)) {
      sinUbicacion++;
      continue;
    }
    const caen = sectoresQueContienen(p, sectores);
    if (!caen.length) ninguno++;
    else porSector[caen[0].id] = (porSector[caen[0].id] || 0) + 1;
    if (caen.length > 1) encimados++;
  }
  return { porSector, ninguno, sinUbicacion, encimados };
}

/**
 * De dónde salió la ubicación de un punto, en palabras de la oficina.
 * Un punto con coordenadas pero sin origen viene de la carga inicial de
 * datos, que hizo la oficina: cuenta como "la oficina".
 */
export function estadoUbicacion(punto) {
  // `corto` es para la tabla, donde en el teléfono no cabe la frase entera.
  if (!tieneUbicacion(punto)) return { id: "sin", texto: "Sin ubicación", corto: "Sin ubicación", clase: "mal" };
  if (punto.origen === "chofer") return { id: "chofer", texto: "La puso el chofer", corto: "Del chofer", clase: "ruta" };
  return { id: "panel", texto: "La puso la oficina", corto: "De la oficina", clase: "ok" };
}

/** Minúsculas y sin acentos: "Villarreal" se encuentra escribiendo "villarreal" o "VILLARREAL". */
export function normalizar(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Filtra la lista de puntos.
 * - `ubicacion`: "todos" | "sin" | "chofer" | "panel"
 * - `sector`: "" (todos) | "ninguno" | id de sector (por el sector GUARDADO)
 * - `texto`: busca en empresa, folio, alias, calle, colonia y CP
 */
export function filtrarPuntos(puntos, { ubicacion = "todos", sector = "", texto = "" } = {}) {
  const buscado = normalizar(texto);
  return (puntos || []).filter((p) => {
    if (ubicacion !== "todos" && estadoUbicacion(p).id !== ubicacion) return false;
    if (sector === "ninguno" && p.sectorId) return false;
    if (sector && sector !== "ninguno" && p.sectorId !== sector) return false;
    if (buscado) {
      const pajar = normalizar(
        [p.empresa, p.clienteFolio, p.alias, p.calle, p.colonia, p.cp].join(" ")
      );
      if (!pajar.includes(buscado)) return false;
    }
    return true;
  });
}

/**
 * Lee coordenadas pegadas desde Google Maps. Al hacer clic derecho sobre el
 * mapa, Google copia "25.87123, -97.50311"; también se aceptan sin espacio,
 * con punto y coma, o en un enlace que traiga "@25.87,-97.50". Devuelve
 * `[lat, lng]` o `null` si no se entiende o no cae en Matamoros (lo más común
 * es haber pegado lng y lat al revés).
 */
export function leerCoordenadas(texto) {
  const s = String(texto ?? "");
  const m = s.match(/(-?\d{1,3}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!dentroDeMatamoros(lat, lng)) return null;
  return [lat, lng];
}

/**
 * Claves de sector (ordenadas, sin repetir) de los puntos de un cliente. Un
 * cliente pertenece a un sector si ALGUNO de sus puntos cae en él: una
 * empresa con dos plantas en lados opuestos de la ciudad está en los dos.
 */
export function clavesDeSectores(sectorIds, sectores) {
  const porId = new Map((sectores || []).map((s) => [s.id, s]));
  const vistos = new Map();
  for (const id of sectorIds || []) {
    const s = porId.get(id);
    if (s && !vistos.has(s.clave)) vistos.set(s.clave, s);
  }
  return ordenarSectores([...vistos.values()]);
}
