"use client";

/**
 * VIAJES AL RELLENO: el peso real que da la báscula del relleno sanitario.
 *
 * Lecturas desde el navegador, bajo RLS: `viajes_relleno` solo la ve el
 * personal (db/023), así que si esto lo llamara un cliente la base le
 * devolvería una lista vacía sin que este archivo tenga que saberlo. Las
 * escrituras van por `app/acciones-peso.js`, en el servidor, para que
 * queden en la bitácora con el nombre de quien las hizo.
 *
 * Sin Supabase (modo prototipo) todo sale de `demoPeso()`, con fechas
 * relativas a hoy para que la pantalla se vea como se vería en operación.
 */

import { supabaseNavegador, haySupabaseNavegador } from "@/lib/supabase-navegador";
import { listarOperadores } from "@/lib/datos-clientes";
import { enlaceTemporal } from "@/lib/datos-archivos";
import { hoyISO } from "@/lib/vencimiento";

/* ---------------------------------------------------------------------
   DATOS DE DEMOSTRACIÓN
   Los usan esta pantalla y la de Recolecciones (por eso viven aquí y se
   exportan): si cada una inventara los suyos, el viaje de la demo diría
   que lleva tres recolecciones y Recolecciones enseñaría otras.
   --------------------------------------------------------------------- */
let demoCache = null;

/** Fecha de hace `n` días, en local. */
function haceDias(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return hoyISO(d);
}

export function demoPeso() {
  if (demoCache) return demoCache;
  const ayer = haceDias(1);
  const antier = haceDias(2);

  const unidades = [
    { id: "u-07", numeroEconomico: "ECO-07", placas: "XA-1234-B", tipo: "compactador", estado: "activa" },
    { id: "u-12", numeroEconomico: "ECO-12", placas: "XB-9087-A", tipo: "roll-off", estado: "activa" },
  ];
  const operadores = [
    { id: "op-1", nombre: "José Medina" },
    { id: "op-2", nombre: "Alberto Cruz" },
  ];

  // Una por servicio completado. `solicitudId` amarra con las solicitudes de
  // la demo de Recolecciones, de abajo.
  const recolecciones = [
    { id: "rec-1", solicitudId: "sol-d1", folio: "REC-2026-0150", cliente: "Vidriera Matamoros", domicilio: "Matriz · Zona Centro", rutaClave: "RT-CENTRO", rutaNombre: "Ruta Centro", unidadId: "u-07", operadorId: "op-1", chofer: "José Medina", fecha: ayer, estimadoKg: 1100, realKg: null, viajeId: "v-1" },
    { id: "rec-2", solicitudId: "sol-d2", folio: "REC-2026-0151", cliente: "Centro Comercial Puerta Norte", domicilio: "Anexo · Zona Centro", rutaClave: "RT-CENTRO", rutaNombre: "Ruta Centro", unidadId: "u-07", operadorId: "op-1", chofer: "José Medina", fecha: ayer, estimadoKg: 1350, realKg: null, viajeId: "v-1" },
    { id: "rec-3", solicitudId: "sol-d3", folio: "REC-2026-0152", cliente: "Farmacias del Golfo", domicilio: "Sucursal Sexta · Centro", rutaClave: "RT-CENTRO", rutaNombre: "Ruta Centro", unidadId: "u-07", operadorId: "op-1", chofer: "José Medina", fecha: ayer, estimadoKg: 600, realKg: null, viajeId: "v-1" },
    { id: "rec-4", solicitudId: "sol-d4", folio: "REC-2026-0153", cliente: "Abarrotes Treviño", domicilio: "Local · Buenavista", rutaClave: "RT-NORTE", rutaNombre: "Ruta Norte", unidadId: "u-07", operadorId: "op-1", chofer: "José Medina", fecha: ayer, estimadoKg: 300, realKg: null, viajeId: null },
    { id: "rec-5", solicitudId: "sol-d5", folio: "REC-2026-0148", cliente: "Industrias del Golfo, S.A. de C.V.", domicilio: "Planta 1 · Parque Industrial", rutaClave: "RT-INDUSTRIAL", rutaNombre: "Ruta Industrial", unidadId: "u-12", operadorId: "op-2", chofer: "Alberto Cruz", fecha: antier, estimadoKg: 4000, realKg: null, viajeId: "v-2" },
    { id: "rec-6", solicitudId: "sol-d6", folio: "REC-2026-0147", cliente: "Maquiladora Río Bravo", domicilio: "Nave 3 · Parque del Norte", rutaClave: "RT-INDUSTRIAL", rutaNombre: "Ruta Industrial", unidadId: "u-12", operadorId: "op-2", chofer: "Alberto Cruz", fecha: antier, estimadoKg: 3200, realKg: 3460, viajeId: null },
  ];

  const viajes = [
    { id: "v-1", fecha: ayer, unidadId: "u-07", unidad: "ECO-07 · XA-1234-B", operadorId: "op-1", chofer: "José Medina", pesoRealKg: 3480, folioTicket: "R-20931", fotoTicket: null, notas: "" },
    { id: "v-2", fecha: antier, unidadId: "u-12", unidad: "ECO-12 · XB-9087-A", operadorId: "op-2", chofer: "Alberto Cruz", pesoRealKg: 3720, folioTicket: "R-20877", fotoTicket: null, notas: "Tolva de 30 m³, un solo viaje." },
  ];

  // Solicitudes extra para la demo de Recolecciones: las completadas de
  // arriba y una que no procedió, para que se vea cómo se pinta cada caso.
  // Se arman al pedirlas (getter) para que reflejen lo que se haya editado
  // en /admin/viajes durante la misma visita.
  const armarSolicitudes = () => {
    const viajePorId = Object.fromEntries(viajes.map((v) => [v.id, v]));
    return [
      ...recolecciones.map((r) => ({
        id: r.solicitudId,
        folio: r.folio,
        cliente: r.cliente,
        domicilio: r.domicilio,
        rutaId: r.rutaClave,
        rutaNombre: r.rutaNombre,
        chofer: r.chofer,
        origen: "ruta",
        fechaPedida: r.fecha,
        fechaConfirmada: r.fecha,
        horaConfirmada: "",
        estado: "completada",
        nota: "",
        tipoResiduo: r.rutaClave === "RT-INDUSTRIAL" ? "Residuos de Manejo Especial" : "Residuos Sólidos Urbanos",
        evidencia: evidenciaDemo(r, viajePorId),
      })),
      {
        id: "sol-d7",
        folio: "REC-2026-0154",
        cliente: "Taller Mecánico Hermanos Garza",
        domicilio: "Taller · Col. Popular",
        rutaId: "RT-NORTE",
        rutaNombre: "Ruta Norte",
        chofer: "José Medina",
        origen: "extra",
        fechaPedida: ayer,
        fechaConfirmada: ayer,
        horaConfirmada: "10:30",
        estado: "no-procedio",
        nota: "",
        tipoResiduo: "Residuos Sólidos Urbanos",
        motivoNoProcedio: "El residuo no es el que se agendó",
        detalleNoProcedio: "Eran tambos de aceite usado: eso es residuo peligroso y la unidad no lo puede llevar.",
        evidencia: null,
      },
    ];
  };

  demoCache = {
    unidades,
    operadores,
    recolecciones,
    viajes,
    get solicitudes() {
      return armarSolicitudes();
    },
  };
  return demoCache;
}

function evidenciaDemo(r, viajePorId) {
  if (!r) return null;
  const v = r.viajeId ? viajePorId[r.viajeId] : null;
  return {
    id: r.id,
    estimadoKg: r.estimadoKg,
    realKg: r.realKg,
    realEn: r.realKg ? `${r.fecha}T18:00:00` : null,
    viajeId: r.viajeId,
    viaje: v ? { id: v.id, fecha: v.fecha, pesoRealKg: v.pesoRealKg, folioTicket: v.folioTicket } : null,
  };
}

/**
 * Solo modo prototipo: deja el viaje guardado en la demo de esta pestaña,
 * para que al volver a abrirlo salga como quedó. Con Supabase no se usa; la
 * verdad la da la base (`app/acciones-peso.js`).
 */
export function guardarViajeDemo(viaje, recoleccionIds) {
  const d = demoPeso();
  const i = d.viajes.findIndex((v) => v.id === viaje.id);
  if (viaje.borrar) {
    if (i >= 0) d.viajes.splice(i, 1);
  } else if (i >= 0) {
    d.viajes[i] = { ...d.viajes[i], ...viaje };
  } else {
    d.viajes.unshift(viaje);
  }
  const elegidas = new Set(recoleccionIds || []);
  for (const r of d.recolecciones) {
    if (elegidas.has(r.id) && !viaje.borrar) r.viajeId = viaje.id;
    else if (r.viajeId === viaje.id) r.viajeId = null;
  }
}

/* ---------------------------------------------------------------------
   LECTURAS
   --------------------------------------------------------------------- */

const num = (v) => (v === null || v === undefined ? null : Number(v));

/** "ECO-07 · XA-1234-B": el número de la puerta primero, que es como se dice. */
export function nombreUnidad(u) {
  if (!u) return "";
  return [u.numeroEconomico || u.numero_economico, u.placas].filter(Boolean).join(" · ");
}

/**
 * Los viajes registrados, del más reciente al más viejo, con lo que hace
 * falta para el cuadre: los estimados de sus recolecciones.
 */
export async function listarViajes() {
  if (!haySupabaseNavegador()) {
    const d = demoPeso();
    return d.viajes.map((v) => ({
      ...v,
      unidadNumero: d.unidades.find((u) => u.id === v.unidadId)?.numeroEconomico || "",
      unidadPlacas: d.unidades.find((u) => u.id === v.unidadId)?.placas || "",
      recolecciones: d.recolecciones
        .filter((r) => r.viajeId === v.id)
        .map((r) => ({ id: r.id, estimadoKg: r.estimadoKg, realKg: r.realKg })),
    }));
  }

  // La llave de `operador` va explícita: `viajes_relleno` apunta DOS veces a
  // perfiles (`operador_id` y `creado_por`) y sin el nombre PostgREST
  // responde con un error de relación ambigua.
  const { data, error } = await supabaseNavegador()
    .from("viajes_relleno")
    .select(`
      id, fecha, unidad_id, operador_id, peso_real_kg, folio_ticket, foto_ticket, notas, creado,
      unidades ( numero_economico, placas ),
      operador:perfiles!viajes_relleno_operador_id_fkey ( nombre ),
      recolecciones ( id, peso_kg, peso_real_kg )
    `)
    .order("fecha", { ascending: false })
    .order("creado", { ascending: false })
    .limit(300);

  if (error) {
    console.error("[viajes] No se pudieron leer:", error.message);
    return [];
  }
  return (data || []).map((v) => ({
    id: v.id,
    fecha: v.fecha,
    unidadId: v.unidad_id,
    unidad: nombreUnidad(v.unidades),
    unidadNumero: v.unidades?.numero_economico || "",
    unidadPlacas: v.unidades?.placas || "",
    operadorId: v.operador_id,
    chofer: v.operador?.nombre || "",
    pesoRealKg: num(v.peso_real_kg),
    folioTicket: v.folio_ticket || "",
    fotoTicket: v.foto_ticket || null,
    notas: v.notas || "",
    recolecciones: (v.recolecciones || []).map((r) => ({
      id: r.id,
      estimadoKg: num(r.peso_kg),
      realKg: num(r.peso_real_kg),
    })),
  }));
}

/**
 * Las unidades para el selector. Las dadas de baja no: nadie lleva un viaje
 * en un camión que ya no existe. Si la tabla está vacía (el inventario se
 * está levantando), la pantalla deja registrar el viaje sin unidad.
 */
export async function listarUnidadesViaje() {
  if (!haySupabaseNavegador()) return demoPeso().unidades;

  const { data, error } = await supabaseNavegador()
    .from("unidades")
    .select("id, numero_economico, placas, tipo, estado")
    .neq("estado", "baja")
    .order("numero_economico");

  if (error) {
    console.error("[viajes] No se pudieron leer las unidades:", error.message);
    return [];
  }
  return (data || []).map((u) => ({
    id: u.id,
    numeroEconomico: u.numero_economico,
    placas: u.placas || "",
    tipo: u.tipo,
    estado: u.estado,
  }));
}

/** Los choferes (perfiles con rol operador). */
export async function listarChoferesViaje() {
  if (!haySupabaseNavegador()) return demoPeso().operadores;
  return listarOperadores();
}

/** Fecha local (la del navegador, en Matamoros) de un instante de la base. */
function fechaLocal(ts) {
  return ts ? hoyISO(new Date(ts)) : null;
}

/** Suma `n` días a una fecha AAAA-MM-DD. */
function moverDias(iso, n) {
  const [a, m, d] = String(iso).split("-").map(Number);
  return hoyISO(new Date(a, m - 1, d + n, 12));
}

const CAMPOS_REC = `
  id, solicitud_id, operador_id, peso_kg, peso_real_kg, viaje_id, hora_despues, creado,
  operador:perfiles!recolecciones_operador_id_fkey ( nombre ),
  solicitudes_recoleccion!inner (
    folio, estado, fecha_pedida, fecha_confirmada,
    clientes ( empresa ),
    domicilios ( alias, colonia ),
    rutas ( clave, nombre, unidad, unidad_id )
  )
`;
// `recolecciones` también apunta dos veces a perfiles (`operador_id` y
// `peso_real_por`), de ahí el nombre de la llave.

function aRecoleccion(r) {
  const s = r.solicitudes_recoleccion || {};
  return {
    id: r.id,
    solicitudId: r.solicitud_id,
    folio: s.folio || "",
    cliente: s.clientes?.empresa || "—",
    domicilio: s.domicilios ? [s.domicilios.alias, s.domicilios.colonia].filter(Boolean).join(" · ") : "",
    rutaClave: s.rutas?.clave || null,
    rutaNombre: s.rutas?.nombre || "Sin ruta",
    unidadId: s.rutas?.unidad_id || null,
    operadorId: r.operador_id,
    chofer: r.operador?.nombre || "",
    // El día en que el camión de verdad la levantó (la hora de la foto de
    // "después"), no el que se agendó: si el chofer la hizo un día tarde, fue
    // al relleno ese día tarde.
    fecha: fechaLocal(r.hora_despues || r.creado) || s.fecha_confirmada || s.fecha_pedida,
    estimadoKg: num(r.peso_kg),
    realKg: num(r.peso_real_kg),
    viajeId: r.viaje_id || null,
  };
}

/**
 * Las recolecciones completadas alrededor de una fecha, más las que ya van
 * en el viaje que se está editando (aunque sean de otro día: si alguien las
 * amarró, tienen que verse para poder soltarlas).
 *
 * La consulta trae un día de holgura por cada lado porque `creado` y
 * `hora_despues` están en UTC y Matamoros va seis horas atrás; el filtro
 * fino por día local lo hace `candidatasParaViaje` en lib/peso.mjs.
 */
export async function recoleccionesParaViaje(fecha, viajeId = null) {
  if (!haySupabaseNavegador()) {
    // Copia: la pantalla no debe poder modificar la demo compartida.
    return demoPeso().recolecciones.map((r) => ({ ...r }));
  }
  if (!fecha) return [];

  const supabase = supabaseNavegador();
  const desde = moverDias(fecha, -1);
  const hasta = moverDias(fecha, 2);
  const consultas = [
    supabase
      .from("recolecciones")
      .select(CAMPOS_REC)
      .eq("solicitudes_recoleccion.estado", "completada")
      // Por la hora de la foto, no por `creado`: la app del chofer guarda sin
      // señal y sube después, así que `creado` puede caer días más tarde.
      // `creado` solo se usa cuando no hay hora de foto.
      .or(
        `and(hora_despues.gte.${desde},hora_despues.lt.${hasta}),` +
        `and(hora_despues.is.null,creado.gte.${desde},creado.lt.${hasta})`
      )
      .limit(500),
  ];
  if (viajeId) {
    consultas.push(supabase.from("recolecciones").select(CAMPOS_REC).eq("viaje_id", viajeId));
  }

  const resultados = await Promise.all(consultas);
  const vistas = new Map();
  for (const { data, error } of resultados) {
    if (error) {
      console.error("[viajes] No se pudieron leer las recolecciones:", error.message);
      continue;
    }
    for (const r of data || []) vistas.set(r.id, aRecoleccion(r));
  }
  return [...vistas.values()].sort((a, b) => String(a.folio).localeCompare(String(b.folio)));
}

/* ---------------------------------------------------------------------
   TICKET DE BÁSCULA (cubeta privada "tickets")
   --------------------------------------------------------------------- */

/** Enlace temporal para ver la foto del ticket. */
export const enlaceTicket = (ruta) => enlaceTemporal("tickets", ruta);

const MB_MAXIMO = 10;

/**
 * Sube la foto del ticket a `tickets/<id del viaje>/…`.
 *
 * Se sube desde el navegador y no por una acción del servidor porque una
 * foto de teléfono pasa con facilidad del límite de cuerpo de las acciones
 * (1 MB). La política de la cubeta (db/023) ya solo deja subir al personal;
 * la acción que guarda la ruta en el viaje comprueba que la carpeta sea la
 * del viaje.
 */
export async function subirTicket(viajeId, archivo) {
  if (!haySupabaseNavegador()) return { ok: true, demo: true };
  if (!viajeId || !archivo) return { ok: false, motivo: "Falta el viaje o el archivo." };
  if (archivo.size > MB_MAXIMO * 1024 * 1024) {
    return { ok: false, motivo: `La foto pesa más de ${MB_MAXIMO} MB. Tómala con menos resolución.` };
  }

  const extension = (String(archivo.name).split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  // Con la hora en el nombre para no pisar un ticket anterior: si se sube
  // otro, el viejo se queda en la cubeta como respaldo.
  const ruta = `${viajeId}/ticket-${Date.now()}.${extension}`;

  const { error } = await supabaseNavegador()
    .storage.from("tickets")
    .upload(ruta, archivo, { contentType: archivo.type || undefined, upsert: false });

  if (error) {
    console.error("[viajes] No se pudo subir el ticket:", error.message);
    return { ok: false, motivo: error.message };
  }
  return { ok: true, ruta };
}
