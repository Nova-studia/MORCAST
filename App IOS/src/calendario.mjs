/**
 * FECHAS PARA AGENDAR — lógica pura (sin React).
 *
 * La "Recolección extra" (6-oct-2026, igual que `/portal/agendar`): el
 * cliente elige CUALQUIER día de hoy a un año, no solo los de su ruta. La web
 * usa el `<input type="date">` del navegador; en el teléfono no hay uno sin
 * agregar un módulo nativo, así que la app dibuja su propio calendario con
 * estas cuentas.
 *
 * Las fechas son de CALENDARIO ("2026-10-06"), no instantes: nunca
 * `toISOString()`, que pasa a UTC y en la noche de Matamoros da el día de
 * mañana.
 *
 * ⚠️ ESTE ARCHIVO ESTÁ DUPLICADO en las dos apps (`calendario.mjs` en iOS,
 * `calendario.js` en Android). Mismo contenido.
 */

export const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Encabezado de la semana, de domingo a sábado (como los calendarios de México). */
export const DIAS_CORTOS = ["D", "L", "M", "M", "J", "V", "S"];

const pad = (n) => String(n).padStart(2, "0");

/** Date (hora local) → "2026-10-06". */
export function aISO(f) {
  return `${f.getFullYear()}-${pad(f.getMonth() + 1)}-${pad(f.getDate())}`;
}

/** "2026-10-06" → Date a mediodía local (a mediodía ningún cambio de horario mueve el día). */
export function deISO(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!m) return null;
  const f = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  return aISO(f) === iso ? f : null; // rechaza "2026-02-31"
}

/** `iso` + `n` días, en calendario. */
export function sumarDias(iso, n) {
  const f = deISO(iso);
  if (!f) return null;
  f.setDate(f.getDate() + n);
  return aISO(f);
}

/**
 * De hoy a 365 días. La base (db/013) acepta hasta `current_date + 365`; la
 * web pone "un año" en el calendario, que en año bisiesto es un día más y la
 * base lo rechazaría con un error de permisos. Aquí, 365 justos.
 */
export function limitesExtra(hoy) {
  return { min: hoy, max: sumarDias(hoy, 365) };
}

/** ¿`fecha` es un día real entre `min` y `max` (inclusive)? */
export function fechaEnRango(fecha, { min, max }) {
  if (!deISO(fecha)) return false;
  return (!min || fecha >= min) && (!max || fecha <= max);
}

/**
 * Para la recolección extra: qué decir si la fecha no sirve, o null si sirve.
 */
export function revisarFechaExtra(fecha, hoy) {
  if (!fecha) return "Elige el día de tu recolección.";
  if (!deISO(fecha)) return "Esa fecha no existe.";
  const { min, max } = limitesExtra(hoy);
  if (fecha < min) return "Elige un día de hoy en adelante.";
  if (fecha > max) return "Solo se puede agendar hasta un año adelante.";
  return null;
}

/**
 * Las semanas de un mes para pintar la cuadrícula: arreglos de 7, con
 * `null` en los huecos antes del día 1 y después del último.
 *
 * @param {number} año
 * @param {number} mes  0 = enero
 * @returns {Array<Array<string|null>>}  fechas ISO
 */
export function semanasDelMes(año, mes) {
  const primero = new Date(año, mes, 1, 12);
  const dias = new Date(año, mes + 1, 0, 12).getDate();
  const celdas = Array(primero.getDay()).fill(null);
  for (let d = 1; d <= dias; d++) celdas.push(`${año}-${pad(mes + 1)}-${pad(d)}`);
  while (celdas.length % 7) celdas.push(null);
  const semanas = [];
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7));
  return semanas;
}

/** "martes 7 de octubre" — lo que pregunta la gente es el día, no el número. */
export function fechaConDia(iso) {
  const f = deISO(iso);
  if (!f) return String(iso || "");
  const dias = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  return `${dias[f.getDay()]} ${f.getDate()} de ${MESES[f.getMonth()]}`;
}
