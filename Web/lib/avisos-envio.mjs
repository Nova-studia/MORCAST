/**
 * MANDAR UN AVISO A CLIENTES — la lógica del servidor, una sola copia para
 * el panel web (app/acciones-avisos.js) y la app (/api/app/avisos/mandar).
 *
 * Antes vivía entera dentro de la acción de la web. Al llegar la app (1.1,
 * 6-oct-2026) se sacó aquí para que las dos puertas hagan EXACTAMENTE lo
 * mismo: mismos destinatarios, misma pausa entre correos, mismas
 * notificaciones, mismo renglón en la bitácora. Lo único que cambia entre
 * una y otra es de dónde sale el usuario (cookie o token) y cómo se firma la
 * bitácora, y eso llega como parámetro.
 *
 * Sin imports de Next ni de Supabase: lo que toca la red (correo, push) se
 * recibe en `deps`, así se prueba con `node --test` (tests/avisos-envio.test.mjs).
 * Las reglas de a quién le toca siguen en lib/avisos.mjs.
 */

import {
  validarAviso,
  validarAlcance,
  filaAviso,
  calcularDestinatarios,
  resumenDestinatarios,
  hoyMatamoros,
} from "./avisos.mjs";

/**
 * Pausa entre un correo y el siguiente.
 *
 * Resend acepta 2 envíos por segundo por omisión; si se le mandan 40 de
 * golpe, contesta 429 a casi todos y el aviso "se mandó" a cinco empresas.
 * A ~1.8 por segundo, 43 clientes (la operación real de hoy) tardan unos 24
 * segundos, por eso la página y la ruta de la app suben su tiempo máximo.
 */
export const PAUSA_ENTRE_CORREOS_MS = 550;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const esperaReal = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Las filas que necesita `calcularDestinatarios`, solo las del alcance.
 * `sb` con la llave de SERVICIO: hay que leer los correos de todas las
 * empresas, y eso el RLS no se lo deja a nadie (por eso antes se exige el rol).
 *
 * Los clientes se piden todos (son decenas, no miles) para que el filtro de
 * estado viva en un solo lugar: lib/avisos.mjs. Domicilios y suscripciones
 * sí van filtrados por el sector o la ruta en la propia consulta.
 */
export async function filasDelAlcance(sb, limpio) {
  let clientes = sb.from("clientes").select("id, empresa, correo, estado");
  if (limpio.alcance === "cliente") clientes = clientes.eq("id", limpio.clienteId);
  if (limpio.alcance === "clientes") clientes = clientes.in("id", limpio.clienteIds);

  const [c, d, s] = await Promise.all([
    clientes,
    limpio.alcance === "sector"
      ? sb.from("domicilios").select("cliente_id, sector_id").eq("sector_id", limpio.sectorId)
      : { data: [] },
    limpio.alcance === "ruta"
      ? sb.from("suscripciones").select("cliente_id, ruta_id, estado").eq("ruta_id", limpio.rutaId)
      : { data: [] },
  ]);

  const error = c.error || d.error || s.error;
  if (error) throw new Error(error.message);
  return { clientes: c.data || [], domicilios: d.data || [], suscripciones: s.data || [] };
}

/**
 * Vista previa: a cuántos clientes y correos les llegaría, ANTES de mandar.
 * No escribe nada. Quien llama ya comprobó que es personal.
 */
export async function contarDestinatariosCon(sbServicio, datos, { log = console } = {}) {
  const v = validarAlcance(datos, { exigirUuid: true });
  if (!v.ok) return { ok: false, motivo: v.motivo };
  try {
    const d = calcularDestinatarios(v.limpio, await filasDelAlcance(sbServicio, v.limpio));
    return { ok: true, resumen: resumenDestinatarios(d) };
  } catch (e) {
    log.error("[avisos] no se pudo contar destinatarios:", e?.message);
    return { ok: false, motivo: "No se pudo calcular a quién le llega. Vuelve a intentarlo." };
  }
}

/** Un correo, con un reintento si Resend dice que vamos muy rápido. */
async function mandarUno(destino, limpio, { mandarCorreo, espera, log }) {
  const datos = {
    correo: destino.correo,
    empresa: destino.empresa,
    titulo: limpio.titulo,
    mensaje: limpio.mensaje,
    motivo: limpio.motivo,
    vigenteHasta: limpio.vigenteHasta,
  };
  try {
    await mandarCorreo(datos);
    return true;
  } catch (e) {
    if (/Resend 429/.test(e?.message || "")) {
      await espera(1200);
      try {
        await mandarCorreo(datos);
        return true;
      } catch (e2) {
        log.error(`[avisos] no salió el correo a ${destino.correo}:`, e2?.message);
        return false;
      }
    }
    log.error(`[avisos] no salió el correo a ${destino.correo}:`, e?.message);
    return false;
  }
}

/** Lo que cabe en la notificación: el título del aviso y el principio del mensaje. */
async function notificarAviso(avisoId, limpio, dest, sbServicio, push) {
  const usuarios = await push.usuariosClienteDe(sbServicio, dest.clientes.map((c) => c.id));
  if (usuarios === null) return { enviadas: 0, usuarios: null };
  const tokens = await push.tokensDeUsuarios(sbServicio, usuarios);
  const r = await push.enviarPush(
    tokens,
    { titulo: limpio.titulo, cuerpo: limpio.mensaje, datos: { tipo: "aviso", id: avisoId } },
    { sb: sbServicio }
  );
  return { enviadas: r.enviadas, usuarios: usuarios.length };
}

/**
 * El aviso que ya existe con ese id de envío: lo que se contesta a un
 * REINTENTO en vez de mandarlo otra vez.
 */
async function avisoYaMandado(sbUsuario, id) {
  const { data } = await sbUsuario
    .from("avisos")
    .select("id, creado, correos_enviados")
    .eq("id", id)
    .maybeSingle();
  return data || null;
}

const respuestaYaMandado = (fila) => ({
  ok: true,
  yaEnviado: true,
  id: fila.id,
  creado: fila.creado,
  enviados: fila.correos_enviados ?? 0,
  fallidos: [],
  notificaciones: 0,
});

/**
 * Manda un aviso: lo guarda (el portal lo enseña desde ese momento), le
 * escribe a cada empresa del alcance que tenga correo y avisa al teléfono de
 * quien tenga la app.
 *
 * Tolerante a fallos a propósito: si el correo de una empresa rebota, las
 * demás siguen y se cuenta. El aviso ya quedó en el portal de todas, así que
 * un correo que falla no deja a nadie sin enterarse; deja a la
 * administración sabiendo a quién hay que llamar.
 *
 * `idEnvio` (opcional, UUID que genera la app al confirmar): se usa como id
 * del aviso. Un reintento con el mismo id —la señal se cayó a media espera
 * de 24 segundos y la app no supo si salió— NO vuelve a mandar nada: se
 * contesta `yaEnviado`. La llave primaria de `avisos` es el candado, así que
 * ni dos peticiones a la vez pueden mandarlo dos veces. La web no lo manda
 * (allá no hay reintento a ciegas) y la base pone el id como siempre.
 *
 * @param {{
 *   sbUsuario: object,   // con la sesión: el INSERT pasa por el RLS y `enviado_por` = auth.uid()
 *   sbServicio: object,  // llave de servicio: correos de todas las empresas y tokens de push
 *   datos: object,       // lo del formulario (lib/avisos.mjs: validarAviso)
 *   idEnvio?: string,
 *   anotar: (entrada: {accion, tabla, registroId, detalle}) => Promise<void>,
 *   deps: {
 *     hayResend: () => boolean,
 *     mandarCorreo: (datos) => Promise<any>,
 *     push: { usuariosClienteDe, tokensDeUsuarios, enviarPush },
 *     espera?: (ms) => Promise<void>,
 *     log?: object,
 *     hoy?: string,
 *   }
 * }} p
 */
export async function mandarAvisoCon({ sbUsuario, sbServicio, datos, idEnvio = null, anotar, deps }) {
  const { hayResend, mandarCorreo, push, espera = esperaReal, log = console, hoy = hoyMatamoros() } = deps;

  if (idEnvio != null && !UUID_RE.test(String(idEnvio))) {
    return { ok: false, motivo: "El envío llegó incompleto. Vuelve a intentarlo." };
  }

  const v = validarAviso(datos, { hoy, exigirUuid: true });
  if (!v.ok) return { ok: false, motivo: v.motivo };
  const limpio = v.limpio;

  // Reintento de algo que ya se guardó: no se calcula ni se manda nada.
  if (idEnvio) {
    const previo = await avisoYaMandado(sbUsuario, idEnvio);
    if (previo) return respuestaYaMandado(previo);
  }

  // Primero a quién, después guardar: si no se puede saber a quién le toca,
  // es mejor no dejar un aviso a medias que nadie sabe a cuántos llegó.
  let dest;
  try {
    dest = calcularDestinatarios(limpio, await filasDelAlcance(sbServicio, limpio));
  } catch (e) {
    log.error("[avisos] no se pudo calcular destinatarios:", e?.message);
    return { ok: false, motivo: "No se pudo calcular a quién le llega. No se mandó nada." };
  }

  const fila = idEnvio ? { id: idEnvio, ...filaAviso(limpio) } : filaAviso(limpio);
  const { data: aviso, error } = await sbUsuario.from("avisos").insert(fila).select("id, creado").single();
  if (error || !aviso) {
    // Otra petición con el mismo id ganó la carrera (23505 = llave repetida):
    // ese aviso ya se está mandando, éste no.
    if (idEnvio && error?.code === "23505") {
      const previo = await avisoYaMandado(sbUsuario, idEnvio);
      if (previo) return respuestaYaMandado(previo);
    }
    log.error("[avisos] no se pudo guardar:", error?.message);
    return { ok: false, motivo: "No se pudo guardar el aviso. No se mandó ningún correo." };
  }

  let enviados = 0;
  const fallidos = [];
  const sinResend = !hayResend();
  if (sinResend) {
    // Mismo criterio que acciones-auditadas.js: sin la llave el sitio sigue,
    // pero se anota en el log y se le DICE a quien mandó el aviso.
    log.warn("[avisos] no se mandaron correos: falta RESEND_API_KEY");
  } else {
    for (let i = 0; i < dest.correos.length; i++) {
      if (i > 0) await espera(PAUSA_ENTRE_CORREOS_MS);
      if (await mandarUno(dest.correos[i], limpio, { mandarCorreo, espera, log })) enviados++;
      else fallidos.push(dest.correos[i].empresa || dest.correos[i].correo);
    }
  }

  // Notificación al teléfono: a las cuentas de cliente activas de las
  // empresas del aviso que tengan la app con permiso de notificaciones. Va
  // DESPUÉS de los correos y nunca tumba nada (lib/push.mjs no lanza).
  const pushR = await notificarAviso(aviso.id, limpio, dest, sbServicio, push);

  // Se cuenta lo devuelto: un UPDATE que el RLS bloquea no da error, cambia
  // cero filas y responde 200. Aquí no tumba nada (los correos ya salieron),
  // pero el historial diría "0 correos" y hay que saber por qué.
  const { data: act, error: errAct } = await sbUsuario
    .from("avisos")
    .update({ correos_enviados: enviados })
    .eq("id", aviso.id)
    .select("id");
  if (errAct || !act?.length) {
    log.error("[avisos] no se guardó el conteo de correos:", errAct?.message || "0 filas");
  }

  // Cuántas notificaciones salieron y a cuántos usuarios les tocaba (la "Y"
  // de "Leído por X de Y"), en su propio UPDATE: si la migración 026 no se ha
  // corrido, estas columnas no existen y no deben tumbar el conteo de correos.
  const { error: errPush } = await sbUsuario
    .from("avisos")
    .update({ notificaciones_enviadas: pushR.enviadas, usuarios_destino: pushR.usuarios })
    .eq("id", aviso.id);
  if (errPush) log.error("[avisos] no se guardó el conteo de notificaciones:", errPush.message);

  const resumen = resumenDestinatarios(dest);
  await anotar({
    accion: "enviar_aviso",
    tabla: "avisos",
    registroId: aviso.id,
    detalle: {
      titulo: limpio.titulo,
      motivo: limpio.motivo,
      alcance: limpio.alcance,
      sector_id: limpio.sectorId,
      ruta_id: limpio.rutaId,
      cliente_id: limpio.clienteId,
      cliente_ids: limpio.clienteIds,
      clientes: resumen.clientes,
      correos_enviados: enviados,
      correos_fallidos: fallidos.length,
      notificaciones: pushR.enviadas,
      usuarios_app: pushR.usuarios,
      sin_correo: resumen.sinCorreo,
      sin_resend: sinResend || undefined,
    },
  });

  return {
    ok: true,
    id: aviso.id,
    creado: aviso.creado,
    resumen,
    enviados,
    fallidos,
    sinResend,
    notificaciones: pushR.enviadas,
  };
}
