"use client";

/**
 * Reportes: se arman sumando lo que de verdad se recolectó.
 *
 * ⚠️ SE REPORTA PESO, NO VOLUMEN. Lo que el chofer anota en cada servicio son
 * kilogramos; los metros cúbicos nadie los mide. Un reporte de "volumen"
 * sacado de un peso sería un número inventado con cara de dato.
 *
 * El DINERO se deja en cero a propósito: sale de la facturación, que todavía
 * no vive en el sistema. Un cero se entiende; un número inventado en un
 * reporte que alguien va a usar para cobrar, no.
 *
 * Sirve igual para el cliente y para el panel: el RLS decide qué filas entran
 * en la suma. El cliente suma lo suyo; Morcast, todo.
 */

import { supabaseNavegador, haySupabaseNavegador } from "@/lib/supabase-navegador";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/** Fecha YYYY-MM-DD → objeto Date sin sorpresas de zona horaria. */
function aFecha(iso) {
  const [a, m, d] = String(iso).split("-").map(Number);
  return new Date(a, (m || 1) - 1, d || 1);
}

/**
 * Rellena los periodos SIN servicios con cero.
 *
 * Si solo se grafican los días que hubo recolección, una semana con dos
 * servicios se ve igual de llena que una con catorce. El hueco es
 * información: dice que ese día no se recogió.
 */
function serie(filas, cuantos, paso) {
  const hoy = new Date();
  const cubos = [];

  for (let i = cuantos - 1; i >= 0; i--) {
    const f = new Date(hoy);
    let clave;
    let etiqueta;

    if (paso === "dia") {
      f.setDate(hoy.getDate() - i);
      clave = `${f.getFullYear()}-${f.getMonth()}-${f.getDate()}`;
      etiqueta = `${String(f.getDate()).padStart(2, "0")} ${MESES[f.getMonth()]}`;
    } else if (paso === "mes") {
      f.setMonth(hoy.getMonth() - i, 1);
      clave = `${f.getFullYear()}-${f.getMonth()}`;
      etiqueta = MESES[f.getMonth()];
    } else {
      f.setFullYear(hoy.getFullYear() - i);
      clave = `${f.getFullYear()}`;
      etiqueta = String(f.getFullYear());
    }
    cubos.push({ clave, periodo: etiqueta, volumen: 0, monto: 0, servicios: 0 });
  }

  const porClave = Object.fromEntries(cubos.map((c) => [c.clave, c]));

  for (const fila of filas) {
    const f = aFecha(fila.fecha);
    const clave =
      paso === "dia"
        ? `${f.getFullYear()}-${f.getMonth()}-${f.getDate()}`
        : paso === "mes"
        ? `${f.getFullYear()}-${f.getMonth()}`
        : `${f.getFullYear()}`;
    const cubo = porClave[clave];
    if (!cubo) continue;
    cubo.volumen += fila.toneladas;
    cubo.servicios += 1;
  }

  return cubos.map(({ clave, ...resto }) => ({
    ...resto,
    volumen: Math.round(resto.volumen * 100) / 100,
  }));
}

/**
 * Todos los servicios completados con peso, en el formato mínimo que
 * necesitan las gráficas.
 */
async function serviciosPesados() {
  if (!haySupabaseNavegador()) return [];

  const { data, error } = await supabaseNavegador()
    .from("solicitudes_recoleccion")
    .select("fecha_pedida, fecha_confirmada, rutas ( tipo ), recolecciones ( peso_kg )")
    .eq("estado", "completada");

  if (error) {
    console.error("[reportes] No se pudieron leer:", error.message);
    return [];
  }

  return (data || [])
    .map((s) => {
      const kg = Number(s.recolecciones?.[0]?.peso_kg || 0);
      return {
        fecha: s.fecha_confirmada || s.fecha_pedida,
        // En toneladas, que es como se habla de residuos: 1250 kg se lee
        // mejor como 1.25 que como mil doscientos cincuenta.
        toneladas: kg / 1000,
        tipo: s.rutas?.tipo || "otro",
      };
    })
    .filter((s) => s.fecha);
}

/** Series listas para las tres vistas, más el reparto por tipo de ruta. */
export async function reportes() {
  const filas = await serviciosPesados();

  const porTipo = {};
  let total = 0;
  for (const f of filas) {
    porTipo[f.tipo] = (porTipo[f.tipo] || 0) + f.toneladas;
    total += f.toneladas;
  }

  const NOMBRES = {
    manual: "Recolección manual",
    "roll-off": "Industrial (Roll Off)",
    compactador: "Compactador trasero",
    otro: "Sin clasificar",
  };
  const COLORES = ["#4eb34a", "#2d8a8f", "#db652d", "#7e908d"];

  const composicion = Object.entries(porTipo)
    .sort((a, b) => b[1] - a[1])
    .map(([tipo, t], i) => ({
      nombre: NOMBRES[tipo] || tipo,
      porcentaje: total ? Math.round((t / total) * 100) : 0,
      color: COLORES[i % COLORES.length],
    }));

  return {
    hayDatos: filas.length > 0,
    servicios: filas.length,
    diario: serie(filas, 14, "dia"),
    mensual: serie(filas, 12, "mes"),
    anual: serie(filas, 4, "anio"),
    composicion,
    // Se avisa a la pantalla que el dinero todavía no tiene de dónde salir,
    // para que lo diga en vez de mostrar ceros sin explicación.
    hayFacturacion: false,
  };
}
