"use server";

import { haySupabase } from "@/lib/supabase";
import { supabaseSesion } from "@/lib/supabase-sesion";
import { casaDe, DESTINOS } from "@/lib/destino-sesion.mjs";
import { solicitudDeUsuario } from "@/lib/solicitudes-registro";
import { procesarAltaFirmada } from "@/lib/alta-servidor";

/**
 * EL REGISTRO ABIERTO: alguien entró con Google y se da de alta.
 *
 * Va aparte de `acciones-alta.js` porque es otra puerta: aquélla es un
 * formulario público de quien NO tiene sesión; ésta la usa alguien que
 * acaba de identificarse con Google y ya tiene usuario.
 *
 * Hasta el 5-oct-2026 aquí sólo se pedían empresa y teléfono. El socio pidió
 * que las dos puertas terminen IGUAL: alta amplia, firma electrónica, PDF y
 * "¡Alta exitosa!". La faena es la misma de `lib/alta-servidor.js`; lo único
 * propio de esta puerta es que el correo ya lo verificó Google, así que
 * queda confirmado desde el inicio (y así lo dice la evidencia del PDF).
 *
 * De quién es la solicitud NO se lee de lo que mande el navegador: sale de
 * la SESIÓN — el usuario y también el correo. Si vinieran del formulario,
 * cualquiera podría registrar datos a nombre del usuario de otro.
 *
 * La escritura va con la llave de servicio porque `solicitudes_alta` no
 * tiene política de INSERT a propósito (010): si se abriera al público,
 * cualquiera podría llenarla de basura sin pasar por la pantalla.
 */

/** El usuario de la sesión, comprobado contra el servidor de Supabase. */
async function usuarioDeLaSesion() {
  const supabase = await supabaseSesion();
  const { data: { user } } = await supabase.auth.getUser();
  return user || null;
}

/**
 * La solicitud de QUIEN PREGUNTA. Sin parámetros a propósito.
 *
 * 🔴 La versión con `usuarioId` NO puede exportarse desde aquí. Todo lo que
 * un archivo `"use server"` exporta queda como un endpoint abierto al mundo,
 * así que cualquiera podría mandarle el uuid de otra persona y sacarle su
 * folio y su empresa. El id sale de la sesión y de ningún otro lado; el
 * ayudante que sí recibe un id vive en `lib/solicitudes-registro.js`, que no
 * es "use server" y por lo tanto no se puede llamar desde fuera.
 */
export async function miSolicitud() {
  const user = await usuarioDeLaSesion();
  if (!user) return null;
  return solicitudDeUsuario(user.id);
}

/**
 * Recibe el alta firmada de quien entró con Google. Llega como FormData
 * (trae la firma y, si la suben, la constancia), igual que la del formulario
 * público.
 */
export async function registrarConGoogle(formData) {
  // Modo prototipo: sin base no hay sesión que leer; se firma a nombre de un
  // usuario de muestra para que la pantalla se pueda recorrer completa.
  if (!haySupabase()) {
    return procesarAltaFirmada({
      formData,
      origen: "google",
      usuario: { id: null, correo: "demo@morcast.mx", verificado: true },
    });
  }

  const user = await usuarioDeLaSesion();
  if (!user) return { ok: false, motivo: "Tu sesión se venció. Vuelve a entrar con Google." };

  // Quien ya tiene sello no pasa por aquí: es un cliente activo.
  //
  // ⚠️ "Tener sello" lo decide `casaDe`, igual que en `proxy.js` y en la sala
  // de espera. Con un `if (rol)` suelto, un rol que nadie reconoce —un
  // `"Cliente"` con mayúscula tecleado en el tablero de Supabase— bloqueaba el
  // registro de alguien que en realidad NO tiene acceso a nada, dejándolo sin
  // ninguna puerta: ni entra al portal ni puede dejar sus datos.
  if (casaDe(user.app_metadata?.rol) !== DESTINOS.pendiente) {
    return { ok: false, motivo: "Tu cuenta ya está dada de alta." };
  }

  // Si ya se había registrado, no se duplica: se le devuelve su folio y se
  // sigue adelante. La pantalla lo manda a la sala de espera igual, y así
  // recargar o darle dos veces al botón no crea filas gemelas ni truena
  // contra el índice único de la 017.
  const yaEsta = await solicitudDeUsuario(user.id);
  if (yaEsta) return { ok: true, folio: yaEsta.folio, repetido: true };

  return procesarAltaFirmada({
    formData,
    origen: "google",
    usuario: {
      id: user.id,
      correo: String(user.email || "").toLowerCase(),
      verificado: Boolean(user.email_confirmed_at),
    },
  });
}
