/**
 * Aviso de "mostrar la bienvenida" entre el botón del gafete (en el login) y
 * <Bienvenida /> (montada encima de toda la app en App.js). Si el aviso llega
 * antes de que alguien escuche, se guarda y se entrega al suscribirse.
 * ⚠️ Igual en App Android y App IOS.
 */
let oyente = null;
let pendiente = null;

export function mostrarBienvenida(datos) {
  if (oyente) oyente(datos);
  else pendiente = datos;
}

export function escucharBienvenida(fn) {
  oyente = fn;
  if (pendiente) { const d = pendiente; pendiente = null; fn(d); }
  return () => { if (oyente === fn) oyente = null; };
}
