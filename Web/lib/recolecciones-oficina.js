import {
  hayResend,
  correoRecoleccionConfirmada,
  correoRecoleccionRechazada,
  correoParadaAsignada,
} from "./correo";
import { cargarParada, avisarCliente } from "./avisar-cliente";
import { enviarPush, tokensDeUsuarios } from "./push.mjs";
import { choferesPorAvisar, mensajePushParada } from "./oficina-recolecciones.mjs";

/**
 * LA OFICINA CAMBIA EL ESTADO DE UNA RECOLECCIÓN (confirmar, reagendar,
 * cambiar día/hora/chofer, rechazar) — la MISMA para el panel web y la app.
 *
 * Vivía dentro de `cambiarEstadoSolicitudAuditado` (app/acciones-auditadas.js),
 * amarrada a la cookie de la web. Se sacó aquí el 6-oct-2026 para que la app
 * de la oficina (/api/app/recolecciones/*) haga exactamente lo mismo: el
 * mismo UPDATE contado, la misma fila en la bitácora, los mismos correos y
 * las mismas notificaciones. Quien llama ya comprobó que es personal.
 *
 *   `sb`         actúa COMO el usuario (sesión de la web o token de la app):
 *                el RLS sigue siendo el guardia del UPDATE.
 *   `sbServicio` llave de servicio: bitácora (no tiene política de INSERT a
 *                propósito), correos de auth.users y tokens de push.
 *   `actor`      { id, correo } sacado de la sesión, nunca del cuerpo.
 *   `origen`     "app" cuando viene del teléfono (va en el detalle de la
 *                bitácora, como anotarBitacora de lib/app-auth.mjs).
 *   `soloSiEstado` (opcional) solo cambia la fila si sigue en esos estados:
 *                la app decide la acción con la fila que leyó, y si el
 *                chofer la tomó entre tanto no se le mueve.
 */

const CAMPOS = `
  id, folio, estado, cliente_id, fecha_confirmada, hora_confirmada,
  chofer_id, motivo_rechazo,
  clientes ( empresa, correo ),
  domicilios ( alias, calle, colonia ),
  rutas ( chofer_id ),
  choferParada:perfiles!solicitudes_recoleccion_chofer_id_fkey ( nombre )
`;

/**
 * Los avisos NO pueden tumbar la operación (ver la nota de `avisar` en
 * app/acciones-auditadas.js): la base es la verdad y el correo es cortesía,
 * pero el fallo se ANOTA.
 */
export async function avisarSinTumbar(que, fn, { log = console } = {}) {
  if (!hayResend()) {
    log.warn(`[avisos] ${que}: no se mandó, falta RESEND_API_KEY`);
    return;
  }
  try {
    await fn();
  } catch (e) {
    log.error(`[avisos] ${que}: no se pudo mandar —`, e?.message || e);
  }
}

/** Correo de un usuario del equipo. Vive en auth.users, no en `perfiles`. */
export async function correoDeUsuario(sbServicio, uid) {
  if (!uid || !sbServicio) return null;
  try {
    const { data } = await sbServicio.auth.admin.getUserById(uid);
    return data?.user?.email || null;
  } catch {
    return null;
  }
}

/**
 * Notificación al teléfono de cada chofer que le toca saber (al nuevo y, si
 * se la quitaron, al anterior). Antes solo salía el correo "Parada nueva" y
 * la app del chofer no se enteraba hasta que él recargaba a mano.
 * Nunca lanza.
 */
async function avisarChoferesPorPush({ sbServicio, antes, s, log }) {
  try {
    const destinos = choferesPorAvisar(antes, s);
    for (const { uid, evento } of destinos) {
      const tokens = await tokensDeUsuarios(sbServicio, [uid], { log });
      if (!tokens.length) continue;
      await enviarPush(
        tokens,
        mensajePushParada(evento, {
          id: s.id,
          folio: s.folio,
          cliente: s.clientes?.empresa,
          fecha: s.fecha_confirmada,
          hora: s.hora_confirmada,
        }),
        { sb: sbServicio, log }
      );
    }
  } catch (e) {
    log.error("[avisos] notificación al chofer:", e?.message || e);
  }
}

/**
 * @returns {Promise<{ ok: true, estado: string } | { ok: false, motivo: string }>}
 */
export async function cambiarEstadoSolicitudComo({
  sb,
  sbServicio,
  actor,
  id,
  cambios,
  accion,
  origen = null,
  soloSiEstado = null,
  log = console,
}) {
  // Cómo estaba ANTES, para saber si cambió de chofer y avisarle al que la
  // tenía. Si no se puede leer, se avisa solo al nuevo.
  let antes = null;
  try {
    const { data } = await sb
      .from("solicitudes_recoleccion")
      .select("estado, chofer_id, rutas ( chofer_id )")
      .eq("id", id)
      .maybeSingle();
    antes = data ?? null;
  } catch {
    antes = null;
  }

  let consulta = sb.from("solicitudes_recoleccion").update(cambios).eq("id", id);
  if (Array.isArray(soloSiEstado) && soloSiEstado.length) consulta = consulta.in("estado", soloSiEstado);
  const { data, error } = await consulta.select(CAMPOS);

  if (error) return { ok: false, motivo: error.message };
  if (!data?.length) {
    return {
      ok: false,
      motivo: soloSiEstado
        ? "No se cambió nada: la recolección cambió mientras tanto (o el permiso de la base no te deja tocarla). Vuelve a cargar la lista."
        : "No se cambió nada: el permiso de la base no te deja tocar esa solicitud.",
    };
  }

  const s = data[0];

  // La bitácora, con la llave de servicio y el actor de la sesión: lo mismo
  // que hacía `registrar()` (lib/bitacora.js), que lo sacaba de la cookie.
  try {
    const { error: errBit } = await sbServicio.from("bitacora").insert({
      actor_id: actor?.id ?? null,
      actor_correo: actor?.correo ?? null,
      accion: accion || "cambiar_estado_solicitud",
      tabla: "solicitudes_recoleccion",
      registro_id: String(id),
      detalle: {
        folio: s.folio,
        estado: s.estado,
        cliente_id: s.cliente_id,
        cambios,
        ...(origen ? { origen } : {}),
      },
    });
    if (errBit) log.error("[bitacora] no se pudo registrar:", accion, errBit.message);
  } catch (e) {
    log.error("[bitacora] no se pudo registrar:", accion, e?.message || e);
  }

  const domicilio = s.domicilios
    ? [s.domicilios.alias, s.domicilios.calle, s.domicilios.colonia].filter(Boolean).join(" · ")
    : "";

  if (s.estado === "confirmada") {
    // Un CAMBIO de día, hora o chofer de algo ya acordado (o reagendar una
    // vencida) se le dice como tal: "cambió tu recolección", no otra
    // confirmación igual a la primera que lo confunda (6-oct-2026).
    const esCambio = ["cambiar_recoleccion_confirmada", "reagendar_recoleccion_vencida"].includes(accion);
    try {
      const parada = await cargarParada(sbServicio, id, { log });
      if (esCambio) {
        await avisarCliente({ sb: sbServicio, parada, evento: "reagendada", log });
      } else {
        await avisarSinTumbar(
          "recolección confirmada",
          () =>
            correoRecoleccionConfirmada({
              correo: s.clientes?.correo,
              empresa: s.clientes?.empresa,
              folio: s.folio,
              fecha: s.fecha_confirmada,
              hora: s.hora_confirmada,
              domicilio,
            }),
          { log }
        );
        // Y al teléfono, si tiene la app. El correo ya salió arriba.
        await avisarCliente({ sb: sbServicio, parada, evento: "confirmada", soloPush: true, log });
      }
    } catch (e) {
      log.error("[avisos] aviso al cliente de la confirmación:", e?.message || e);
    }

    // Y al chofer que le toca: el asignado a la parada si lo hay, si no el
    // de la ruta. Su correo vive en auth.users, no en `perfiles`.
    const choferId = s.chofer_id || s.rutas?.chofer_id;
    await avisarSinTumbar(
      "parada asignada",
      async () => {
        const correo = await correoDeUsuario(sbServicio, choferId);
        if (!correo) return;
        await correoParadaAsignada({
          correo,
          nombre: s.choferParada?.nombre,
          folio: s.folio,
          cliente: s.clientes?.empresa || "un cliente",
          domicilio,
          fecha: s.fecha_confirmada,
          hora: s.hora_confirmada,
        });
      },
      { log }
    );

    // Y a su teléfono (6-oct-2026): con esto la app del chofer relee la ruta.
    await avisarChoferesPorPush({ sbServicio, antes, s, log });
  }

  if (s.estado === "rechazada") {
    await avisarSinTumbar(
      "recolección rechazada",
      () =>
        correoRecoleccionRechazada({
          correo: s.clientes?.correo,
          empresa: s.clientes?.empresa,
          folio: s.folio,
          fecha: s.fecha_confirmada || cambios?.fecha_confirmada,
          motivo: s.motivo_rechazo,
        }),
      { log }
    );
    // Si ya estaba en la ruta de un chofer, que sepa que ya no va.
    await avisarChoferesPorPush({ sbServicio, antes, s, log });
  }

  return { ok: true, estado: s.estado };
}
