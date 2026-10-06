"use client";

/**
 * Acceso a SECTORES y a la ubicación de los PUNTOS (tabla `domicilios`).
 *
 * Como en el resto de `datos-*`, aquí no hay reglas de seguridad: las pone el
 * RLS de Postgres. Dibujar un sector y mover un pin es trabajo del personal
 * (`sectores_personal` y `domicilios_personal`, db/023 y db/002); si una
 * cuenta de cliente llamara a estas funciones, la base no le dejaría cambiar
 * nada. Por eso cada escritura CUENTA las filas que devolvió: un UPDATE que
 * el RLS bloquea no da error, cambia cero filas y responde 200.
 *
 * La regla de "a qué sector pertenece un punto" no vive aquí sino en
 * `lib/sectores.mjs`, que no toca la red y tiene sus pruebas.
 */

import { supabaseNavegador, haySupabaseNavegador } from "@/lib/supabase-navegador";
import { agruparCambios, cambiosDeSector, clavesDeSectores } from "@/lib/sectores.mjs";

/* ==================================================================== */
/* DATOS DE DEMOSTRACIÓN (modo prototipo, sin Supabase)                  */
/* ==================================================================== */

/**
 * Sectores de MUESTRA, dibujados a ojo como cuatro cuadrantes del centro de
 * Matamoros (al norte, el río). ⚠️ No son los de la empresa: los reales los dibujan los dueños.
 * El D se deja SIN límites a propósito, para que en el prototipo también se
 * vea el aviso de "sector sin dibujar", que es como arranca la base real.
 * Colores: los mismos que siembra db/023.
 */
export const SECTORES_DEMO = [
  // El borde norte sigue más o menos el río Bravo: un sector de muestra
  // encima de Brownsville se vería descuidado.
  { id: "demo-a", clave: "A", nombre: "Sector A", color: "#2a6a99", activo: true,
    zona: [[25.905, -97.6], [25.895, -97.55], [25.888, -97.52], [25.886, -97.5], [25.85, -97.5], [25.85, -97.6]] },
  { id: "demo-b", clave: "B", nombre: "Sector B", color: "#265421", activo: true,
    zona: [[25.886, -97.5], [25.876, -97.47], [25.866, -97.44], [25.858, -97.42], [25.85, -97.42], [25.85, -97.5]] },
  { id: "demo-c", clave: "C", nombre: "Sector C", color: "#b45f06", activo: true,
    zona: [[25.85, -97.5], [25.85, -97.42], [25.79, -97.42], [25.79, -97.5]] },
  { id: "demo-d", clave: "D", nombre: "Sector D", color: "#7b3f8c", activo: true, zona: [] },
];

/**
 * Puntos de muestra de los clientes de `CLIENTES_ADMIN` (lib/admin-datos.js),
 * amarrados por folio. Hay de todo: con pin de la oficina, con pin del
 * chofer, sin ubicación y uno que cae en el sector D (sin dibujar), o sea
 * "en ninguno".
 */
const PUNTOS_DEMO_BASE = [
  { id: "demo-p1", clienteFolio: "MOR-2024-0187", empresa: "Industrias del Golfo, S.A. de C.V.", alias: "Planta 1",
    calle: "Av. Uniones #1700", colonia: "Parque Industrial Finsa", cp: "87316", lat: 25.8352, lng: -97.4561,
    origen: "panel", fecha: "2026-10-04T16:20:00Z", referencias: "Caseta 2, entrar por la calle Uniones." },
  { id: "demo-p2", clienteFolio: "MOR-2024-0187", empresa: "Industrias del Golfo, S.A. de C.V.", alias: "Planta 2",
    calle: "Carretera a Ciudad Victoria km 4", colonia: "Las Rusias", cp: "87390", lat: 25.8121, lng: -97.5512,
    origen: "chofer", fecha: "2026-10-03T14:05:00Z", referencias: "" },
  { id: "demo-p3", clienteFolio: "MOR-2025-0233", empresa: "Centro Comercial Puerta Norte", alias: "Plaza",
    calle: "Calle Sexta #300", colonia: "Zona Centro", cp: "87300", lat: 25.8851, lng: -97.5148,
    origen: "panel", fecha: "2026-10-02T18:00:00Z", referencias: "Andén de carga detrás del cine, portón azul." },
  { id: "demo-p4", clienteFolio: "MOR-2025-0301", empresa: "Vidriera Matamoros", alias: "Planta",
    calle: "Av. Pedro Cárdenas #2200", colonia: "Industrial", cp: "87350", lat: 25.866, lng: -97.475,
    origen: null, fecha: null, referencias: "" },
  { id: "demo-p5", clienteFolio: "MOR-2026-0044", empresa: "Maquilas TechNorte", alias: "Nave 2",
    calle: "Calle Río Bravo #45", colonia: "Puerto Rico", cp: "87380", lat: null, lng: null,
    origen: null, fecha: null, referencias: "" },
  { id: "demo-p6", clienteFolio: "MOR-2026-0071", empresa: "Ferretera del Golfo", alias: "Bodega",
    calle: "Av. Lauro Villar #810", colonia: "Jardín", cp: "87330", lat: null, lng: null,
    origen: null, fecha: null, referencias: "" },
  { id: "demo-p7", clienteFolio: "MOR-2026-0071", empresa: "Ferretera del Golfo", alias: "Sucursal Centro",
    calle: "Calle Morelos #120", colonia: "Zona Centro", cp: "87300", lat: 25.8769, lng: -97.5052,
    origen: "panel", fecha: "2026-10-01T15:30:00Z", referencias: "" },
  // Un cliente recién dado de alta: el pin lo puso él, sin origen y con fecha
  // (ver estadoUbicacion). Sale "Por revisar" en la lista.
  { id: "demo-p8", clienteFolio: "MOR-2026-0090", empresa: "Abarrotes La Esperanza", alias: "Principal",
    calle: "Calle Sexta #120", colonia: "Zona Centro", cp: "87300", lat: 25.8741, lng: -97.5010,
    origen: null, fecha: "2026-10-06T15:00:00Z", referencias: "" },
];

/** El sector guardado de cada punto demo, calculado con la misma regla que la real. */
const PUNTOS_DEMO = (() => {
  // Dos puntos con ruta para que en el prototipo se vea el filtro "Sin ruta".
  const RUTA_DEMO = {
    "demo-p1": { clave: "RT-INDUSTRIAL", nombre: "Ruta Industrial", serviciosPorMes: 8, porLlamada: false },
    "demo-p7": { clave: "RT-CENTRO", nombre: "Ruta Centro", serviciosPorMes: 4, porLlamada: false },
  };
  const conSector = PUNTOS_DEMO_BASE.map((p) => ({ ...p, sectorId: null, ruta: RUTA_DEMO[p.id] || null }));
  const porId = new Map(cambiosDeSector(conSector, SECTORES_DEMO).map((c) => [c.id, c.despues]));
  return conSector.map((p) => ({ ...p, sectorId: porId.get(p.id) ?? null }));
})();

/**
 * Letras de sector de un cliente demo (por folio), con su color. Lo usa
 * `listarClientes()` en modo prototipo para pintar la insignia.
 */
export function sectoresDemoDeCliente(folio) {
  const ids = PUNTOS_DEMO.filter((p) => p.clienteFolio === folio).map((p) => p.sectorId);
  return clavesDeSectores(ids, SECTORES_DEMO).map((s) => ({ clave: s.clave, color: s.color }));
}

/* ==================================================================== */
/* LECTURAS                                                             */
/* ==================================================================== */

/** Fila de `sectores` → objeto de pantalla. */
function sectorAPantalla(f) {
  return {
    id: f.id,
    clave: f.clave,
    nombre: f.nombre,
    color: f.color || "#2a6a99",
    activo: f.activo !== false,
    zona: Array.isArray(f.zona) ? f.zona : [],
  };
}

/** Los cuatro sectores, en orden de clave. */
export async function listarSectores() {
  if (!haySupabaseNavegador()) return SECTORES_DEMO;

  const { data, error } = await supabaseNavegador()
    .from("sectores")
    .select("id, clave, nombre, color, zona, activo")
    .order("clave");

  if (error) {
    console.error("[sectores] No se pudieron leer:", error.message);
    return [];
  }
  return (data || []).map(sectorAPantalla);
}

/** Fila de `domicilios` (con su cliente) → objeto de pantalla. */
function puntoAPantalla(f) {
  return {
    id: f.id,
    clienteId: f.cliente_id,
    clienteFolio: f.clientes?.folio || "",
    empresa: f.clientes?.empresa || "—",
    alias: f.alias || "",
    calle: f.calle || "",
    colonia: f.colonia || "",
    cp: f.cp || "",
    lat: f.lat,
    lng: f.lng,
    sectorId: f.sector_id || null,
    referencias: f.referencias || "",
    origen: f.ubicacion_origen || null,
    fecha: f.ubicacion_fecha || null,
    // Su suscripción: la ruta que pasa por aquí (6-oct-2026). Hay a lo más
    // una por punto (índice único cliente+domicilio, db/020).
    ruta: rutaDeSuscripcion(f.suscripciones),
  };
}

/** La suscripción embebida (arreglo de 0 o 1) → { clave, nombre, serviciosPorMes, porLlamada } o null. */
function rutaDeSuscripcion(subs) {
  const s = Array.isArray(subs) ? subs[0] : subs;
  if (!s) return null;
  return {
    clave: s.rutas?.clave || null,
    nombre: s.rutas?.nombre || "",
    serviciosPorMes: s.servicios_por_mes ?? 4,
    porLlamada: Boolean(s.por_llamada),
  };
}

/** Todos los puntos de recolección, con la empresa a la que pertenecen. */
export async function listarPuntos() {
  if (!haySupabaseNavegador()) return PUNTOS_DEMO;

  const { data, error } = await supabaseNavegador()
    .from("domicilios")
    .select(
      "id, cliente_id, alias, calle, colonia, cp, lat, lng, sector_id, referencias, " +
      "ubicacion_origen, ubicacion_fecha, clientes ( folio, empresa ), " +
      "suscripciones ( servicios_por_mes, por_llamada, rutas ( clave, nombre ) )"
    )
    .order("alias");

  if (error) {
    console.error("[puntos] No se pudieron leer:", error.message);
    return [];
  }
  // Orden por empresa y luego por alias: así salen juntas las plantas de una
  // misma empresa. PostgREST no ordena por la columna de una tabla embebida
  // sin trucos, así que se ordena aquí.
  return (data || [])
    .map(puntoAPantalla)
    .sort((a, b) => a.empresa.localeCompare(b.empresa, "es") || a.alias.localeCompare(b.alias, "es"));
}

/* ==================================================================== */
/* ESCRITURAS                                                           */
/* ==================================================================== */

/** Guarda el polígono de un sector. `zona` vacía = quitarle los límites. */
export async function guardarZonaSector(sectorId, zona) {
  if (!haySupabaseNavegador()) return { ok: true, demo: true };

  const { data, error } = await supabaseNavegador()
    .from("sectores")
    .update({ zona })
    .eq("id", sectorId)
    .select("id");

  if (error) {
    console.error("[sectores] No se pudo guardar la zona:", error.message);
    return { ok: false, motivo: error.message };
  }
  if (!data?.length) {
    return { ok: false, motivo: "No se guardó nada: el permiso de la base no te deja editar ese sector." };
  }
  return { ok: true };
}

/**
 * Guarda la ubicación y las referencias de un punto.
 *
 * `cambios` trae solo lo que se movió: si la oficina nada más escribe las
 * referencias de un pin que puso el chofer, el origen tiene que seguir
 * diciendo "chofer". Origen y fecha se reescriben únicamente cuando cambia
 * el pin.
 *
 * @param {string} puntoId
 * @param {{ pin?: [number, number], referencias?: string, sectorId?: string|null }} cambios
 */
export async function guardarPunto(puntoId, { pin, referencias, sectorId } = {}) {
  const fila = {};
  if (pin) {
    fila.lat = pin[0];
    fila.lng = pin[1];
    fila.ubicacion_origen = "panel";
    fila.ubicacion_fecha = new Date().toISOString();
  }
  if (referencias !== undefined) fila.referencias = referencias.trim() || null;
  if (sectorId !== undefined) fila.sector_id = sectorId;

  if (!Object.keys(fila).length) return { ok: true, fila };
  if (!haySupabaseNavegador()) return { ok: true, demo: true, fila };

  const { data, error } = await supabaseNavegador()
    .from("domicilios")
    .update(fila)
    .eq("id", puntoId)
    .select("id");

  if (error) {
    console.error("[puntos] No se pudo guardar:", error.message);
    return { ok: false, motivo: error.message };
  }
  if (!data?.length) {
    return { ok: false, motivo: "No se guardó nada: el permiso de la base no te deja editar ese punto." };
  }
  return { ok: true, fila };
}

/**
 * Recalcula y guarda el sector de los puntos que lo tengan desactualizado.
 *
 * Solo se escribe lo que cambió, agrupado por sector destino (a lo mucho
 * cinco UPDATE). Devuelve cuántos puntos se actualizaron de verdad: si la
 * base dejó menos de los que se mandaron, se dice, en vez de reportar éxito.
 *
 * @returns {Promise<{ ok: boolean, actualizados: number, esperados: number, cambios: Array, motivo?: string }>}
 */
export async function recalcularSectores(puntos, sectores) {
  const cambios = cambiosDeSector(puntos, sectores);
  const esperados = cambios.length;
  if (!esperados) return { ok: true, actualizados: 0, esperados, cambios };
  if (!haySupabaseNavegador()) return { ok: true, demo: true, actualizados: esperados, esperados, cambios };

  let actualizados = 0;
  const aplicados = new Set();
  for (const g of agruparCambios(cambios)) {
    const { data, error } = await supabaseNavegador()
      .from("domicilios")
      .update({ sector_id: g.sectorId })
      .in("id", g.ids)
      .select("id");
    if (error) {
      console.error("[puntos] No se pudo recalcular el sector:", error.message);
      return {
        ok: false,
        actualizados,
        esperados,
        cambios: cambios.filter((c) => aplicados.has(c.id)),
        motivo: error.message,
      };
    }
    (data || []).forEach((f) => aplicados.add(f.id));
    actualizados += data?.length || 0;
  }

  // Solo se reportan como hechos los que la base confirmó, para que la
  // pantalla no pinte un sector que no quedó guardado.
  const hechos = cambios.filter((c) => aplicados.has(c.id));
  if (actualizados < esperados) {
    return {
      ok: false,
      actualizados,
      esperados,
      cambios: hechos,
      motivo: `Solo se actualizaron ${actualizados} de ${esperados} puntos: el permiso de la base no dejó cambiar los demás.`,
    };
  }
  return { ok: true, actualizados, esperados, cambios: hechos };
}
