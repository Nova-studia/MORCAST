import { supabase, haySupabase } from "./supabase";
import { esCuentaDeMuestra } from "./cuenta-muestra";
import { EMPRESA_COTIZACION } from "./cotizacion-datos";

/**
 * "ELIMINAR MI CUENTA" — guía 5.1.1(v) de la App Store.
 *
 * El borrado de verdad lo hace la web (`Web/app/api/cuenta/eliminar`) con la
 * llave de servicio: desde el teléfono no se puede borrar un usuario de
 * Supabase Auth, y así debe ser (la llave anónima no tiene ese poder). La app
 * sólo manda SU token de sesión; el servidor decide quién es.
 *
 * Qué se borra y qué se conserva está explicado en `Web/lib/eliminar-cuenta.mjs`
 * y en el diálogo de `pantallas/Mas.js`.
 *
 * La cuenta del revisor de Apple (ver `cuenta-muestra.js`) NO se borra: se
 * contesta que sí sin llamar a nadie. El servidor también la protege, por si
 * llegara a la ruta desde una versión vieja de la app.
 */

// La web de Morcast. Se puede apuntar a otra (una vista previa de Vercel) con
// EXPO_PUBLIC_MORCAST_WEB, sin tocar el código.
const WEB = (process.env.EXPO_PUBLIC_MORCAST_WEB || EMPRESA_COTIZACION.sitio).replace(/\/+$/, "");

const FALLO =
  "No pudimos eliminar tu cuenta en este momento. Inténtalo de nuevo o escríbenos a contacto@morcast.mx.";

/**
 * Devuelve `{ ok: true, simulado? }` o `{ ok: false, mensaje }`. Nunca lanza.
 * NO cierra la sesión: eso lo hace quien llama, después de avisar.
 */
export async function eliminarMiCuenta() {
  // Sin base (modo demostración) no hay cuenta que borrar.
  if (!haySupabase()) return { ok: true, simulado: true };
  if (esCuentaDeMuestra()) return { ok: true, simulado: true };

  let token = null;
  try {
    // `getSession()` renueva el token si ya venció, así no llega uno caducado.
    const { data } = await supabase.auth.getSession();
    token = data?.session?.access_token || null;
  } catch {
    /* se contesta abajo */
  }
  if (!token) {
    return { ok: false, mensaje: "Tu sesión ya no es válida. Vuelve a entrar e inténtalo otra vez." };
  }

  // Sin respuesta en 20 s se da por fallido: mejor un "inténtalo de nuevo"
  // que una pantalla girando para siempre.
  const corte = new AbortController();
  const reloj = setTimeout(() => corte.abort(), 20000);
  try {
    const r = await fetch(`${WEB}/api/cuenta/eliminar`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: "{}",
      signal: corte.signal,
    });
    let cuerpo = {};
    try { cuerpo = await r.json(); } catch { /* respuesta sin JSON */ }
    if (!r.ok || !cuerpo.ok) return { ok: false, mensaje: cuerpo.mensaje || FALLO };
    return { ok: true, simulado: Boolean(cuerpo.simulado) };
  } catch {
    return {
      ok: false,
      mensaje: "No hay conexión con Morcast. Revisa tu señal e inténtalo otra vez.",
    };
  } finally {
    clearTimeout(reloj);
  }
}
