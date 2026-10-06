/**
 * REPORTES DEL NEGOCIO EN LA APP DE ADMINISTRACIÓN — lógica pura.
 *
 * Lo mismo que enseña morcast.mx/admin/reportes (6-oct-2026, paridad):
 * peso recolectado por mes, mejor mes, conversión de cotizaciones y el
 * detalle. ESPEJO de la web, para que el teléfono y el panel den los mismos
 * números con los mismos datos:
 *   · el mejor dato de peso sin contar doble → Web/lib/peso.mjs
 *   · los doce meses rellenos con cero      → Web/lib/datos-reportes.js (serie)
 *   · total, promedio, mejor mes, conversión → app/(admin)/admin/reportes/page.js
 * Las pruebas comparan esta copia contra la web cuando la carpeta está al lado.
 *
 * Con el PESO REAL apagado (6-oct-2026, estado-sistema) todo lo que hay es
 * el ESTIMADO del chofer; la pantalla lo dice así. Si un día se enciende,
 * esta misma cuenta ya separa lo real de lo estimado.
 */

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/* ------------------------------------------------------------------ */
/* Peso: el mejor dato disponible (copia de Web/lib/peso.mjs)          */
/* ------------------------------------------------------------------ */

/** Un peso en kilos que de verdad es un número positivo, o null. */
export function kgValido(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * De dónde sale el peso de UNA recolección, para enseñarlo en su renglón.
 *
 * @param {{estimadoKg?: number, realKg?: number, viajeId?: string}} rec
 * @param {Map<string, {pesoRealKg: number}>|Record<string, {pesoRealKg: number}>} viajes
 * @returns {{fuente: "viaje"|"real"|"estimado"|"sin-peso", kg: number|null}}
 *   En "viaje", `kg` es el peso del VIAJE completo, no el de la recolección.
 */
export function fuenteDePeso(rec, viajes = {}) {
  const viaje = rec?.viajeId ? obtener(viajes, rec.viajeId) : null;
  const kgViaje = kgValido(viaje?.pesoRealKg);
  if (kgViaje) return { fuente: "viaje", kg: kgViaje };
  const real = kgValido(rec?.realKg);
  if (real) return { fuente: "real", kg: real };
  const est = kgValido(rec?.estimadoKg);
  if (est) return { fuente: "estimado", kg: est };
  return { fuente: "sin-peso", kg: null };
}

function obtener(coleccion, id) {
  if (!coleccion) return null;
  if (coleccion instanceof Map) return coleccion.get(id) || null;
  return coleccion[id] || null;
}

/** El tipo que más se repite (empate: el primero que apareció). */
function masComun(lista) {
  const cuenta = new Map();
  for (const t of lista) cuenta.set(t, (cuenta.get(t) || 0) + 1);
  let mejor = null;
  let n = 0;
  for (const [t, c] of cuenta) if (c > n) { mejor = t; n = c; }
  return mejor;
}

/**
 * Convierte las recolecciones en APORTES al total con el mejor dato de cada
 * una, sin contar nada dos veces.
 *
 * @param {Array<{fecha: string, tipo?: string, estimadoKg?: number,
 *                realKg?: number, viajeId?: string}>} recolecciones
 *   Una por servicio completado.
 * @param {Array<{id: string, fecha: string, pesoRealKg: number}>} viajes
 *   Los viajes que la sesión puede ver. Los que no estén aquí no cuentan.
 * @returns {{
 *   aportes: Array<{fecha: string, tipo: string, kg: number,
 *                   fuente: "viaje"|"real"|"estimado"|"sin-peso", servicios: number}>,
 *   kgTotal: number, kgReal: number, kgEstimado: number,
 *   kgViajes: number, kgRealSuelto: number, servicios: number,
 *   serviciosConReal: number, serviciosSinPeso: number
 * }}
 */
export function aportesConMejorDato(recolecciones = [], viajes = []) {
  const viajesPorId = new Map();
  for (const v of viajes || []) {
    if (v?.id && kgValido(v.pesoRealKg)) viajesPorId.set(v.id, v);
  }

  const enViaje = new Map(); // viajeId → recolecciones
  const aportes = [];

  for (const r of recolecciones || []) {
    if (r?.viajeId && viajesPorId.has(r.viajeId)) {
      if (!enViaje.has(r.viajeId)) enViaje.set(r.viajeId, []);
      enViaje.get(r.viajeId).push(r);
      continue;
    }
    const f = fuenteDePeso({ estimadoKg: r?.estimadoKg, realKg: r?.realKg });
    aportes.push({
      fecha: r?.fecha,
      tipo: r?.tipo || "otro",
      kg: f.kg || 0,
      fuente: f.fuente,
      servicios: 1,
    });
  }

  // Cada viaje entra UNA vez, con el peso del ticket y la fecha del viaje.
  for (const [id, recs] of enViaje) {
    const v = viajesPorId.get(id);
    aportes.push({
      fecha: v.fecha || recs[0]?.fecha,
      tipo: masComun(recs.map((r) => r.tipo || "otro")) || "otro",
      kg: kgValido(v.pesoRealKg),
      fuente: "viaje",
      servicios: recs.length,
    });
  }

  const suma = (pred) => aportes.filter(pred).reduce((t, a) => t + a.kg, 0);
  const kgViajes = suma((a) => a.fuente === "viaje");
  const kgRealSuelto = suma((a) => a.fuente === "real");
  const kgEstimado = suma((a) => a.fuente === "estimado");
  const servicios = aportes.reduce((t, a) => t + a.servicios, 0);

  return {
    aportes,
    kgTotal: redondear(kgViajes + kgRealSuelto + kgEstimado),
    kgReal: redondear(kgViajes + kgRealSuelto),
    kgEstimado: redondear(kgEstimado),
    kgViajes: redondear(kgViajes),
    kgRealSuelto: redondear(kgRealSuelto),
    servicios,
    serviciosConReal: aportes
      .filter((a) => a.fuente === "viaje" || a.fuente === "real")
      .reduce((t, a) => t + a.servicios, 0),
    serviciosSinPeso: aportes.filter((a) => a.fuente === "sin-peso").length,
  };
}

function redondear(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

/* ------------------------------------------------------------------ */
/* Doce meses (copia de `serie(…, "mes")` de Web/lib/datos-reportes.js) */
/* ------------------------------------------------------------------ */

/** Fecha YYYY-MM-DD → Date local, sin sorpresas de zona horaria. */
function aFecha(iso) {
  const [a, m, d] = String(iso).split("-").map(Number);
  return new Date(a, (m || 1) - 1, d || 1);
}

/** Aportes de peso → filas en toneladas (como `aFilas` de la web). */
export function filasDeAportes(totales) {
  return (totales?.aportes || []).map((a) => ({
    fecha: a.fecha,
    toneladas: a.kg / 1000,
    tipo: a.tipo,
    esReal: a.fuente === "viaje" || a.fuente === "real",
    servicios: a.servicios,
  }));
}

/**
 * Los últimos doce meses, los vacíos con CERO: el hueco es información
 * (dice que ese mes no se recogió). Cada mes trae cuánto es real y cuánto
 * estimado, en toneladas con dos decimales.
 */
export function serieMensual(filas, hoy = new Date()) {
  const cubos = [];
  for (let i = 11; i >= 0; i--) {
    const f = new Date(hoy);
    f.setMonth(hoy.getMonth() - i, 1);
    cubos.push({ clave: `${f.getFullYear()}-${f.getMonth()}`, periodo: MESES[f.getMonth()], volumen: 0, real: 0, estimado: 0, monto: 0, servicios: 0 });
  }
  const porClave = Object.fromEntries(cubos.map((c) => [c.clave, c]));
  for (const fila of filas || []) {
    const f = aFecha(fila.fecha);
    const cubo = porClave[`${f.getFullYear()}-${f.getMonth()}`];
    if (!cubo) continue;
    cubo.volumen += fila.toneladas;
    if (fila.esReal) cubo.real += fila.toneladas;
    else cubo.estimado += fila.toneladas;
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

/* ------------------------------------------------------------------ */
/* Las cifras de arriba (como /admin/reportes)                          */
/* ------------------------------------------------------------------ */

/**
 * Total, promedio, mejor mes, parte real y conversión de cotizaciones.
 * `cotizaciones` son las solicitudes del formulario del sitio con su
 * `estado`; "ganada" es la que se cerró.
 */
export function resumenReportes(mensual, cotizaciones = []) {
  const serie = (mensual || []).map((d) => ({ periodo: d.periodo, monto: d.volumen, real: d.real || 0, estimado: d.estimado || 0 }));
  const total = serie.reduce((a, d) => a + d.monto, 0);
  const totalReal = serie.reduce((a, d) => a + d.real, 0);
  const totalEstimado = serie.reduce((a, d) => a + d.estimado, 0);
  const mejor = serie.length ? serie.reduce((a, d) => (d.monto > a.monto ? d : a), serie[0]) : { periodo: "—", monto: 0 };
  const lista = cotizaciones || [];
  const ganadas = lista.filter((c) => c.estado === "ganada").length;
  return {
    serie,
    total,
    totalReal,
    totalEstimado,
    pctReal: total ? Math.round((totalReal / total) * 100) : 0,
    promedio: serie.length ? total / serie.length : 0,
    mejor,
    ganadas,
    totalSolicitudes: lista.length,
    conversion: lista.length ? Math.round((ganadas / lista.length) * 100) : 0,
  };
}

/** Toneladas, no pesos: "1.25 ton" (decir "$1.25" sería la etiqueta equivocada). */
export function ton(n) {
  const v = Math.round(Number(n || 0) * 100) / 100;
  // Sin depender de toLocaleString (Hermes viejo no siempre lo trae):
  const [ent, dec] = String(v).split(".");
  const conComas = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${conComas}${dec ? `.${dec}` : ""} ton`;
}
