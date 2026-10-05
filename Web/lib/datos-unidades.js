"use client";

/**
 * Acceso a UNIDADES (camiones) contra la base de datos.
 *
 * Como en el resto de `datos-*.js`, aquí no hay reglas de seguridad: quién
 * puede ver o cambiar qué lo decide el RLS de db/023 (`unidades_personal`:
 * solo dueño y admin escriben; el chofer solo lee). Si esto se llamara desde
 * otra cuenta, la base rechazaría la escritura sin que este archivo lo sepa,
 * y por eso cada escritura CUENTA las filas que devuelve.
 *
 * La bitácora no se escribe aquí: la pone la base sola con el disparador
 * `bitacora_unidades_tg` (alta, baja y cambio de estado).
 *
 * MODO PROTOTIPO: sin Supabase, se trabaja sobre una flota de ejemplo en
 * memoria (se pierde al recargar), para que el panel se pueda recorrer.
 */

import { supabaseNavegador, haySupabaseNavegador } from "@/lib/supabase-navegador";
import { UNIDADES as UNIDADES_VIEJAS } from "@/lib/cotizacion-datos";
import { validarUnidad, hoyLocal } from "@/lib/unidades.mjs";

const COLUMNAS =
  "id, numero_economico, placas, tipo, marca_modelo, anio, estado, vence_seguro, vence_verificacion, notas, creado";

/* ------------------------------------------------------------------ */
/* Datos de ejemplo                                                    */
/* ------------------------------------------------------------------ */

/** Hoy ± n días, para que las alertas de ejemplo no caduquen con el tiempo. */
function enDias(n) {
  const f = new Date();
  f.setDate(f.getDate() + n);
  return hoyLocal(f);
}

let demo = null;

/**
 * La flota de ejemplo sale de la lista vieja de `cotizacion-datos.js`
 * (Compactador, Roll Off International, Roll Off Mack, Camión de carga
 * Chevrolet): son los camiones que Morcast enseña en su página, así el
 * prototipo se parece a la operación real. Las placas son inventadas.
 */
function flotaDemo() {
  if (demo) return demo;
  const [compactador, rollIntl, rollMack, chevrolet] = UNIDADES_VIEJAS;
  demo = [
    { id: "demo-u1", numero_economico: "U-01", placas: "XA1234B", tipo: "compactador", marca_modelo: compactador, anio: 2018, estado: "activa", vence_seguro: enDias(12), vence_verificacion: enDias(140), notas: null },
    { id: "demo-u2", numero_economico: "U-02", placas: "XA5678C", tipo: "roll-off", marca_modelo: rollIntl, anio: 2020, estado: "activa", vence_seguro: enDias(200), vence_verificacion: enDias(-4), notas: "Llanta trasera derecha cambiada el mes pasado." },
    { id: "demo-u3", numero_economico: "U-03", placas: "XB9012D", tipo: "roll-off", marca_modelo: rollMack, anio: 2016, estado: "taller", vence_seguro: enDias(90), vence_verificacion: enDias(25), notas: "En el taller por la bomba hidráulica." },
    { id: "demo-u4", numero_economico: "U-04", placas: "XC3456E", tipo: "manual", marca_modelo: chevrolet, anio: 2015, estado: "activa", vence_seguro: enDias(310), vence_verificacion: enDias(170), notas: null },
    { id: "demo-u5", numero_economico: "U-05", placas: null, tipo: "camioneta", marca_modelo: "Nissan NP300", anio: 2012, estado: "baja", vence_seguro: null, vence_verificacion: null, notas: "Vendida en 2025." },
  ];
  return demo;
}

/* ------------------------------------------------------------------ */
/* Lectura                                                             */
/* ------------------------------------------------------------------ */

/** Todas las unidades, por número económico. */
export async function listarUnidades() {
  if (!haySupabaseNavegador()) return [...flotaDemo()];

  const { data, error } = await supabaseNavegador()
    .from("unidades")
    .select(COLUMNAS)
    .order("numero_economico");
  if (error) {
    console.error("[unidades] No se pudieron leer:", error.message);
    return [];
  }
  return data || [];
}

/**
 * Cuántas rutas usa cada unidad: { [unidadId]: ["Ruta Norte", …] }.
 * Una sola consulta para toda la tabla, no una por fila.
 */
export async function rutasPorUnidad() {
  if (!haySupabaseNavegador()) return {};

  const { data, error } = await supabaseNavegador()
    .from("rutas")
    .select("nombre, unidad_id")
    .not("unidad_id", "is", null);
  if (error) {
    console.error("[unidades] No se pudieron leer las rutas:", error.message);
    return {};
  }
  const mapa = {};
  for (const r of data || []) (mapa[r.unidad_id] ||= []).push(r.nombre);
  return mapa;
}

/* ------------------------------------------------------------------ */
/* Escritura                                                           */
/* ------------------------------------------------------------------ */

/** Traduce los errores de Postgres que sí le dicen algo a quien captura. */
function motivoLegible(error) {
  if (error?.code === "23505") {
    return /placas/.test(error.message || "")
      ? "Ya hay otra unidad con esas placas."
      : "Ya hay otra unidad con ese número económico.";
  }
  return error?.message || "No se pudo guardar. Revisa tu conexión.";
}

/**
 * Alta (sin `id`) o edición (con `id`) de una unidad. Valida con la misma
 * regla que la pantalla (`validarUnidad`) para no mandarle a la base algo
 * que va a rechazar. Devuelve `{ ok, unidad }` o `{ ok:false, motivo, errores }`.
 */
export async function guardarUnidad(entrada) {
  const v = validarUnidad(entrada);
  if (!v.ok) return { ok: false, motivo: "Revisa los campos marcados.", errores: v.errores };

  if (!haySupabaseNavegador()) {
    const flota = flotaDemo();
    const repetida = flota.find((u) => u.id !== entrada.id && u.numero_economico === v.datos.numero_economico);
    if (repetida) return { ok: false, motivo: "Ya hay otra unidad con ese número económico." };
    if (entrada.id) {
      const i = flota.findIndex((u) => u.id === entrada.id);
      flota[i] = { ...flota[i], ...v.datos };
      return { ok: true, unidad: flota[i], demo: true };
    }
    const nueva = { id: `demo-u${Date.now()}`, ...v.datos };
    flota.push(nueva);
    return { ok: true, unidad: nueva, demo: true };
  }

  const supabase = supabaseNavegador();
  const consulta = entrada.id
    ? supabase.from("unidades").update(v.datos).eq("id", entrada.id)
    : supabase.from("unidades").insert(v.datos);
  const { data, error } = await consulta.select(COLUMNAS);

  if (error) {
    console.error("[unidades] No se pudo guardar:", error.message);
    return { ok: false, motivo: motivoLegible(error) };
  }
  // Un UPDATE que el RLS bloquea no da error: cambia CERO filas y responde
  // 200. Sin contar, la pantalla diría "Guardado" sin haber guardado nada.
  if (!data?.length) {
    return { ok: false, motivo: "No se guardó nada: la base no te dejó cambiar esa unidad." };
  }
  return { ok: true, unidad: data[0] };
}

/**
 * Lo que depende de una unidad. Se consulta ANTES de borrar porque todas
 * las llaves que apuntan a `unidades` son `on delete set null` (db/023):
 * borrar no falla, pero las rutas se quedan sin camión y los incidentes y
 * los viajes al relleno pierden de qué unidad eran. El rastro se perdería
 * en silencio.
 */
export async function dependenciasDeUnidad(id) {
  if (!haySupabaseNavegador()) return { rutas: 0, incidentes: 0, viajes: 0 };

  const contar = async (tabla) => {
    const { count, error } = await supabaseNavegador()
      .from(tabla)
      .select("id", { count: "exact", head: true })
      .eq("unidad_id", id);
    // Si no se pudo contar, se supone que SÍ hay: más vale no dejar borrar.
    return error ? 1 : count || 0;
  };
  const [rutas, incidentes, viajes] = await Promise.all([
    contar("rutas"),
    contar("incidentes"),
    contar("viajes_relleno"),
  ]);
  return { rutas, incidentes, viajes };
}

/**
 * Borra una unidad, pero solo si nada la usa. Lo normal es darla de BAJA
 * (estado 'baja'): deja de salir en los menús y conserva su historia.
 * Borrar es para el que se capturó por error.
 */
export async function borrarUnidad(unidad) {
  const dep = await dependenciasDeUnidad(unidad.id);
  if (dep.rutas || dep.incidentes || dep.viajes) {
    const partes = [];
    if (dep.rutas) partes.push(`${dep.rutas} ruta(s)`);
    if (dep.incidentes) partes.push(`${dep.incidentes} incidente(s)`);
    if (dep.viajes) partes.push(`${dep.viajes} viaje(s) al relleno`);
    return {
      ok: false,
      motivo: `No se puede borrar: la usan ${partes.join(", ")}. Dala de baja en su lugar: deja de aparecer al asignar rutas y no se pierde su historia.`,
    };
  }

  if (!haySupabaseNavegador()) {
    demo = flotaDemo().filter((u) => u.id !== unidad.id);
    return { ok: true, demo: true };
  }

  const { data, error } = await supabaseNavegador()
    .from("unidades")
    .delete()
    .eq("id", unidad.id)
    .select("id");
  if (error) return { ok: false, motivo: error.message };
  if (!data?.length) return { ok: false, motivo: "No se borró nada: la base no permitió eliminar esa unidad." };
  return { ok: true };
}
