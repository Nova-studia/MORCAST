/**
 * QUIÉN LLAMA desde la app (iOS / Android) a una ruta `/api/app/...`.
 *
 * La app no tiene cookies de la web: manda `Authorization: Bearer
 * <access_token>` de SU sesión de Supabase. Aquí se decide todo con ese
 * token y con la base, nunca con lo que diga el cuerpo de la petición:
 *
 *  1. `sb.auth.getUser(token)` le pregunta al servidor de Auth si el token es
 *     de verdad, no venció y el usuario sigue existiendo. Decodificar el JWT
 *     aquí no basta: el token de un usuario ya borrado seguiría "pareciendo"
 *     bueno (mismo criterio que lib/eliminar-cuenta.mjs).
 *  2. El ROL sale de `perfiles` (la base), no de `app_metadata` del token:
 *     si la oficina desactiva a alguien o le cambia el rol, el token que ya
 *     traía en el teléfono sigue diciendo lo de antes hasta que caduque
 *     (una hora). La base dice lo de ahora.
 *  3. `sesion` es el `session_id` del token: el segundo paso del panel amarra
 *     el pase a ESA sesión (lib/mfa.mjs), igual que en la web.
 *
 * `sb` es un cliente con la llave de SERVICIO (salta el RLS para leer el
 * perfil). Sin imports de Next ni de Supabase: se prueba con un Supabase de
 * mentira en tests/app-auth.test.mjs.
 */

import { tokenDeCabecera } from "./eliminar-cuenta.mjs";
import { sesionDelToken } from "./mfa.mjs";

export { tokenDeCabecera };

export const ROLES_PERSONAL = ["dueno", "admin"];

export const MENSAJES_APP = {
  sinSesion: "Tu sesión ya no es válida. Vuelve a entrar.",
  inactivo: "Esta cuenta está desactivada. Habla con la oficina de Morcast.",
  sinPermiso: "Esta cuenta no tiene permiso para esto.",
  fallo: "No se pudo completar. Inténtalo otra vez en un momento.",
  demo: "El servidor está en modo de demostración.",
  freno: "Demasiados intentos seguidos. Espera unos minutos y vuelve a intentarlo.",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const esUuid = (v) => typeof v === "string" && UUID_RE.test(v);

/**
 * @param {{ token: string|null, sb: object, roles: string[], log?: object }} p
 * @returns {Promise<
 *   { ok: true, usuario: object, perfil: object, sesion: string|null } |
 *   { ok: false, status: number, motivo: string }
 * >}  Nunca lanza.
 */
export async function autenticarApp({ token, sb, roles, log = console }) {
  if (!token) return { ok: false, status: 401, motivo: MENSAJES_APP.sinSesion };

  let usuario = null;
  try {
    const { data, error } = await sb.auth.getUser(token);
    if (!error) usuario = data?.user ?? null;
  } catch (e) {
    log.error("[app] getUser falló:", e?.message || e);
  }
  if (!usuario) return { ok: false, status: 401, motivo: MENSAJES_APP.sinSesion };

  let perfil = null;
  try {
    const { data, error } = await sb
      .from("perfiles")
      .select("id, nombre, rol, cliente_id, activo")
      .eq("id", usuario.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    perfil = data ?? null;
  } catch (e) {
    log.error("[app] no se pudo leer el perfil:", e?.message || e);
    return { ok: false, status: 500, motivo: MENSAJES_APP.fallo };
  }

  // Sin perfil = registro a medias (aún sin sello): no es nadie todavía.
  if (!perfil) return { ok: false, status: 403, motivo: MENSAJES_APP.sinPermiso };
  if (!perfil.activo) return { ok: false, status: 403, motivo: MENSAJES_APP.inactivo };
  if (!roles.includes(perfil.rol)) return { ok: false, status: 403, motivo: MENSAJES_APP.sinPermiso };

  return { ok: true, usuario, perfil, sesion: sesionDelToken(token) };
}

/**
 * Escribe en la bitácora a nombre de quien llamó desde la app. Va aparte de
 * `registrar()` (lib/bitacora.js) porque aquel saca al actor de la cookie de
 * la web, y la app no tiene. Nunca lanza.
 */
export async function anotarBitacora(sb, { usuario, accion, tabla, registroId, detalle }, { log = console } = {}) {
  try {
    const { error } = await sb.from("bitacora").insert({
      actor_id: usuario?.id ?? null,
      actor_correo: usuario?.email ?? null,
      accion,
      tabla: tabla ?? null,
      registro_id: registroId != null ? String(registroId) : null,
      detalle: { ...(detalle || {}), origen: "app" },
    });
    if (error) log.error("[app] bitácora:", accion, error.message);
  } catch (e) {
    log.error("[app] bitácora:", accion, e?.message || e);
  }
}
