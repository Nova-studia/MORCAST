/**
 * Aviso de "mostrar la bienvenida" entre el botón del gafete (en el login) y
 * <Bienvenida /> (montada encima de toda la app en App.js). Si el aviso llega
 * antes de que alguien escuche, se guarda y se entrega al suscribirse.
 *
 * `esperarBienvenida()`: lo que salga después de entrar (el aviso de
 * notificaciones) espera a que termine, para no pisarle el final.
 * ⚠️ Igual en App Android y App IOS.
 */
let oyente = null;
let pendiente = null;
let fin = null;
let avisarFin = null;

export function mostrarBienvenida(datos) {
  fin = new Promise((listo) => { avisarFin = listo; });
  // Por si algo falla y nunca se anima: que nada se quede esperando para siempre.
  setTimeout(() => terminarBienvenida(), 12000);
  if (oyente) oyente(datos);
  else pendiente = datos;
}

export function escucharBienvenida(fn) {
  oyente = fn;
  if (pendiente) { const d = pendiente; pendiente = null; fn(d); }
  return () => { if (oyente === fn) oyente = null; };
}

export function terminarBienvenida() {
  if (avisarFin) { avisarFin(); avisarFin = null; }
  fin = null;
}

/** Se resuelve cuando termina la bienvenida en curso (o ya, si no hay). */
export function esperarBienvenida() {
  return fin || Promise.resolve();
}
