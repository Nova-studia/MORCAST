/**
 * CÓMO SE VE LA BITÁCORA: por día y en palabras (lógica pura, sin red).
 *
 * LA BITÁCORA POR DÍA (pedido de Luis, 6-oct-2026): al abrir se ve solo lo
 * de HOY, con un selector para ir a otro día.
 *
 * El cuidado de este archivo es la zona horaria. "Hoy" es el día de
 * Matamoros, pero `creado` se guarda como instante (timestamptz) y Vercel
 * corre en UTC: a las 7 de la tarde de Matamoros allá ya es mañana. Filtrar
 * por la fecha UTC partía el día de la oficina en dos — lo de la tarde
 * salía en el día siguiente. Por eso el día se convierte en su rango de
 * INSTANTES (de la medianoche de Matamoros a la siguiente) y la consulta va
 * con `creado >= desde` y `creado < hasta`.
 *
 * Los días de cambio de horario duran 23 o 25 horas: `hasta` se calcula como
 * la medianoche del día SIGUIENTE, no como `desde + 24 h`.
 *
 * Pruebas en tests/bitacora-vista.test.mjs. Las apps tienen una copia
 * (src/bitacora-vista) que sus pruebas comparan contra ésta.
 */

export const ZONA_OFICINA = "America/Matamoros";

const FECHA_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** ¿"2026-10-06" es una fecha de calendario de verdad? */
export function fechaValida(texto) {
  const m = FECHA_RE.exec(String(texto ?? ""));
  if (!m) return false;
  const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const f = new Date(Date.UTC(a, mes - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === mes - 1 && f.getUTCDate() === d;
}

/** Fecha de calendario de un instante, vista desde Matamoros ("2026-10-06"). */
export function diaEnMatamoros(instante = new Date()) {
  const d = instante instanceof Date ? instante : new Date(instante);
  if (Number.isNaN(d.getTime())) return "";
  try {
    // en-CA formatea como AAAA-MM-DD.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: ZONA_OFICINA, year: "numeric", month: "2-digit", day: "2-digit",
    }).format(d);
  } catch {
    // Sin datos de zona horaria: la fecha local (quien usa esto está en Matamoros).
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
}

/** Suma (o resta) días a una fecha de calendario. Sin zonas: aritmética de calendario. */
export function moverDia(fecha, dias) {
  const m = FECHA_RE.exec(String(fecha ?? ""));
  if (!m) return "";
  const f = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + Number(dias || 0)));
  return f.toISOString().slice(0, 10);
}

/**
 * Minutos que Matamoros va DETRÁS de UTC en ese instante (360 en invierno,
 * 300 en horario de verano). null si el motor no sabe de zonas horarias.
 */
function desfaseMin(instanteMs) {
  try {
    const partes = new Intl.DateTimeFormat("en-US", {
      timeZone: ZONA_OFICINA, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(instanteMs));
    const v = Object.fromEntries(partes.map((p) => [p.type, p.value]));
    const comoUtc = Date.UTC(Number(v.year), Number(v.month) - 1, Number(v.day), Number(v.hour) % 24, Number(v.minute), Number(v.second));
    return Math.round((instanteMs - comoUtc) / 60000);
  } catch {
    return null;
  }
}

/** El instante (ms) de la medianoche de Matamoros que abre ese día. */
function medianoche(fecha) {
  const m = FECHA_RE.exec(fecha);
  const comoUtc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d1 = desfaseMin(comoUtc);
  if (d1 === null) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
  // Dos pasadas: el desfase de la medianoche puede no ser el de la hora UTC
  // con que se adivinó (el cambio de horario cae de madrugada).
  const intento = comoUtc + d1 * 60000;
  const d2 = desfaseMin(intento);
  return comoUtc + (d2 ?? d1) * 60000;
}

/**
 * El rango de instantes de un día de Matamoros, para la consulta:
 * `creado >= desde` y `creado < hasta`. null si la fecha no es válida.
 *
 * @param {string} fecha "2026-10-06"
 * @returns {{ desde: string, hasta: string } | null}  ISO en UTC
 */
export function rangoDelDia(fecha) {
  if (!fechaValida(fecha)) return null;
  return {
    desde: new Date(medianoche(fecha)).toISOString(),
    hasta: new Date(medianoche(moverDia(fecha, 1))).toISOString(),
  };
}

/** "Hoy", "Ayer" o la fecha escrita ("lun 5 oct 2026"), para el encabezado. */
export function nombreDelDia(fecha, hoy = diaEnMatamoros()) {
  if (fecha === hoy) return "Hoy";
  if (fecha === moverDia(hoy, -1)) return "Ayer";
  const m = FECHA_RE.exec(String(fecha ?? ""));
  if (!m) return "";
  const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const f = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return `${DIAS[f.getUTCDay()]} ${f.getUTCDate()} ${MESES[f.getUTCMonth()]} ${f.getUTCFullYear()}`;
}

/**
 * El día que se pide, ya decidido: el de la dirección si es válido y no es
 * futuro; si no, hoy. Un día futuro siempre estaría vacío.
 */
export function diaPedido(texto, hoy = diaEnMatamoros()) {
  const t = String(texto ?? "").trim();
  if (!fechaValida(t) || t > hoy) return hoy;
  return t;
}

/**
 * Lo que hace falta saber de un movimiento, sin volcarle el JSON encima.
 * (Vivía dentro de /admin/bitacora; aquí para que la app diga lo mismo.)
 */
export function resumenBitacora(fila) {
  const d = fila?.detalle || {};
  const partes = [];
  if (d.folio) partes.push(d.folio);
  if (d.monto != null) {
    partes.push(new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(d.monto));
  }
  if (d.nombre) partes.push(d.nombre);
  if (d.titulo) partes.push(`«${d.titulo}»`);
  if (d.rol_nuevo) partes.push(`rol: ${d.rol_nuevo}`);
  if (d.estado) partes.push(d.estado);
  if (d.notas) partes.push(`«${d.notas}»`);
  // Las filas que anota la base (db/022) traen qué columnas cambiaron.
  if (d.cambios) partes.push(`cambió: ${Object.keys(d.cambios).join(", ")}`);
  // Lo que se hizo desde el teléfono lo dice (anotarBitacora pone `origen`).
  if (d.origen === "app") partes.push("desde la app");
  return partes.join(" · ") || "—";
}
