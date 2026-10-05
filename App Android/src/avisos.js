/**
 * AVISOS DE MORCAST AL CLIENTE — la lógica pura (sin React ni Supabase).
 *
 * Los manda la oficina desde /admin/avisos (db/023): retraso, reagenda o
 * general, a todos, a un sector, a una ruta o a una empresa. CUÁLES le tocan
 * a este cliente lo decide la base (RLS `avisos_lee_cliente`); aquí solo se
 * decide cuáles siguen VIGENTES y cuáles ya marcó "Enterado".
 *
 * Mismas reglas que `Web/lib/avisos.mjs` (`avisoVigente`, `DIAS_EN_PORTAL`)
 * para que el portal y la app enseñen los mismos avisos. Diferencia a
 * propósito: en la web "cerrar" un aviso dura lo que la pestaña; en la app el
 * botón "Enterado" queda guardado en la base (`avisos_lecturas`, db/026), así
 * el cliente no lo vuelve a ver en su teléfono ni al día siguiente.
 */

/** Días que un aviso sigue a la vista aunque no tenga fecha de vigencia. */
export const DIAS_EN_PORTAL = 30;

/** Los tres motivos que acepta la base (db/023, avisos.motivo). */
export const MOTIVOS_AVISO = [
  { id: "retraso", texto: "Retraso" },
  { id: "reagenda", texto: "Reagenda" },
  { id: "general", texto: "Aviso general" },
];

export const textoMotivo = (id) => MOTIVOS_AVISO.find((m) => m.id === id)?.texto || "Aviso";

/** Fecha de calendario LOCAL (AAAA-MM-DD). El teléfono vive en Matamoros. */
export function fechaLocal(instante = new Date()) {
  const d = instante instanceof Date ? instante : new Date(instante);
  if (Number.isNaN(d.getTime())) return "";
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/**
 * ¿El aviso sigue vigente?
 *   · Con `vigente_hasta`: hasta ese día INCLUSIVE ("aplica hasta el 7" se
 *     sigue viendo el 7 en la noche).
 *   · Y nunca más de 30 días desde que se mandó, tenga o no fecha.
 */
export function avisoVigente(aviso, { hoy = fechaLocal(), ahora = new Date() } = {}) {
  if (!aviso) return false;
  if (aviso.vigente_hasta && aviso.vigente_hasta < hoy) return false;
  const creado = new Date(aviso.creado);
  if (Number.isNaN(creado.getTime())) return false;
  const limite = ahora.getTime() - DIAS_EN_PORTAL * 24 * 60 * 60 * 1000;
  return creado.getTime() >= limite;
}

/**
 * Los que hay que enseñar: vigentes y sin "Enterado". `leidos` son los ids
 * que ya están en `avisos_lecturas` o que se tocaron en esta sesión.
 */
export function avisosPorMostrar(avisos, leidos, opciones) {
  const vistos = new Set(leidos || []);
  return (avisos || []).filter((a) => a && !vistos.has(a.id) && avisoVigente(a, opciones));
}

/**
 * ¿El error al guardar el "Enterado" es solo que YA estaba guardado?
 * 23505 = llave duplicada: el cliente tocó dos veces o en dos teléfonos.
 * Eso no es un fallo; el aviso ya quedó como leído.
 */
export function esDuplicado(error) {
  return Boolean(error && (error.code === "23505" || /duplicate key/i.test(error.message || "")));
}
