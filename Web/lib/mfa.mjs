/**
 * SEGUNDO PASO DEL PANEL (dueño y administradores): CÓDIGO POR CORREO.
 *
 * Por qué
 * -------
 * Los dueños pidieron (4-oct-2026) que la información delicada no se filtre.
 * Con solo correo y contraseña, una contraseña adivinada, reusada o robada
 * abre el panel completo: saldos, datos fiscales y el padrón de clientes.
 * Con el segundo paso hace falta además entrar al correo de la persona.
 *
 * Por qué por correo y no con una app de códigos: decisión de Luis (5-oct):
 * pedirle a la gente que instale otra app es complicado. Se sabe y se acepta
 * que protege menos que una app (si alguien entra al correo del admin, el
 * candado se cae) y que solo cuida la WEB del panel, no la base: Supabase no
 * reconoce este código como "segundo factor", así que la sesión sigue siendo
 * `aal1` para la base. Choferes y clientes no pasan por aquí.
 *
 * Cómo
 * ----
 *  1. Tras la contraseña, proxy.js manda a /admin/verificacion.
 *  2. Ahí se pide un código de 6 dígitos que llega al correo de la cuenta
 *     (app/acciones-segundo-paso.js). Vence en 10 min, 5 intentos.
 *  3. Si es correcto, el servidor deja una cookie `morcast_2p` FIRMADA (HMAC)
 *     y amarrada al usuario y a ESA sesión de Supabase (`session_id` del
 *     token). Al cerrar sesión o entrar en otro equipo, la sesión es otra y
 *     se vuelve a pedir el código. Una cookie copiada no sirve en otra sesión.
 *  4. proxy.js y usuarioActual() revisan esa cookie; sin ella, el personal
 *     no tiene rol de personal.
 *
 * Este archivo no importa nada de Node: usa Web Crypto, que existe tanto en
 * el servidor como en proxy.js.
 *
 * Válvula de emergencia: `MFA_PANEL=apagado` en Vercel lo desactiva (hay que
 * REDESPLEGAR para que tome efecto). No es para dejarlo así.
 */

export const RUTA_VERIFICACION = "/admin/verificacion";
export const COOKIE_PASE = "morcast_2p";
export const VIGENCIA_PASE_S = 7 * 24 * 60 * 60; // tope; la sesión manda antes
export const VIGENCIA_CODIGO_MIN = 10;
export const MAX_INTENTOS = 5;
export const ESPERA_REENVIO_S = 60;

/** ¿Está encendida la exigencia? Encendida salvo que se apague a propósito. */
export function mfaPanelActivo(entorno = process.env) {
  return String(entorno.MFA_PANEL || "").trim().toLowerCase() !== "apagado";
}

/**
 * Con qué se firma la cookie. `PANEL_2P_SECRETO` si existe; si no, la llave
 * de servicio de Supabase, que ya es un secreto del servidor y nunca sale al
 * navegador (así no hace falta dar de alta otra variable para empezar).
 */
export function secretoPanel(entorno = process.env) {
  return entorno.PANEL_2P_SECRETO || entorno.SUPABASE_SERVICE_ROLE_KEY || null;
}

/** ¿Esta persona tiene que pasar por el segundo paso antes de entrar? */
export function necesitaVerificar({ rol, paseValido }) {
  if (rol !== "dueno" && rol !== "admin") return false;
  return !paseValido;
}

/* ------------------------------------------------------------------ */
/* Firmar y comprobar el pase                                          */
/* ------------------------------------------------------------------ */

const codificador = new TextEncoder();

function aBase64Url(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function deBase64Url(texto) {
  const b64 = texto.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmac(secreto, texto) {
  const llave = await crypto.subtle.importKey(
    "raw", codificador.encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", llave, codificador.encode(texto)));
}

/** Compara sin cortar en el primer byte distinto (no filtra por tiempo). */
function iguales(a, b) {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a[i] ^ b[i];
  return dif === 0;
}

/** Pase para la cookie: `<datos>.<firma>`, ambos en base64url. */
export async function firmarPase({ uid, sesion, vence }, secreto) {
  const datos = aBase64Url(codificador.encode(JSON.stringify({ u: uid, s: sesion, v: vence })));
  return `${datos}.${aBase64Url(await hmac(secreto, datos))}`;
}

/** ¿El pase es auténtico, de este usuario, de esta sesión y vigente? */
export async function verificarPase(valor, { uid, sesion, ahora = Math.floor(Date.now() / 1000) }, secreto) {
  try {
    if (!valor || !secreto || !uid || !sesion) return false;
    const [datos, firma] = String(valor).split(".");
    if (!datos || !firma) return false;
    if (!iguales(deBase64Url(firma), await hmac(secreto, datos))) return false;
    const p = JSON.parse(new TextDecoder().decode(deBase64Url(datos)));
    return p.u === uid && p.s === sesion && Number(p.v) > ahora;
  } catch {
    return false;
  }
}

/** El `session_id` que Supabase mete en el token de acceso, o null. */
export function sesionDelToken(token) {
  try {
    const carga = String(token || "").split(".")[1];
    return JSON.parse(new TextDecoder().decode(deBase64Url(carga))).session_id || null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* El código                                                           */
/* ------------------------------------------------------------------ */

/** Seis dígitos al azar criptográfico (nunca Math.random). */
export function generarCodigo() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(n).padStart(6, "0");
}

/** Lo que se guarda en la base: nunca el código, solo su huella. */
export async function huellaCodigo(codigo, uid, secreto) {
  return aBase64Url(await hmac(secreto, `codigo:${uid}:${codigo}`));
}

/** "luisye85@gmail.com" → "l•••••5@gmail.com", para decir a dónde se mandó. */
export function ocultarCorreo(correo) {
  const [nombre, dominio] = String(correo || "").split("@");
  if (!nombre || !dominio) return "tu correo";
  if (nombre.length <= 2) return `${nombre[0]}•@${dominio}`;
  return `${nombre[0]}${"•".repeat(Math.min(nombre.length - 2, 6))}${nombre.at(-1)}@${dominio}`;
}
