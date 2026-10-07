"use client";

import { sinPruebasEnConsulta } from "@/lib/cuentas-prueba.mjs";
import { idsCuentasPrueba } from "@/lib/cuentas-prueba-datos";
import { colorDe } from "@/lib/paleta-datos";
import { aportesConMejorDato } from "@/lib/peso.mjs";
import { demoPeso } from "@/lib/datos-viajes";

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
 *
 * EL PESO ES EL MEJOR DATO DISPONIBLE (db/023), no siempre el del chofer: el
 * real de la báscula del relleno si ya se registró —por viaje o por
 * recolección— y si no, el estimado. La regla y el cuidado de no contar
 * doble viven en `lib/peso.mjs`. Cada periodo trae además cuánto de su total
 * es real y cuánto estimado, para que la pantalla lo diga.
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
    cubos.push({ clave, periodo: etiqueta, volumen: 0, real: 0, estimado: 0, monto: 0, servicios: 0 });
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
    if (fila.esReal) cubo.real += fila.toneladas;
    else cubo.estimado += fila.toneladas;
    // Un viaje al relleno es UN aporte pero varios servicios.
    cubo.servicios += fila.servicios ?? 1;
  }

  const r2 = (n) => Math.round(n * 100) / 100;
  return cubos.map(({ clave, ...resto }) => ({
    ...resto,
    volumen: r2(resto.volumen),
    real: r2(resto.real),
    estimado: r2(resto.estimado),
  }));
}

/**
 * Todos los servicios completados, convertidos en APORTES de peso con el
 * mejor dato de cada uno (ver lib/peso.mjs), en el formato mínimo que
 * necesitan las gráficas.
 *
 * Los viajes se piden aparte. Al cliente el RLS no le enseña ninguno, así
 * que sus recolecciones caen solas a su peso real propio o a su estimado:
 * el ticket del viaje es del camión entero, no de su empresa.
 */
async function serviciosPesados(sinPruebas = false) {
  if (!haySupabaseNavegador()) {
    // En la demo, las mismas recolecciones y viajes que /admin/viajes, para
    // que se vea la parte real y la estimada del total.
    const d = demoPeso();
    const tipoDe = { "RT-INDUSTRIAL": "roll-off", "RT-CENTRO": "compactador", "RT-NORTE": "manual" };
    return aFilas(aportesConMejorDato(
      d.recolecciones.map((r) => ({ ...r, tipo: tipoDe[r.rutaClave] || "otro" })),
      d.viajes
    ));
  }

  const supabase = supabaseNavegador();
  const [solicitudes, viajes] = await Promise.all([
    // Desde el panel, sin las cuentas de revisión (db/027).
    sinPruebasEnConsulta(
      supabase
        .from("solicitudes_recoleccion")
        .select("fecha_pedida, fecha_confirmada, rutas ( tipo ), recolecciones ( peso_kg, peso_real_kg, viaje_id )"),
      sinPruebas ? await idsCuentasPrueba() : null
    ).eq("estado", "completada"),
    supabase.from("viajes_relleno").select("id, fecha, peso_real_kg"),
  ]);

  if (solicitudes.error) {
    console.error("[reportes] No se pudieron leer:", solicitudes.error.message);
    return { filas: [], totales: aportesConMejorDato([], []) };
  }
  // Sin viajes (error o cliente) se sigue: cada recolección cuenta lo suyo.
  if (viajes.error) console.error("[reportes] No se pudieron leer los viajes:", viajes.error.message);

  const recolecciones = (solicitudes.data || [])
    .map((s) => {
      const ev = s.recolecciones?.[0] || null;
      return {
        fecha: s.fecha_confirmada || s.fecha_pedida,
        tipo: s.rutas?.tipo || "otro",
        estimadoKg: ev?.peso_kg,
        realKg: ev?.peso_real_kg,
        viajeId: ev?.viaje_id || null,
      };
    })
    .filter((r) => r.fecha);

  return aFilas(aportesConMejorDato(
    recolecciones,
    (viajes.data || []).map((v) => ({ id: v.id, fecha: v.fecha, pesoRealKg: v.peso_real_kg }))
  ));
}

/** Aportes de peso → filas de las gráficas, en toneladas. */
function aFilas(totales) {
  const filas = totales.aportes.map((a) => ({
    fecha: a.fecha,
    // En toneladas, que es como se habla de residuos: 1250 kg se lee
    // mejor como 1.25 que como mil doscientos cincuenta.
    toneladas: a.kg / 1000,
    tipo: a.tipo,
    esReal: a.fuente === "viaje" || a.fuente === "real",
    servicios: a.servicios,
  }));

  return { filas, totales };
}

/** Series listas para las tres vistas, más el reparto por tipo de ruta. */
export async function reportes({ sinPruebas = false } = {}) {
  const { filas, totales } = await serviciosPesados(sinPruebas);

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
  // El color va por NOMBRE del tipo, no por su lugar en la lista. Antes se
  // asignaba despues del `sort`, asi que un tipo cambiaba de color en cuanto
  // subia o bajaba de renglon y dos informes dejaban de ser comparables.
  const composicion = Object.entries(porTipo)
    .sort((a, b) => b[1] - a[1])
    .map(([tipo, t], i) => ({
      nombre: NOMBRES[tipo] || tipo,
      porcentaje: total ? Math.round((t / total) * 100) : 0,
      color: colorDe(NOMBRES[tipo] || tipo, i),
    }));

  return {
    hayDatos: filas.length > 0,
    servicios: totales.servicios,
    // De todo el historial, cuánto salió de báscula y cuánto del chofer.
    toneladasReales: totales.kgReal / 1000,
    toneladasEstimadas: totales.kgEstimado / 1000,
    serviciosConPesoReal: totales.serviciosConReal,
    diario: serie(filas, 14, "dia"),
    mensual: serie(filas, 12, "mes"),
    anual: serie(filas, 4, "anio"),
    composicion,
  };
}
