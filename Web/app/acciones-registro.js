"use server";

import { supabaseServidor, haySupabase } from "@/lib/supabase";
import { supabaseSesion } from "@/lib/supabase-sesion";
import { casaDe, DESTINOS } from "@/lib/destino-sesion.mjs";
import { solicitudDeUsuario } from "@/lib/solicitudes-registro";
import { correoAvisoRegistro, correoAcuseRegistro } from "@/lib/correo";
import { registrar } from "@/lib/bitacora";

/**
 * EL REGISTRO ABIERTO: alguien entró con Google y deja sus datos.
 *
 * Va aparte de `acciones-alta.js` porque es otro flujo: aquel es un
 * formulario público de quien NO tiene sesión; este lo usa alguien que
 * acaba de identificarse con Google y ya tiene usuario.
 *
 * De quién es la solicitud NO se lee de lo que mande el navegador: sale de
 * la SESIÓN. Si viniera del formulario, cualquiera podría registrar datos a
 * nombre del usuario de otro.
 *
 * La escritura va con la llave de servicio porque `solicitudes_alta` no
 * tiene política de INSERT a propósito (010): si se abriera al público,
 * cualquiera podría llenarla de basura sin pasar por la pantalla.
 */

const LIMITES = { empresa: 120, contacto: 120, telefono: 30 };
const texto = (v, max) => String(v ?? "").trim().slice(0, max);

/** Los teléfonos de Matamoros son de 10 dígitos; se aceptan 10 a 15 por si traen lada. */
const digitos = (v) => String(v ?? "").replace(/\D/g, "");

function folioNuevo() {
  // REG-2026-8F3K. Prefijo distinto al de `acciones-alta.js` (ALTA-) para
  // que quien lo lea por teléfono sepa de cuál de las dos puertas vino.
  const azar = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `REG-${new Date().getFullYear()}-${azar}`;
}

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

/** Guarda los datos mínimos de quien acaba de entrar con Google. */
export async function registrarConGoogle({ empresa, telefono }) {
  if (!haySupabase()) return { ok: true, demo: true, folio: folioNuevo() };

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

  const limpio = {
    empresa: texto(empresa, LIMITES.empresa),
    telefono: texto(telefono, LIMITES.telefono),
    contacto: texto(
      user.user_metadata?.full_name || user.user_metadata?.name || user.email,
      LIMITES.contacto
    ),
    correo: texto(user.email, 160).toLowerCase(),
  };

  if (!limpio.empresa) return { ok: false, motivo: "Escribe el nombre de tu empresa." };
  const tel = digitos(limpio.telefono);
  if (tel.length < 10 || tel.length > 15) {
    return { ok: false, motivo: "El teléfono debe traer 10 dígitos (por ejemplo 868 384 9478)." };
  }

  // Si ya se había registrado, no se duplica: se le devuelve su folio y se
  // sigue adelante. La pantalla lo manda a la sala de espera igual, y así
  // recargar o darle dos veces al botón no crea filas gemelas ni truena
  // contra el índice único de la 017.
  const yaEsta = await solicitudDeUsuario(user.id);
  if (yaEsta) return { ok: true, folio: yaEsta.folio, repetido: true };

  const fila = {
    folio: folioNuevo(),
    origen: "google",
    usuario_id: user.id,
    correo_verificado: Boolean(user.email_confirmed_at),
    empresa: limpio.empresa,
    contacto: limpio.contacto,
    telefono: limpio.telefono,
    correo: limpio.correo,
    // No se pregunta y NO se inventa: el panel lo enseña como raya.
    servicios_por_mes: null,
    // La cobertura se calcula con un domicilio, y aquí todavía no hay.
    en_cobertura: false,
  };

  const { error } = await supabaseServidor().from("solicitudes_alta").insert(fila);
  if (error) {
    console.error("[registro] no se pudo guardar:", error.message);
    return { ok: false, motivo: "No se pudo guardar tu registro. Inténtalo de nuevo." };
  }

  // Los correos NO tumban el registro si fallan: ya quedó guardado. Pero el
  // fallo SÍ se anota — es la lección del mes que el sitio estuvo mudo sin
  // que nadie se enterara.
  try {
    await correoAvisoRegistro(fila);
  } catch (e) {
    console.error("[registro] aviso a Morcast falló:", e?.message);
  }
  try {
    await correoAcuseRegistro(fila);
  } catch (e) {
    console.error("[registro] acuse al cliente falló:", e?.message);
  }

  await registrar({
    accion: "registro_google",
    tabla: "solicitudes_alta",
    registroId: fila.folio,
    detalle: { empresa: limpio.empresa, correo: limpio.correo },
  });

  return { ok: true, folio: fila.folio };
}
