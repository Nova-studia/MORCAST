/**
 * SEGUNDO PASO DEL PANEL EN LA APP — reglas puras (sin React ni red).
 *
 * Igual que en la web (`Web/lib/mfa.mjs`): el dueño y los administradores,
 * además de la contraseña, escriben un código de 6 dígitos que les llega por
 * correo. Pedido de los dueños (4-oct-2026): que una contraseña adivinada o
 * robada no baste para abrir saldos, datos fiscales y el padrón de clientes.
 *
 * En la app no hay cookie: el servidor (`/api/app/segundo-paso/verificar`)
 * entrega un PASE firmado que se guarda en SecureStore y se comprueba con
 * `/api/app/segundo-paso/estado` cada vez que se abre la administración. Lo
 * que vive aquí es lo que se puede decidir sin preguntarle al servidor.
 */

/** "123 456" o "123-456" → "123456". Solo dígitos; nada más viaja al servidor. */
export function limpiarCodigo(texto) {
  return String(texto ?? "").replace(/\D/g, "").slice(0, 6);
}

/** ¿Ya tiene los 6 dígitos? (No dice si es correcto: eso lo sabe el servidor.) */
export function codigoCompleto(texto) {
  return limpiarCodigo(texto).length === 6;
}

/**
 * ¿Vale la pena preguntarle al servidor por este pase guardado?
 *
 * Se descarta sin gastar red si: no hay pase, es de OTRO usuario (alguien
 * cerró sesión y entró otra persona en el mismo teléfono) o ya venció según
 * la fecha que dio el servidor. Aun así, el que pasa este filtro se comprueba
 * con `/estado`: la última palabra es del servidor, no del teléfono.
 *
 * @param {{pase?: string, vence?: string|number, uid?: string}|null} guardado
 */
export function paseUtil(guardado, uidActual, ahora = Date.now()) {
  if (!guardado || typeof guardado.pase !== "string" || !guardado.pase) return false;
  if (!uidActual || guardado.uid !== uidActual) return false;
  if (guardado.vence != null && guardado.vence !== "") {
    // El servidor manda `vence` en SEGUNDOS Unix; Date.now() va en ms. Un
    // número menor que 1e12 es de segundos (1e12 ms sería el año 2001).
    const crudo = typeof guardado.vence === "string" && /^\d+$/.test(guardado.vence) ? Number(guardado.vence) : guardado.vence;
    const vence = typeof crudo === "number" ? (crudo < 1e12 ? crudo * 1000 : crudo) : Date.parse(crudo);
    // Una fecha ilegible no se toma como "vigente": se pide código otra vez.
    if (!Number.isFinite(vence) || vence <= ahora) return false;
  }
  return true;
}

/**
 * Los motivos que puede contestar el servidor, en palabras para el dueño.
 * Si llega uno que no está aquí se enseña tal cual: el servidor escribe en
 * español y es mejor que un "algo falló". (Mismo mapa que la app de iPhone.)
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
