import { supabaseServidor, haySupabase } from "./supabase";
import { usuarioActual } from "./supabase-sesion";

/**
 * Bitácora de auditoría: quién hizo qué y cuándo.
 *
 * Importa porque aquí se mueve dinero. Cuando un cliente reclame que su
 * depósito no se aplicó, o que le cobraron un servicio que no pidió, esto es
 * lo único que contesta la pregunta "¿quién hizo esto?".
 *
 * Dos decisiones que valen la pena entender:
 *
 * 1. **Se escribe con la llave de SERVICIO, no con la sesión del usuario.**
 *    La tabla `bitacora` no tiene política de INSERT a propósito: si el propio
 *    actor pudiera escribirla, también podría maquillarla, y una bitácora que
 *    el interesado puede editar no prueba nada. Solo el servidor escribe.
 *
 * 2. **El actor se saca de la SESIÓN, nunca de lo que mande el cliente.**
 *    Si el navegador dijera quién es, cualquiera podría firmar un movimiento
 *    con el nombre de otro.
 */

/**
 * Deja constancia de una acción. Nunca lanza: si la bitácora falla, la
 * operación que la provocó ya ocurrió y no tiene caso deshacerla ni tumbarle
 * la pantalla al usuario. El fallo se registra en el log del servidor, que es
 * donde se va a notar.
 */
export async function registrar({ accion, tabla, registroId, detalle }) {
  try {
    if (!haySupabase()) return; // modo prototipo, sin base

    const quien = await usuarioActual();

    const { error } = await supabaseServidor().from("bitacora").insert({
      actor_id: quien?.id ?? null,
      actor_correo: quien?.correo ?? null,
      accion,
      tabla: tabla ?? null,
      registro_id: registroId != null ? String(registroId) : null,
      detalle: detalle ?? null,
    });

    if (error) console.error("[bitacora] no se pudo registrar:", accion, error.message);
  } catch (e) {
    console.error("[bitacora] no se pudo registrar:", accion, e?.message);
  }
}

/**
 * Lee la bitácora. Solo la ve el personal (lo impone el RLS, no esta función).
 */
export async function listarBitacora({ limite = 200, desde } = {}) {
  if (!haySupabase()) return [];

  const { supabaseSesion } = await import("./supabase-sesion");
  let consulta = (await supabaseSesion())
    .from("bitacora")
    .select("id, actor_correo, accion, tabla, registro_id, detalle, creado")
    .order("creado", { ascending: false })
    .limit(limite);

  if (desde) consulta = consulta.gte("creado", desde);

  const { data, error } = await consulta;
  if (error) {
    console.error("[bitacora] no se pudo leer:", error.message);
    return [];
  }
  return data ?? [];
}

/**
 * Cómo se lee cada acción en pantalla. La bitácora la va a leer alguien de
 * administración, no un programador, así que `aplicar_saldo` no sirve.
 */
export const TEXTO_ACCION = {
  aplicar_saldo: "Aplicó un depósito al saldo",
  rechazar_saldo: "Rechazó un depósito",
  confirmar_recoleccion: "Confirmó una recolección",
  rechazar_recoleccion: "Rechazó una recolección",
  cerrar_recoleccion: "Cerró una recolección con evidencia",
  cambiar_rol: "Cambió el rol de un usuario",
  alta_cliente: "Dio de alta un cliente",
  invitar_cliente: "Invitó a un cliente al portal",
  cambiar_estado_cotizacion: "Cambió el estado de una cotización",
};
