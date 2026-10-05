/**
 * SEGUNDO PASO DE LA ADMINISTRACIÓN EN LA APP — la lógica pura.
 *
 * Los dueños pidieron (4-oct-2026) que con la contraseña sola no se abra la
 * administración: hace falta además un código que llega al correo de la
 * cuenta. En la web vive en una cookie firmada (`Web/lib/mfa.mjs`); en la app
 * el servidor entrega un `pase` que se guarda en el llavero del iPhone
 * (SecureStore) y se vuelve a comprobar con el servidor cada vez que se abre.
 *
 * Aquí solo lo que no necesita red ni React, para probarlo con `node --test`.
 */

/** El código del correo: 6 dígitos (lo que manda `acciones-segundo-paso`). */
export function limpiarCodigo(texto) {
  return String(texto ?? "").replace(/\D/g, "").slice(0, 6);
}

export function codigoCompleto(texto) {
  return /^\d{6}$/.test(String(texto ?? ""));
}

/**
 * ¿El pase guardado todavía podría servir, antes de preguntarle al
 * servidor? Si `vence` ya pasó no vale la pena gastar una llamada: se pide
 * el código de nuevo. Si no hay `vence` (o no se entiende), se pregunta: el
 * que manda es el servidor.
 */
export function paseLocalVigente(guardado, ahora = new Date()) {
  if (!guardado || typeof guardado.pase !== "string" || !guardado.pase) return false;
  if (!guardado.vence) return true;
  const vence = new Date(guardado.vence);
  if (Number.isNaN(vence.getTime())) return true;
  return vence.getTime() > ahora.getTime();
}

/** Lo que se guarda en el llavero: el pase, su vencimiento y de QUIÉN es. */
export function empacarPase({ pase, vence }, usuarioId) {
  return JSON.stringify({ pase: String(pase || ""), vence: vence || null, usuario: usuarioId || null });
}

/**
 * Lee lo guardado. Un pase de OTRO usuario no sirve: si en el mismo iPhone
 * entra otra persona del equipo, tiene que pasar por su propio código.
 */
export function desempacarPase(texto, usuarioId) {
  if (!texto) return null;
  let p;
  try {
    p = JSON.parse(texto);
  } catch {
    return null;
  }
  if (!p || typeof p.pase !== "string" || !p.pase) return null;
  if (usuarioId && p.usuario && p.usuario !== usuarioId) return null;
  return p;
}

/**
 * Los motivos que puede contestar el servidor, en palabras para el dueño.
 * Si llega uno que no está aquí se enseña tal cual: lo escribe el servidor
 * en español y es mejor que un "algo falló".
 */
const MENSAJES = {
  sin_sesion: "Tu sesión se venció. Vuelve a entrar con tu contraseña.",
  no_es_personal: "Esta cuenta no es de la administración.",
  espera: "Ya te mandamos un código hace un momento. Espera un minuto para pedir otro.",
  codigo_incorrecto: "Ese código no es. Revisa el último correo que te llegó.",
  codigo_vencido: "El código ya venció. Pide uno nuevo.",
  demasiados_intentos: "Demasiados intentos. Pide un código nuevo.",
};

export function mensajeSegundoPaso(motivo, respaldo = "No se pudo completar. Inténtalo de nuevo.") {
  if (!motivo) return respaldo;
  return MENSAJES[motivo] || String(motivo);
}

/** "j***@morcast.mx": para decir a dónde llegó el código sin enseñarlo completo. */
export function correoOculto(correo) {
  const c = String(correo || "").trim();
  const at = c.indexOf("@");
  if (at < 1) return c;
  return `${c[0]}***${c.slice(at)}`;
}
