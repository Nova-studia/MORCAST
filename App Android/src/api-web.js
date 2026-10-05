import { supabase, haySupabase } from "./supabase";
import { EMPRESA_COTIZACION } from "./cotizacion-datos";

/**
 * LLAMADAS A LA API DE LA WEB (`/api/app/...`) con la sesión de quien usa la
 * app. Mismo patrón que `eliminar-cuenta.js`: la app manda SU token de
 * sesión en `Authorization: Bearer …` y el servidor decide quién es y qué
 * puede. Desde el teléfono no viaja ninguna llave de servidor, ni debe.
 *
 * Lo usan el segundo paso del admin (`segundo-paso.js`) y el aviso de
 * incidentes del chofer (`datos-remoto.js`).
 */

// La web de Morcast. Se puede apuntar a otra (una vista previa de Vercel) con
// EXPO_PUBLIC_MORCAST_WEB, sin tocar el código.
export const WEB = (process.env.EXPO_PUBLIC_MORCAST_WEB || EMPRESA_COTIZACION.sitio).replace(/\/+$/, "");

const SIN_RED = "No hay conexión con Morcast. Revisa tu señal e inténtalo otra vez.";

/** El token vigente. `getSession()` lo renueva si ya venció. */
async function tokenDeSesion() {
  if (!haySupabase()) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  } catch {
    return null;
  }
}

/**
 * POST a `/api/app/<ruta>`. NUNCA lanza: devuelve lo que contestó el servidor
 * (`{ ok, ... }`) o `{ ok:false, motivo, red?:true, sesion?:false }`.
 *
 * `red: true` distingue "no hubo respuesta" de "el servidor dijo que no":
 * quien llama decide si reintentar o creerle al servidor.
 *
 * Sin respuesta en 20 s se da por fallido: mejor un "inténtalo de nuevo" que
 * una pantalla girando para siempre.
 */
export async function postApp(ruta, cuerpo = {}, { espera = 20000 } = {}) {
  const token = await tokenDeSesion();
  if (!token) {
    return { ok: false, sesion: false, motivo: "Tu sesión ya no es válida. Vuelve a entrar." };
  }

  const corte = new AbortController();
  const reloj = setTimeout(() => corte.abort(), espera);
  try {
    const r = await fetch(`${WEB}/api/app/${ruta.replace(/^\/+/, "")}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo || {}),
      signal: corte.signal,
    });
    let datos = null;
    try {
      datos = await r.json();
    } catch {
      /* respuesta sin JSON: se contesta abajo */
    }
    if (datos && typeof datos === "object") {
      // El servidor manda `{ ok:false, motivo }` también con 4xx: se respeta
      // su motivo, que es el que sabe qué pasó.
      if (!r.ok && datos.ok !== false) return { ok: false, motivo: datos.motivo || `Error ${r.status}.` };
      return datos;
    }
    return { ok: false, motivo: r.ok ? "Respuesta inesperada del servidor." : `Error ${r.status} del servidor.` };
  } catch {
    return { ok: false, red: true, motivo: SIN_RED };
  } finally {
    clearTimeout(reloj);
  }
}
