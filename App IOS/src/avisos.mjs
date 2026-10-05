/**
 * AVISOS DE MORCAST AL CLIENTE — la lógica pura (sin React ni Supabase).
 *
 * Los manda la administración desde el panel (/admin/avisos): retrasos,
 * reagendas o un aviso general. Cuáles le tocan a cada cliente lo decide la
 * base (política `avisos_lee_cliente`, db/023-024); aquí solo se decide
 * cuáles siguen vigentes y cuáles ya leyó.
 *
 * Las reglas de vigencia son las de `Web/lib/avisos.mjs` (`avisoVigente`),
 * copiadas para que el portal y la app enseñen exactamente los mismos.
 *
 * DIFERENCIA CON LA WEB, a propósito (pedido de los dueños para la 1.1): en
 * el portal el aviso se cierra por sesión del navegador; en la app la
 * tarjeta NO se va hasta que el cliente toca "Enterado", y eso se guarda en
 * la base (`avisos_lecturas`). Así la oficina sabe quién se enteró, y el
 * aviso no reaparece en otro teléfono de la misma persona.
 */

/** Los motivos que acepta la base (db/023, avisos.motivo). */
export const MOTIVOS_AVISO = [
  { id: "retraso", texto: "Retraso" },
  { id: "reagenda", texto: "Reagenda" },
  { id: "general", texto: "Aviso general" },
];

/** Días que un aviso sigue a la vista aunque no tenga fecha de vigencia. */
export const DIAS_EN_PORTAL = 30;

export const textoMotivo = (id) => MOTIVOS_AVISO.find((m) => m.id === id)?.texto || "Aviso";

/**
 * Fecha de calendario de un instante, vista desde Matamoros ("2026-10-05").
 *
 * Si el motor de JavaScript no trae la zona horaria (Hermes viejo, por
 * ejemplo), se cae a la fecha LOCAL del teléfono: quien usa la app está en
 * Matamoros, así que es la misma. Lo que no se usa nunca es `toISOString()`,
 * que pasa a UTC y a las 7 de la tarde ya dice "mañana".
 */
export function fechaEnMatamoros(instante) {
  const d = instante instanceof Date ? instante : new Date(instante);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Matamoros",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mes}-${dia}`;
  }
}

export function hoyMatamoros(ahora = new Date()) {
  return fechaEnMatamoros(ahora);
}

/**
 * ¿Se enseña? Vigente = sin fecha de vigencia o con una de hoy en adelante,
 * Y mandado en los últimos 30 días. El tope es para los que se mandaron sin
 * fecha: sin él, "Hoy la ruta va tarde" se quedaría arriba para siempre.
 */
export function avisoVigente(aviso, { hoy = hoyMatamoros(), ahora = new Date() } = {}) {
  if (!aviso) return false;
  if (aviso.vigente_hasta && aviso.vigente_hasta < hoy) return false;
  const creado = new Date(aviso.creado);
  if (Number.isNaN(creado.getTime())) return false;
  const limite = ahora.getTime() - DIAS_EN_PORTAL * 24 * 60 * 60 * 1000;
  return creado.getTime() >= limite;
}

/**
 * Los que hay que enseñar: vigentes y SIN lectura propia, del más nuevo al
 * más viejo. `leidos` son los `aviso_id` de `avisos_lecturas` de quien tiene
 * la sesión (también los que acaba de tocar en este rato, aunque la base
 * todavía no conteste: la tarjeta se va al instante).
 */
export function avisosPorEnseñar(avisos, leidos, opciones) {
  const ya = new Set(leidos || []);
  return (avisos || [])
    .filter((a) => a && a.id && !ya.has(a.id) && avisoVigente(a, opciones))
    .sort((a, b) => (a.creado < b.creado ? 1 : a.creado > b.creado ? -1 : 0));
}

/**
 * ¿El error al guardar la lectura es un duplicado? Pasa si el cliente tocó
 * "Enterado" en dos teléfonos, o dos veces con mala señal: para él el aviso
 * YA está leído, así que no es un error que haya que enseñarle.
 */
export function esLecturaDuplicada(error) {
  if (!error) return false;
  return error.code === "23505" || /duplicate key/i.test(String(error.message || ""));
}
