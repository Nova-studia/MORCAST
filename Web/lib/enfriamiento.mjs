/**
 * ¿PUEDE PEDIR OTRO ENLACE DE RECUPERACIÓN?
 *
 * Sin esto, la pantalla de "olvidé mi contraseña" es un botón para bombardear
 * el buzón de cualquier cliente: se teclea su correo y se pulsa en bucle. No
 * hace falta ni tener cuenta.
 *
 * No se inventa ninguna tabla para llevar la cuenta: Supabase ya guarda
 * `recovery_sent_at` en cada usuario, y se actualiza sola cada vez que se
 * genera un enlace. Basta con leerla.
 *
 * Va aparte y en .mjs porque es la única parte con una regla de verdad, y así
 * se prueba con relojes falsos en vez de esperando un minuto de verdad.
 */

/** Lo que hay que esperar entre dos peticiones del mismo correo. */
export const ESPERA_MS = 60_000;

/**
 * @param {string|Date|null|undefined} ultimoEnvio  `recovery_sent_at` del usuario
 * @param {Date} ahora                              el momento actual
 * @returns {{ puede: boolean, faltanSegundos: number }}
 *
 * `faltanSegundos` se redondea hacia arriba, para no decirle a alguien que
 * espere 0 segundos cuando todavía le faltan milésimas.
 */
export function puedePedirEnlace(ultimoEnvio, ahora) {
  if (!ultimoEnvio) return { puede: true, faltanSegundos: 0 };

  const antes = ultimoEnvio instanceof Date ? ultimoEnvio : new Date(ultimoEnvio);
  // Una fecha que no se entiende NO bloquea: preferimos mandar un correo de
  // más que dejar a alguien sin poder recuperar su cuenta por un dato sucio.
  if (Number.isNaN(antes.getTime())) return { puede: true, faltanSegundos: 0 };

  const pasado = ahora.getTime() - antes.getTime();
  // Un `recovery_sent_at` en el futuro (relojes desfasados) tampoco bloquea
  // para siempre: se trata como si acabara de pasar el tiempo.
  if (pasado < 0) return { puede: true, faltanSegundos: 0 };
  if (pasado >= ESPERA_MS) return { puede: true, faltanSegundos: 0 };

  return { puede: false, faltanSegundos: Math.ceil((ESPERA_MS - pasado) / 1000) };
}
