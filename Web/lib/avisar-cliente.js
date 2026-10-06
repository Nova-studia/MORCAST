import { hayResend, correoAvisoRecoleccion } from "./correo";
import { enviarPush, tokensDeUsuarios, usuariosClienteDe } from "./push.mjs";
import {
  EVENTOS_UNA_VEZ,
  INCIDENTES_QUE_RETRASAN,
  esChoferDeParada,
  mensajeAvisoCliente,
  puedeAvisar,
} from "./aviso-cliente.mjs";

/**
 * Avisa al CLIENTE de un cambio en su recolección: correo + notificación al
 * teléfono (si tiene la app). Lo usan:
 *   · el chofer en la web (app/acciones-chofer.js) y en la app
 *     (/api/app/parada-aviso): en camino, realizada, no procedió;
 *   · la oficina (app/acciones-auditadas.js): confirmada, reagendada;
 *   · los incidentes del chofer amarrados a una parada (lib/avisar-incidente.js).
 *
 * `sb` es un cliente con la llave de SERVICIO (lee el correo del cliente y
 * los tokens, que el RLS no le deja ver al chofer). Quien llama YA comprobó
 * que tiene derecho a tocar esa recolección.
 *
 * Los de EVENTOS_UNA_VEZ salen una sola vez por recolección: el registro en
 * la bitácora (`aviso_cliente` con el evento) es a la vez la constancia y el
 * candado. Nunca lanza: el cambio ya está guardado y eso es lo importante.
 */

const CAMPOS_PARADA = `
  id, folio, estado, cliente_id, chofer_id, fecha_confirmada, fecha_pedida, hora_confirmada,
  motivo_no_procedio, detalle_no_procedio,
  clientes ( empresa, correo ),
  rutas ( chofer_id ),
  choferParada:perfiles!solicitudes_recoleccion_chofer_id_fkey ( nombre )
`;

/** La recolección con lo que lleva el aviso, o null. */
export async function cargarParada(sb, id, { log = console } = {}) {
  try {
    const { data, error } = await sb.from("solicitudes_recoleccion").select(CAMPOS_PARADA).eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? null;
  } catch (e) {
    log.error("[aviso-cliente] no se pudo leer la recolección:", e?.message || e);
    return null;
  }
}

async function yaSeAviso(sb, id, evento, log) {
  try {
    const { data, error } = await sb
      .from("bitacora")
      .select("id")
      .eq("accion", "aviso_cliente")
      .eq("registro_id", String(id))
      .eq("detalle->>evento", evento)
      .limit(1);
    if (error) throw new Error(error.message);
    return Boolean(data?.length);
  } catch (e) {
    // Sin poder saberlo se avisa: mejor un aviso repetido que ninguno.
    log.error("[aviso-cliente] no se pudo revisar si ya se avisó:", e?.message || e);
    return false;
  }
}

/**
 * @param {{ sb, parada, evento, extra?, actor?: { id, correo }, soloPush?: boolean, log? }} p
 *   `parada` como la devuelve `cargarParada`; `extra` para el texto (retrasoMin).
 * @returns {Promise<{ ok: boolean, yaAvisado?: true, correo: boolean, notificaciones: number }>}
 */
export async function avisarCliente({ sb, parada, evento, extra = {}, actor = null, soloPush = false, log = console }) {
  const nada = { ok: false, correo: false, notificaciones: 0 };
  if (!sb || !parada || !puedeAvisar(evento, parada.estado)) return nada;
  if (EVENTOS_UNA_VEZ.includes(evento) && (await yaSeAviso(sb, parada.id, evento, log))) {
    return { ok: true, yaAvisado: true, correo: false, notificaciones: 0 };
  }

  const m = mensajeAvisoCliente(evento, {
    folio: parada.folio,
    fecha: parada.fecha_confirmada || parada.fecha_pedida,
    hora: parada.hora_confirmada,
    chofer: parada.choferParada?.nombre || "",
    motivo: parada.motivo_no_procedio,
    detalle: parada.detalle_no_procedio,
    ...extra,
  });
  if (!m) return nada;

  const [correo, push] = await Promise.all([
    (async () => {
      // `soloPush`: quien llama ya mandó su propio correo (la confirmación).
      if (soloPush) return false;
      if (!hayResend()) {
        log.warn(`[avisos] cliente ${evento}: no se mandó el correo, falta RESEND_API_KEY`);
        return false;
      }
      try {
        await correoAvisoRecoleccion({
          correo: parada.clientes?.correo,
          empresa: parada.clientes?.empresa,
          folio: parada.folio,
          ...m,
        });
        return Boolean(parada.clientes?.correo);
      } catch (e) {
        log.error(`[avisos] cliente ${evento}: no se pudo mandar el correo —`, e?.message || e);
        return false;
      }
    })(),
    (async () => {
      try {
        const usuarios = await usuariosClienteDe(sb, [parada.cliente_id], { log });
        const tokens = await tokensDeUsuarios(sb, usuarios || [], { log });
        if (!tokens.length) return 0;
        const r = await enviarPush(
          tokens,
          { ...m.push, datos: { tipo: "recoleccion", id: parada.id, folio: parada.folio, evento } },
          { sb, log }
        );
        return r?.enviadas || 0;
      } catch (e) {
        log.error(`[avisos] cliente ${evento}: no se pudo mandar la notificación —`, e?.message || e);
        return 0;
      }
    })(),
  ]);

  // Constancia y candado. Con la llave de servicio, como lib/bitacora.js.
  try {
    await sb.from("bitacora").insert({
      actor_id: actor?.id ?? null,
      actor_correo: actor?.correo ?? null,
      accion: "aviso_cliente",
      tabla: "solicitudes_recoleccion",
      registro_id: String(parada.id),
      detalle: { evento, folio: parada.folio, correo, notificaciones: push },
    });
  } catch (e) {
    log.error("[aviso-cliente] no se pudo anotar en la bitácora:", e?.message || e);
  }

  return { ok: true, correo, notificaciones: push };
}

/**
 * Lo que hace el CHOFER sobre su parada y le avisa al cliente: "en-camino"
 * (además la pasa a "En ruta"), "completada" y "no-procedio" (esos dos ya los
 * guardó él; aquí solo se comprueba que la base diga lo mismo y se avisa).
 *
 * La misma para la web (sesión) y la app (token): quien llama da el `uid`
 * ya autenticado y `sb` con la llave de servicio.
 *
 * @returns {Promise<{ ok: boolean, status?: number, motivo?: string, estado?: string, aviso?: object }>}
 */
export async function eventoDeParada({ sb, uid, correo = null, solicitudId, evento, log = console }) {
  if (!["en-camino", "completada", "no-procedio"].includes(evento)) {
    return { ok: false, status: 400, motivo: "Ese aviso no existe." };
  }
  let parada = await cargarParada(sb, solicitudId, { log });
  if (!parada || !esChoferDeParada(parada, uid)) {
    return { ok: false, status: 404, motivo: "Esa parada no existe o no es de tu ruta." };
  }

  if (evento === "en-camino") {
    if (parada.estado === "confirmada") {
      // Solo si sigue confirmada: si entre tanto la completó o la marcó "No
      // procedió", no se le regresa a "En ruta".
      const { data, error } = await sb
        .from("solicitudes_recoleccion")
        .update({ estado: "en-ruta" })
        .eq("id", parada.id)
        .eq("estado", "confirmada")
        .select("id");
      if (error) return { ok: false, status: 500, motivo: error.message };
      if (data?.length) parada = { ...parada, estado: "en-ruta" };
    }
    if (parada.estado !== "en-ruta") {
      return { ok: false, status: 409, motivo: "Esa parada ya no está pendiente.", estado: parada.estado };
    }
  } else if (!puedeAvisar(evento, parada.estado)) {
    return { ok: false, status: 409, motivo: "La parada todavía no está en ese estado.", estado: parada.estado };
  }

  const aviso = await avisarCliente({ sb, parada, evento, actor: { id: uid, correo }, log });
  return { ok: true, estado: parada.estado, aviso };
}

/**
 * Un incidente del chofer amarrado a una parada que la retrasa (retraso,
 * accidente, falla mecánica): se le avisa a ESE cliente. Los de contenedor
 * son internos. Si el incidente afecta a toda la ruta, la oficina avisa a
 * todos desde "Avisos a clientes".
 */
export async function avisarClienteDeIncidente({ sb, incidente, log = console }) {
  if (!incidente?.solicitud_id || !INCIDENTES_QUE_RETRASAN.includes(incidente.tipo)) return null;
  const parada = await cargarParada(sb, incidente.solicitud_id, { log });
  if (!parada || !["confirmada", "en-ruta"].includes(parada.estado)) return null;
  return avisarCliente({
    sb,
    parada,
    evento: "retraso",
    extra: { retrasoMin: incidente.retraso_min },
    actor: { id: incidente.operador_id ?? null },
    log,
  });
}
