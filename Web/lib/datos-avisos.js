"use client";

/**
 * Acceso a los AVISOS A CLIENTES (db/023) desde el navegador: el formulario
 * y el historial del panel (/admin/avisos) y los avisos del portal.
 *
 * Las LECTURAS van aquí, con la sesión y bajo RLS: el personal ve todos los
 * avisos (`avisos_personal`) y el cliente solo los que le tocan
 * (`avisos_lee_cliente`: a todos, a su sector, a su ruta o a su empresa). El
 * MANDAR va por el servidor (app/acciones-avisos.js), porque lee los correos
 * de todas las empresas con la llave de servicio y escribe la bitácora.
 */

import { supabaseNavegador, haySupabaseNavegador } from "@/lib/supabase-navegador";
import { contarDestinatarios, enviarAviso } from "@/app/acciones-avisos";
import {
  calcularDestinatarios,
  resumenDestinatarios,
  validarAlcance,
  validarAviso,
  avisoVigente,
  DIAS_EN_PORTAL,
} from "@/lib/avisos.mjs";
import { RUTAS_SEED } from "@/lib/rutas-datos";

/** Los cuatro sectores (A-D). Los activos, en orden de clave. */
export async function listarSectores() {
  if (!haySupabaseNavegador()) return DEMO.sectores;
  const { data, error } = await supabaseNavegador()
    .from("sectores")
    .select("id, clave, nombre, color")
    .eq("activo", true)
    .order("clave");
  if (error) {
    console.error("[avisos] No se pudieron leer los sectores:", error.message);
    return [];
  }
  return data || [];
}

/**
 * Rutas para el selector. Se piden aquí (y no con `listarRutas()` de
 * datos-rutas.js) porque aquel devuelve la CLAVE en `id` y el UUID en
 * `uuid`, y el aviso necesita el UUID: con la clave la base rechazaría el
 * aviso. Así no hay forma de equivocarse de campo.
 */
export async function listarRutasParaAvisos() {
  if (!haySupabaseNavegador()) {
    return RUTAS_SEED.map((r) => ({ id: r.id, clave: r.id, nombre: r.nombre, activa: r.activa }));
  }
  const { data, error } = await supabaseNavegador()
    .from("rutas")
    .select("id, clave, nombre, activa")
    .order("clave");
  if (error) {
    console.error("[avisos] No se pudieron leer las rutas:", error.message);
    return [];
  }
  return data || [];
}

/** Clientes para el buscador de "un cliente en específico". */
export async function listarClientesParaAvisos() {
  if (!haySupabaseNavegador()) return DEMO.clientes;
  const { data, error } = await supabaseNavegador()
    .from("clientes")
    .select("id, folio, empresa, correo, estado")
    .order("empresa");
  if (error) {
    console.error("[avisos] No se pudieron leer los clientes:", error.message);
    return [];
  }
  return data || [];
}

/** Historial: lo último que se mandó, con el nombre de su destino. */
export async function listarAvisos({ limite = 50 } = {}) {
  if (!haySupabaseNavegador()) return DEMO.historial();
  const { data, error } = await supabaseNavegador()
    .from("avisos")
    .select(`
      id, titulo, mensaje, motivo, alcance, vigente_hasta, correos_enviados, creado,
      sectores ( clave, nombre ), rutas ( clave, nombre ), clientes ( empresa ),
      perfiles ( nombre )
    `)
    .order("creado", { ascending: false })
    .limit(limite);
  if (error) {
    console.error("[avisos] No se pudo leer el historial:", error.message);
    return [];
  }
  return data || [];
}

/**
 * ¿A cuántos les llega? En el prototipo se calcula aquí con los clientes de
 * ejemplo y la MISMA función que usa el servidor; con la base, lo calcula el
 * servidor, que es el único que puede leer los correos de todos.
 */
export async function vistaPreviaDestinatarios(datos) {
  if (!haySupabaseNavegador()) {
    const v = validarAlcance(datos);
    if (!v.ok) return { ok: false, motivo: v.motivo };
    return { ok: true, resumen: resumenDestinatarios(calcularDestinatarios(v.limpio, DEMO)) };
  }
  return contarDestinatarios(datos);
}

/** Manda el aviso. En el prototipo no sale nada: se dice lo que habría pasado. */
export async function mandarAviso(datos) {
  if (!haySupabaseNavegador()) {
    const v = validarAviso(datos);
    if (!v.ok) return { ok: false, motivo: v.motivo };
    const resumen = resumenDestinatarios(calcularDestinatarios(v.limpio, DEMO));
    return { ok: true, demo: true, id: `demo-${Date.now()}`, creado: new Date().toISOString(), resumen, enviados: 0, fallidos: [] };
  }
  return enviarAviso(datos);
}

/**
 * Los avisos que el CLIENTE tiene que ver en su portal: los de los últimos
 * 30 días que sigan vigentes. Cuáles le tocan lo decide la base; aquí solo
 * se quitan los vencidos.
 */
export async function avisosDelCliente() {
  if (!haySupabaseNavegador()) return DEMO.paraElPortal();
  const desde = new Date(Date.now() - DIAS_EN_PORTAL * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseNavegador()
    .from("avisos")
    .select("id, titulo, mensaje, motivo, alcance, vigente_hasta, creado")
    .gte("creado", desde)
    .order("creado", { ascending: false })
    .limit(20);
  if (error) {
    // Los avisos son un extra del portal: si fallan, el resto de la pantalla
    // sigue. Se anota y se enseña nada, en vez de tumbar el panel.
    console.error("[avisos] No se pudieron leer los avisos del portal:", error.message);
    return [];
  }
  return (data || []).filter((a) => avisoVigente(a));
}

/* ------------------------------------------------------------------ */
/* Modo prototipo (sin Supabase)                                       */
/* ------------------------------------------------------------------ */

/**
 * Clientes, puntos y suscripciones de EJEMPLO, con la forma de las filas de
 * la base para que `calcularDestinatarios` los trate igual. Los nombres son
 * los de lib/admin-datos.js. A propósito hay uno sin correo (para ver el
 * "solo lo verá en su portal") y uno suspendido (que no entra en los masivos).
 */
const DEMO = {
  sectores: [
    { id: "sector-a", clave: "A", nombre: "Sector A", color: "#2a6a99" },
    { id: "sector-b", clave: "B", nombre: "Sector B", color: "#265421" },
    { id: "sector-c", clave: "C", nombre: "Sector C", color: "#b45f06" },
    { id: "sector-d", clave: "D", nombre: "Sector D", color: "#7b3f8c" },
  ],
  clientes: [
    { id: "MOR-2024-0187", folio: "MOR-2024-0187", empresa: "Industrias del Golfo, S.A. de C.V.", correo: "cliente@demo.com", estado: "activo" },
    { id: "MOR-2025-0233", folio: "MOR-2025-0233", empresa: "Centro Comercial Puerta Norte", correo: "mantenimiento@puertanorte.mx", estado: "activo" },
    { id: "MOR-2025-0301", folio: "MOR-2025-0301", empresa: "Vidriera Matamoros", correo: "hlozano@vidrieramtm.com", estado: "activo" },
    { id: "MOR-2026-0044", folio: "MOR-2026-0044", empresa: "Maquilas TechNorte", correo: "jvillarreal@technorte.com", estado: "suspendido" },
    { id: "MOR-2026-0071", folio: "MOR-2026-0071", empresa: "Ferretera del Golfo", correo: "", estado: "activo" },
  ],
  domicilios: [
    { cliente_id: "MOR-2024-0187", sector_id: "sector-b" },
    { cliente_id: "MOR-2025-0233", sector_id: "sector-a" },
    { cliente_id: "MOR-2025-0301", sector_id: "sector-a" },
    { cliente_id: "MOR-2026-0044", sector_id: "sector-c" },
    { cliente_id: "MOR-2026-0071", sector_id: "sector-d" },
  ],
  suscripciones: [
    { cliente_id: "MOR-2024-0187", ruta_id: "RT-INDUSTRIAL", estado: "activa" },
    { cliente_id: "MOR-2025-0233", ruta_id: "RT-CENTRO", estado: "activa" },
    { cliente_id: "MOR-2025-0301", ruta_id: "RT-CENTRO", estado: "activa" },
    { cliente_id: "MOR-2026-0044", ruta_id: "RT-INDUSTRIAL", estado: "activa" },
    { cliente_id: "MOR-2026-0071", ruta_id: "RT-NORTE", estado: "activa" },
  ],
  historial() {
    const hace = (h) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
    return [
      {
        id: "demo-av-1", titulo: "Retraso en Ruta Centro", motivo: "retraso", alcance: "ruta",
        mensaje: "Hoy Ruta Centro trae un retraso de aproximadamente 40 minutos.",
        vigente_hasta: null, correos_enviados: 2, creado: hace(28),
        rutas: { clave: "RT-CENTRO", nombre: "Ruta Centro" }, perfiles: { nombre: "Ing. Ramón Cázares" },
      },
      {
        id: "demo-av-2", titulo: "Sin servicio el 2 de noviembre", motivo: "reagenda", alcance: "todos",
        mensaje: "Por ser día festivo no habrá recolección. Las rutas de ese día pasan el 3.",
        vigente_hasta: "2026-11-03", correos_enviados: 3, creado: hace(24 * 6),
        perfiles: { nombre: "Ing. Ramón Cázares" },
      },
    ];
  },
  paraElPortal() {
    return DEMO.historial().filter((a) => avisoVigente(a));
  },
};
