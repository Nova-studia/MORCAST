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
  invitar_equipo: "Invitó a alguien al equipo",
  desactivar_usuario: "Desactivó la cuenta de alguien del equipo",
  reactivar_usuario: "Reactivó la cuenta de alguien del equipo",
  cambiar_estado_cotizacion: "Cambió el estado de una cotización",
  entrar_panel: "Entró al panel con el código de su correo",
  atender_incidente: "Marcó como atendido un incidente del chofer",
  enviar_aviso: "Mandó un aviso a clientes",
  // Las del chofer (app/acciones-chofer.js).
  no_procedio: "Marcó una parada como \"No procedió\"",
  reportar_incidente: "Reportó un incidente desde su ruta",
  // Éstas ya se anotaban pero salían con su clave cruda en la pantalla.
  activar_cuenta_registrada: "Activó la cuenta de un cliente registrado",
  alta_solicitada: "Llegó una solicitud de alta",
  registro_google: "Un cliente se registró con Google",
  // Alta con firma electrónica (lib/alta-servidor.js, db/025). Las dos puertas
  // —formulario y Google— anotan lo mismo; el detalle dice de cuál vino.
  alta_firmada: "Un cliente firmó su solicitud de alta",
  alta_correo_confirmado: "Un cliente confirmó el correo de su alta",
  eliminar_cuenta: "Eliminó su cuenta desde la app",
  eliminar_cuenta_simulada: "Pidió eliminar la cuenta de muestra",
  // Peso real del relleno (app/acciones-peso.js, db/023).
  registrar_viaje_relleno: "Registró un viaje al relleno con su peso real",
  editar_viaje_relleno: "Editó un viaje al relleno",
  borrar_viaje_relleno: "Borró un viaje al relleno",
  subir_ticket_viaje: "Subió la foto del ticket de báscula de un viaje",
  poner_peso_real: "Puso el peso real de una recolección",
  quitar_peso_real: "Quitó el peso real de una recolección",
  // Las anota la propia base (db/022), venga el cambio de la web, de la app
  // o de una llamada directa a la API.
  db_insert: "Alta",
  db_update: "Cambio",
  db_delete: "Borrado",
};

/** Cómo se llama cada tabla en la bitácora, para las filas que anota la base. */
export const TEXTO_TABLA = {
  movimientos_saldo: "movimiento de saldo",
  perfiles: "cuenta de acceso",
  clientes: "cliente",
  rutas: "ruta",
  solicitudes_recoleccion: "solicitud de recolección",
  domicilios: "punto de recolección",
  unidades: "unidad",
  contenedores: "contenedor",
  viajes_relleno: "viaje al relleno",
  suscripciones: "servicio contratado",
};

/** El texto de la columna «Acción» de una fila de la bitácora. */
export function textoDeAccion(fila) {
  const base = TEXTO_ACCION[fila.accion] || fila.accion;
  if (!String(fila.accion).startsWith("db_")) return base;
  return `${base} de ${TEXTO_TABLA[fila.tabla] || fila.tabla || "registro"}`;
}
