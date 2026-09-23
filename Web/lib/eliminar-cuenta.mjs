/**
 * ELIMINAR MI CUENTA — lo que pasa cuando un cliente borra su acceso desde
 * la app.
 *
 * POR QUÉ EXISTE
 * La guía 5.1.1(v) de la App Store exige que el usuario pueda borrar su cuenta
 * DESDE la app, y que se borre de verdad: ni "desactivarla" ni mandar un
 * correo. La app llama a `POST /api/cuenta/eliminar` con su token de sesión
 * y esto hace el trabajo con la llave de servicio.
 *
 * QUÉ SE BORRA Y QUÉ NO
 *  · Se borra el USUARIO de Supabase Auth (correo, contraseña, sesiones) y su
 *    fila en `perfiles` (se va sola por `on delete cascade`, db/001; aquí se
 *    confirma por si acaso).
 *  · NO se toca la EMPRESA (`clientes`) ni lo que cuelga de ella: servicios,
 *    recolecciones y su evidencia, manifiestos, movimientos de saldo y
 *    comprobantes. Son registros que Morcast tiene que conservar por la
 *    normatividad ambiental y la fiscal (lo dice el Aviso de Privacidad), y
 *    además son de la empresa, que puede tener otros accesos. Lo que apuntaba
 *    a este perfil queda en `null` (`on delete set null`).
 *
 * QUIÉN PUEDE
 *  · Sólo rol `cliente`. Las cuentas del personal (dueño, admin, chofer) las
 *    da de baja Morcast desde el panel: si un chofer pudiera borrarse solo,
 *    las paradas asignadas se quedarían sin nadie sin que la oficina se
 *    entere.
 *  · La cuenta del revisor de la App Store (`app_metadata.demo === true`,
 *    ver `App IOS/src/cuenta-muestra.js`) NO se borra: se contesta como si
 *    se hubiera borrado. Cada actualización de la app vuelve a revisión con
 *    la MISMA cuenta; si el revisor la destruyera, la siguiente revisión se
 *    rechaza por no poder entrar.
 *
 * El trabajo va aquí, separado de la ruta, para probarlo con un Supabase de
 * mentira (`tests/eliminar-cuenta.test.mjs`) sin tocar la base real.
 */

export const CORREO_CONTACTO = "contacto@morcast.mx";

export const MENSAJES = {
  sinSesion: "Tu sesión ya no es válida. Vuelve a entrar e inténtalo otra vez.",
  noCliente:
    "Las cuentas del personal de Morcast se dan de baja desde el panel de administración.",
  fallo:
    `No pudimos eliminar tu cuenta en este momento. Inténtalo de nuevo o escríbenos a ${CORREO_CONTACTO}.`,
};

/** Saca el token de `Authorization: Bearer <token>`. `null` si no viene. */
export function tokenDeCabecera(valor) {
  const m = /^Bearer\s+(\S+)\s*$/i.exec(String(valor ?? "").trim());
  return m ? m[1] : null;
}

/**
 * Qué hacer con este usuario: "borrar", "simular" (cuenta de muestra) o
 * "rechazar" (no es cliente). El rol sale de `app_metadata`, que sólo se
 * escribe con la llave de servicio — nunca de `user_metadata`, que el propio
 * usuario puede cambiar.
 */
export function decidir(usuario) {
  const meta = usuario?.app_metadata || {};
  if (meta.rol !== "cliente") return "rechazar";
  if (meta.demo === true) return "simular";
  return "borrar";
}

const respuesta = (status, cuerpo) => ({ status, cuerpo });

/**
 * Hace todo el trabajo. `sb` es un cliente de Supabase con la llave de
 * SERVICIO. Nunca lanza: devuelve `{ status, cuerpo }` listo para la ruta.
 */
export async function eliminarCuenta({ token, sb, log = console }) {
  if (!token) return respuesta(401, { ok: false, mensaje: MENSAJES.sinSesion });

  // `getUser(token)` le pregunta al servidor de Auth: comprueba la firma, que
  // no haya vencido y que el usuario siga existiendo. No basta con decodificar
  // el JWT aquí: un token de un usuario ya borrado seguiría "pareciendo" bueno.
  let usuario = null;
  try {
    const { data, error } = await sb.auth.getUser(token);
    if (!error) usuario = data?.user ?? null;
  } catch (e) {
    log.error("[eliminar-cuenta] getUser falló:", e?.message || e);
  }
  if (!usuario) return respuesta(401, { ok: false, mensaje: MENSAJES.sinSesion });

  const decision = decidir(usuario);

  if (decision === "rechazar") {
    return respuesta(403, { ok: false, mensaje: MENSAJES.noCliente });
  }

  if (decision === "simular") {
    // Se deja rastro igual: si algún día alguien pregunta por qué la cuenta de
    // muestra "se borró" y sigue viva, aquí está la respuesta.
    await anotar(sb, log, {
      actor_id: usuario.id,
      actor_correo: usuario.email ?? null,
      accion: "eliminar_cuenta_simulada",
      tabla: "perfiles",
      registro_id: usuario.id,
      detalle: { motivo: "cuenta de muestra (app_metadata.demo): no se borra" },
    });
    return respuesta(200, { ok: true, simulado: true });
  }

  // De qué empresa era, para la bitácora. Hay que leerlo ANTES: después del
  // borrado la fila ya no existe.
  let clienteId = null;
  try {
    const { data } = await sb.from("perfiles").select("cliente_id").eq("id", usuario.id).maybeSingle();
    clienteId = data?.cliente_id ?? null;
  } catch {
    /* sólo es para la bitácora */
  }

  // El borrado de verdad. `deleteUser` (API de administración de Auth) quita
  // al usuario, sus identidades y sus sesiones; `perfiles` se va en cascada.
  let fallo = null;
  try {
    const { error } = await sb.auth.admin.deleteUser(usuario.id);
    fallo = error;
  } catch (e) {
    fallo = e;
  }
  if (fallo) {
    log.error("[eliminar-cuenta] deleteUser falló:", fallo?.message || fallo);
    return respuesta(500, { ok: false, mensaje: MENSAJES.fallo });
  }

  // La cascada ya debió llevarse el perfil; si por algo sigue ahí, se borra.
  // Un fallo aquí no revierte nada: el acceso YA no existe (el usuario de
  // Auth se fue), que es lo que el cliente pidió.
  try {
    const { error } = await sb.from("perfiles").delete().eq("id", usuario.id);
    if (error) log.error("[eliminar-cuenta] no se pudo confirmar el perfil:", error.message);
  } catch (e) {
    log.error("[eliminar-cuenta] no se pudo confirmar el perfil:", e?.message || e);
  }

  // Después del borrado `actor_id` ya no puede apuntar al perfil (la llave
  // foránea lo rechazaría): va en null y queda el correo como constancia de
  // quién lo pidió.
  await anotar(sb, log, {
    actor_id: null,
    actor_correo: usuario.email ?? null,
    accion: "eliminar_cuenta",
    tabla: "perfiles",
    registro_id: usuario.id,
    detalle: { cliente_id: clienteId, origen: "app" },
  });

  return respuesta(200, { ok: true });
}

/** Escribe en la bitácora. Nunca lanza: la bitácora no puede tumbar el borrado. */
async function anotar(sb, log, fila) {
  try {
    const { error } = await sb.from("bitacora").insert(fila);
    if (error) log.error("[eliminar-cuenta] bitácora:", error.message);
  } catch (e) {
    log.error("[eliminar-cuenta] bitácora:", e?.message || e);
  }
}
