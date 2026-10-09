import { hayResend, correoSolicitudRecoleccion } from "./correo";
import { enviarPush, tokensDeUsuarios, usuariosOficina } from "./push.mjs";
import {
  ACCION_AVISO_SOLICITUD,
  datosCorreoSolicitud,
  decidirAvisoSolicitud,
  filtroFolioAviso,
  mensajePushSolicitud,
} from "./solicitud-aviso.mjs";

/**
 * Avisa a la OFICINA de una recolección que acaba de pedir un cliente:
 * correo al buzón de avisos y notificación al teléfono del dueño y de los
 * administradores (6-oct-2026). Lo usan el portal (app/acciones-solicitud.js)
 * y las apps (/api/app/solicitud-avisada).
 *
 * `sb` con la llave de SERVICIO (lee la solicitud con su empresa y los
 * tokens de la oficina, que el RLS no le deja ver al cliente). La decisión
 * de si se avisa la toma lib/solicitud-aviso.mjs con el `clienteId` que sale
 * del PERFIL de quien llamó, nunca del cuerpo de la petición.
 *
 * Una sola vez por solicitud: la fila de la bitácora es constancia y
 * candado (mismo criterio que lib/avisar-cliente.js). Nunca lanza.
 *
 * @returns {Promise<{ ok: boolean, status?: number, motivo?: string,
 *   yaAvisado?: true, nada?: true, correo?: boolean, notificaciones?: number }>}
 */

const CAMPOS = `
  id, folio, estado, cliente_id, creado, fecha_pedida, origen, tipo_residuo, nota,
  clientes ( empresa ),
  domicilios ( alias, calle, colonia ),
  rutas ( nombre )
`;

async function yaSeAviso(sb, id, log) {
  try {
    const { data, error } = await sb
      .from("bitacora")
      .select("id")
      .eq("accion", ACCION_AVISO_SOLICITUD)
      .eq("registro_id", String(id))
      .limit(1);
    if (error) throw new Error(error.message);
    return Boolean(data?.length);
  } catch (e) {
    // Sin poder saberlo se avisa: mejor un aviso repetido que ninguno.
    log.error("[solicitud] no se pudo revisar si ya se avisó:", e?.message || e);
    return false;
  }
}

export async function avisarOficinaDeSolicitud({ sb, actor, clienteId, folio, log = console }) {
  let sol = null;
  try {
    // Por su folio o por el que PIDIÓ la app (db/031 le pone otro si estaba
    // ocupado): sin esto, el aviso de una app 1.1.1 buscaba el folio de otra
    // empresa y la oficina nunca se enteraba. De ESTE cliente, la más nueva.
    const filtro = filtroFolioAviso(folio);
    if (!filtro) return { ok: false, status: 400, motivo: "Falta la solicitud." };
    let q = sb.from("solicitudes_recoleccion").select(CAMPOS).or(filtro);
    if (clienteId) q = q.eq("cliente_id", clienteId);
    const { data, error } = await q.order("creado", { ascending: false }).limit(1);
    if (error) throw new Error(error.message);
    sol = data?.[0] ?? null;
  } catch (e) {
    log.error("[solicitud] no se pudo leer la solicitud:", e?.message || e);
    return { ok: false, status: 500, motivo: "No se pudo leer la solicitud." };
  }

  const decision = decidirAvisoSolicitud(sol, { clienteId });
  if (!decision.ok) return decision;
  if (decision.nada) return { ok: true, nada: true };
  if (await yaSeAviso(sb, sol.id, log)) return { ok: true, yaAvisado: true };

  // El correo y la notificación van a la par: ninguno espera al otro y el
  // fallo de uno no tumba al otro.
  const [correo, notificaciones] = await Promise.all([
    (async () => {
      if (!hayResend()) {
        log.warn("[avisos] solicitud nueva: no se mandó el correo, falta RESEND_API_KEY");
        return false;
      }
      try {
        await correoSolicitudRecoleccion(datosCorreoSolicitud(sol));
        return true;
      } catch (e) {
        log.error("[avisos] solicitud nueva: no se pudo mandar el correo —", e?.message || e);
        return false;
      }
    })(),
    (async () => {
      try {
        const tokens = await tokensDeUsuarios(sb, await usuariosOficina(sb, { log }), { log });
        if (!tokens.length) return 0;
        const r = await enviarPush(tokens, mensajePushSolicitud(sol), { sb, log });
        return r?.enviadas || 0;
      } catch (e) {
        log.error("[avisos] solicitud nueva: no se pudo mandar la notificación —", e?.message || e);
        return 0;
      }
    })(),
  ]);

  // Constancia y candado.
  try {
    const { error } = await sb.from("bitacora").insert({
      actor_id: actor?.id ?? null,
      actor_correo: actor?.correo ?? null,
      accion: ACCION_AVISO_SOLICITUD,
      tabla: "solicitudes_recoleccion",
      registro_id: String(sol.id),
      detalle: { folio: sol.folio, correo, notificaciones, ...(actor?.origen ? { origen: actor.origen } : {}) },
    });
    if (error) log.error("[solicitud] no se pudo anotar en la bitácora:", error.message);
  } catch (e) {
    log.error("[solicitud] no se pudo anotar en la bitácora:", e?.message || e);
  }

  return { ok: true, correo, notificaciones };
}
