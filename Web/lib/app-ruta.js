import { supabaseServidor, haySupabase } from "./supabase";
import { pasarFreno } from "./freno";
import { autenticarApp, tokenDeCabecera, MENSAJES_APP, ROLES_PERSONAL } from "./app-auth.mjs";
import { mfaPanelActivo, secretoPanel, verificarPase } from "./mfa.mjs";

/**
 * La entrada común de las rutas `/api/app/...` que llaman las apps.
 *
 * Cada ruta hace lo mismo antes de su trabajo: modo prototipo → 503; token
 * Bearer → quién es y su rol (lib/app-auth.mjs, desde la base); freno por
 * USUARIO. Aquí una sola vez para que ninguna ruta se salte un paso.
 *
 * El freno va por usuario y no por IP a propósito: los teléfonos salen a
 * internet por la IP del operador celular, compartida por miles de personas,
 * y un freno por IP frenaría a gente que no tiene nada que ver. Con
 * `porIp: false`, `pasarFreno` usa el nombre tal cual como clave, así que se
 * le pasa ya con el id del usuario adentro.
 *
 * Estas rutas no pasan por proxy.js (solo cuida /admin, /portal y /chofer)
 * ni usan cookies: todo sale del token.
 */

export const SIN_CACHE = { "Cache-Control": "no-store" };

/** Respuesta JSON que nadie (ni Vercel ni el teléfono) guarda en caché. */
export const responder = (cuerpo, status = 200) => Response.json(cuerpo, { status, headers: SIN_CACHE });

/**
 * @param {Request} peticion
 * @param {{ roles: string[], freno: { nombre: string, maximo: number, minutos: number } }} opciones
 * @returns {Promise<{ respuesta: Response } | { sb, usuario, perfil, sesion, cuerpo }>}
 *   `cuerpo` es el JSON de la petición ya leído ({} si no trae o no es JSON).
 */
export async function entrarApp(peticion, { roles, freno }) {
  if (!haySupabase()) return { respuesta: responder({ ok: false, motivo: MENSAJES_APP.demo }, 503) };

  const sb = supabaseServidor();
  const quien = await autenticarApp({
    token: tokenDeCabecera(peticion.headers.get("authorization")),
    sb,
    roles,
  });
  if (!quien.ok) return { respuesta: responder({ ok: false, motivo: quien.motivo }, quien.status) };

  if (freno) {
    const pasa = await pasarFreno(`${freno.nombre}:${quien.usuario.id}`, {
      maximo: freno.maximo,
      minutos: freno.minutos,
      porIp: false,
    });
    if (!pasa) return { respuesta: responder({ ok: false, motivo: MENSAJES_APP.freno }, 429) };
  }

  let cuerpo = {};
  try {
    const leido = await peticion.json();
    if (leido && typeof leido === "object" && !Array.isArray(leido)) cuerpo = leido;
  } catch {
    /* sin cuerpo o no es JSON: cada ruta valida lo que necesita */
  }

  return { sb, usuario: quien.usuario, perfil: quien.perfil, sesion: quien.sesion, cuerpo };
}

/**
 * Lo mismo que `entrarApp`, para las acciones de ADMINISTRACIÓN que la app
 * hace en nombre del dueño o de un admin (6-oct-2026, paridad con la web).
 *
 * Además del rol exige el SEGUNDO PASO, igual que el panel web: el `pase`
 * que entregó /api/app/segundo-paso/verificar viaja en el cuerpo (`pase`) y
 * se comprueba aquí contra el usuario y la sesión (lib/mfa.mjs). Sin pase
 * válido → 403 con `segundoPaso: true`, para que la app pida el código otra
 * vez. Con `MFA_PANEL=apagado` no se exige, igual que en la web.
 *
 * `soloDueno: true` para lo que en la web también es solo del dueño
 * (invitar o desactivar administradores).
 */
export async function entrarAppAdmin(peticion, { freno, soloDueno = false } = {}) {
  const r = await entrarApp(peticion, { roles: soloDueno ? ["dueno"] : ROLES_PERSONAL, freno });
  if (r.respuesta) return r;
  if (mfaPanelActivo()) {
    const valido = await verificarPase(
      typeof r.cuerpo.pase === "string" ? r.cuerpo.pase : null,
      { uid: r.usuario.id, sesion: r.sesion },
      secretoPanel()
    );
    if (!valido) {
      return {
        respuesta: responder(
          { ok: false, segundoPaso: true, motivo: "Vuelve a confirmar con el código que te llega por correo." },
          403
        ),
      };
    }
  }
  return r;
}
