/**
 * NOTIFICACIONES AL TELÉFONO (Expo Push), desde el servidor.
 *
 * Por qué Expo y no directo a Apple/Google: las dos apps están hechas con
 * Expo y piden su token con `expo-notifications`. Ese token
 * (`ExponentPushToken[...]`) solo lo entiende el servicio de Expo, que a su
 * vez habla con APNs (iPhone) y FCM (Android). Así el servidor no guarda
 * certificados de Apple ni llaves de Google: eso vive en EAS.
 *
 * Reglas de este módulo:
 *  · NUNCA lanza. Una notificación que no sale no puede tumbar el aviso a
 *    clientes ni el reporte de un incidente: el correo y el portal siguen.
 *  · Manda en lotes de 100, el máximo que acepta Expo por petición.
 *  · Limpia los tokens muertos: cuando Expo contesta `DeviceNotRegistered`
 *    (desinstalaron la app o le quitaron el permiso), ese token se borra de
 *    `push_tokens`. Si no, cada aviso intentaría mandarle a teléfonos que ya
 *    no existen, para siempre.
 *  · `EXPO_ACCESS_TOKEN` es OPCIONAL: solo hace falta si en la cuenta de Expo
 *    se enciende "Enhanced security for push notifications". Sin él, Expo
 *    acepta igual.
 *
 * Lo que NO hace (todavía): leer los "recibos" (receipts) que Expo da unos
 * minutos después. Ahí también puede llegar un `DeviceNotRegistered` que el
 * primer ticket no traía. Para eso hace falta una tarea programada; por ahora
 * esos tokens se limpian la siguiente vez que Expo los rechace en el ticket.
 *
 * Sin imports de Supabase ni de Next a propósito: la base y `fetch` llegan
 * por parámetro, así `node --test` lo prueba con piezas de mentira
 * (tests/push.test.mjs) sin tocar Expo ni la base.
 */

export const URL_EXPO_PUSH = "https://exp.host/--/api/v2/push/send";
export const TAMANO_LOTE = 100;

/** Lo que Expo muestra en la notificación. Más largo, el teléfono lo corta. */
export const MAX_TITULO_PUSH = 80;
export const MAX_CUERPO_PUSH = 180;

const TOKEN_RE = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{1,200}\]$/;

/** ¿Tiene forma de token de Expo? (La base exige lo mismo, db/026.) */
export function tokenValido(token) {
  return TOKEN_RE.test(String(token ?? "").trim());
}

/** Parte una lista en pedazos de `n`. */
export function enLotes(lista, n = TAMANO_LOTE) {
  const lotes = [];
  for (let i = 0; i < lista.length; i += n) lotes.push(lista.slice(i, i + n));
  return lotes;
}

/** Recorta a `max` caracteres con "…" solo si de verdad se cortó. */
export function recortar(texto, max) {
  const limpio = String(texto ?? "").replace(/\s+/g, " ").trim();
  if (limpio.length <= max) return limpio;
  return `${limpio.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Tokens que vale la pena intentar: con forma de token y sin repetir. Acepta
 * cadenas o filas `{ token }` tal como salen de `push_tokens`.
 */
export function limpiarTokens(tokens) {
  const vistos = new Set();
  const limpios = [];
  for (const t of tokens || []) {
    const token = String(typeof t === "string" ? t : t?.token ?? "").trim();
    if (!tokenValido(token) || vistos.has(token)) continue;
    vistos.add(token);
    limpios.push(token);
  }
  return limpios;
}

/** Un mensaje por token, como lo pide la API de Expo. */
export function armarMensajes(tokens, { titulo, cuerpo, datos } = {}) {
  const title = recortar(titulo, MAX_TITULO_PUSH);
  const body = recortar(cuerpo, MAX_CUERPO_PUSH);
  return tokens.map((to) => ({
    to,
    title,
    body,
    data: datos || {},
    sound: "default",
    // "high" para que Android la muestre aunque el teléfono esté en reposo:
    // un incidente o un retraso pierden sentido si llegan una hora tarde.
    priority: "high",
    // Canal de Android que crea la app ("Avisos de Morcast", importancia
    // alta; App Android/src/push.js CANAL_AVISOS). Sin él, Android 8+ la
    // manda al canal por omisión, sin sonido ni globo. iOS lo ignora.
    channelId: "avisos",
  }));
}

/**
 * Lee la respuesta de Expo a UN lote.
 *
 * Expo contesta `{ data: [ticket, ...] }` con un ticket por mensaje, EN EL
 * MISMO ORDEN en que se mandaron. Cada ticket es `{ status: "ok", id }` o
 * `{ status: "error", message, details: { error: "DeviceNotRegistered" } }`.
 * Si toda la petición falla, contesta `{ errors: [...] }` sin `data`.
 *
 * Devuelve cuántos salieron, cuántos no y qué tokens hay que borrar.
 */
export function leerRespuesta(mensajes, respuesta) {
  const tickets = Array.isArray(respuesta?.data) ? respuesta.data : null;
  if (!tickets) return { enviadas: 0, fallidas: mensajes.length, muertos: [] };

  let enviadas = 0;
  let fallidas = 0;
  const muertos = [];
  mensajes.forEach((m, i) => {
    const t = tickets[i];
    if (t?.status === "ok") {
      enviadas++;
      return;
    }
    fallidas++;
    if (t?.details?.error === "DeviceNotRegistered") {
      // Expo a veces repite el token en `details.expoPushToken`; si no, es el
      // del mensaje en esa misma posición.
      muertos.push(t.details.expoPushToken || m.to);
    }
  });
  return { enviadas, fallidas, muertos };
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/** Manda un lote; un reintento si Expo dice que vamos muy rápido o se cayó. */
async function mandarLote(mensajes, { fetch: f, accessToken }) {
  const cabeceras = {
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate",
    "Content-Type": "application/json",
  };
  if (accessToken) cabeceras.Authorization = `Bearer ${accessToken}`;

  for (let intento = 0; intento < 2; intento++) {
    const res = await f(URL_EXPO_PUSH, { method: "POST", headers: cabeceras, body: JSON.stringify(mensajes) });
    if ((res.status === 429 || res.status >= 500) && intento === 0) {
      await espera(1000);
      continue;
    }
    let cuerpo = null;
    try {
      cuerpo = await res.json();
    } catch {
      /* respuesta que no es JSON: cuenta como fallida */
    }
    return cuerpo;
  }
  return null;
}

/**
 * Manda la misma notificación a todos estos tokens.
 *
 * @param {Array<string|{token:string}>} tokens
 * @param {{ titulo: string, cuerpo: string, datos?: object }} mensaje
 *   `datos` es lo que la app recibe al tocar la notificación para abrir la
 *   pantalla correcta: `{ tipo: 'aviso', id }` o `{ tipo: 'incidente', id }`.
 * @param {{ sb?: object, fetch?: Function, accessToken?: string, log?: object }} opciones
 *   `sb`: cliente de Supabase con la llave de servicio, para borrar los
 *   tokens muertos. Sin él (prototipo) no se borra nada.
 * @returns {Promise<{ enviadas: number, fallidas: number, borrados: number }>}
 */
export async function enviarPush(tokens, mensaje = {}, opciones = {}) {
  const {
    sb = null,
    fetch: f = globalThis.fetch,
    accessToken = process.env.EXPO_ACCESS_TOKEN || null,
    log = console,
  } = opciones;
  const resultado = { enviadas: 0, fallidas: 0, borrados: 0 };

  const limpios = limpiarTokens(tokens);
  if (!limpios.length || typeof f !== "function") return resultado;

  const muertos = [];
  for (const lote of enLotes(armarMensajes(limpios, mensaje))) {
    try {
      const r = leerRespuesta(lote, await mandarLote(lote, { fetch: f, accessToken }));
      resultado.enviadas += r.enviadas;
      resultado.fallidas += r.fallidas;
      muertos.push(...r.muertos);
    } catch (e) {
      // Sin red, Expo caído… Ese lote no salió; los demás se intentan igual.
      resultado.fallidas += lote.length;
      log.error("[push] no salió un lote:", e?.message || e);
    }
  }

  if (muertos.length && sb) {
    try {
      const { error } = await sb.from("push_tokens").delete().in("token", muertos);
      if (error) log.error("[push] no se pudieron borrar los tokens muertos:", error.message);
      else resultado.borrados = muertos.length;
    } catch (e) {
      log.error("[push] no se pudieron borrar los tokens muertos:", e?.message || e);
    }
  }

  if (resultado.fallidas) {
    log.warn?.(`[push] ${resultado.enviadas} enviadas, ${resultado.fallidas} fallidas, ${resultado.borrados} tokens muertos borrados`);
  }
  return resultado;
}

/* ------------------------------------------------------------------ */
/* A quién                                                             */
/* ------------------------------------------------------------------ */

/**
 * Los tokens de estos usuarios. `sb` con la llave de servicio: el RLS de
 * `push_tokens` solo deja a cada quien ver los suyos. Nunca lanza: sin la
 * tabla (migración 026 sin correr) devuelve [] y lo anota.
 */
export async function tokensDeUsuarios(sb, usuarioIds, { log = console } = {}) {
  const ids = [...new Set((usuarioIds || []).filter(Boolean))];
  if (!sb || !ids.length) return [];
  const tokens = [];
  try {
    // En pedazos: un `in (...)` con cientos de UUID hace una URL enorme.
    for (const lote of enLotes(ids, 150)) {
      const { data, error } = await sb.from("push_tokens").select("token").in("usuario_id", lote);
      if (error) throw new Error(error.message);
      tokens.push(...(data || []).map((f) => f.token));
    }
  } catch (e) {
    log.error("[push] no se pudieron leer los tokens:", e?.message || e);
    return [];
  }
  return tokens;
}

/**
 * Las cuentas de cliente ACTIVAS de estas empresas: a quién le toca la
 * notificación de un aviso y la "Y" de "Leído por X de Y".
 */
export async function usuariosClienteDe(sb, clienteIds, { log = console } = {}) {
  const ids = [...new Set((clienteIds || []).filter(Boolean))];
  if (!sb || !ids.length) return [];
  const usuarios = [];
  try {
    for (const lote of enLotes(ids, 150)) {
      const { data, error } = await sb
        .from("perfiles").select("id").eq("rol", "cliente").eq("activo", true).in("cliente_id", lote);
      if (error) throw new Error(error.message);
      usuarios.push(...(data || []).map((p) => p.id));
    }
  } catch (e) {
    log.error("[push] no se pudieron leer los usuarios de las empresas:", e?.message || e);
    return null; // null = no se sabe (distinto de "cero usuarios")
  }
  return usuarios;
}

/** Dueño y administradores activos: quienes reciben el aviso de un incidente. */
export async function usuariosOficina(sb, { log = console } = {}) {
  if (!sb) return [];
  try {
    const { data, error } = await sb.from("perfiles").select("id").in("rol", ["dueno", "admin"]).eq("activo", true);
    if (error) throw new Error(error.message);
    return (data || []).map((p) => p.id);
  } catch (e) {
    log.error("[push] no se pudo leer a la oficina:", e?.message || e);
    return [];
  }
}
