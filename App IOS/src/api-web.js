import { supabase, haySupabase } from "./supabase";
import { EMPRESA_COTIZACION } from "./cotizacion-datos";

/**
 * Llamadas a la WEB de Morcast (`/api/app/...`) con la sesión del usuario.
 *
 * Mismo patrón que `eliminar-cuenta.js`: hay cosas que la app no puede hacer
 * con la llave pública —mandar un correo, firmar un pase, avisar por push a
 * la oficina— y las hace el servidor. La app solo manda SU token de sesión
 * (`Authorization: Bearer …`); quién es y qué puede lo decide el servidor.
 *
 * Se puede apuntar a otra web (una vista previa de Vercel) con
 * EXPO_PUBLIC_MORCAST_WEB, igual que la eliminación de cuenta.
 */
const WEB = (process.env.EXPO_PUBLIC_MORCAST_WEB || EMPRESA_COTIZACION.sitio).replace(/\/+$/, "");

/** El token vigente, o null. `getSession()` lo renueva si ya venció. */
export async function tokenDeSesion() {
  if (!haySupabase()) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  } catch {
    return null;
  }
}

/**
 * POST a la web. Devuelve SIEMPRE un objeto y nunca lanza:
 *   · lo que contestó el servidor (`{ ok, ... }`), o
 *   · `{ ok:false, motivo:'sin_sesion' }` si no hay token, o
 *   · `{ ok:false, sinRed:true, motivo }` si no hubo respuesta.
 *
 * Sin respuesta en `espera` ms se da por fallida: mejor un "inténtalo de
 * nuevo" que una pantalla girando para siempre con la señal de la calle.
 */
export async function postWeb(ruta, cuerpo = {}, { espera = 20000 } = {}) {
  const token = await tokenDeSesion();
  if (!token) return { ok: false, motivo: "sin_sesion" };

  const corte = new AbortController();
  const reloj = setTimeout(() => corte.abort(), espera);
  try {
    const r = await fetch(`${WEB}${ruta}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo || {}),
      signal: corte.signal,
    });
    let datos = {};
    try { datos = await r.json(); } catch { /* respuesta sin JSON */ }
    if (!r.ok && datos.ok === undefined) {
      return { ok: false, motivo: datos.motivo || datos.mensaje || `El servidor respondió ${r.status}.`, status: r.status };
    }
    return { status: r.status, ...datos };
  } catch {
    return { ok: false, sinRed: true, motivo: "No hay conexión con Morcast. Revisa tu señal e inténtalo otra vez." };
  } finally {
    clearTimeout(reloj);
  }
}
