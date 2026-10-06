import { hayResend, correoIncidente } from "./correo";
import { enviarPush, tokensDeUsuarios, usuariosOficina } from "./push.mjs";
import { datosCorreoIncidente, mensajePushIncidente } from "./incidente-aviso.mjs";
import { avisarClienteDeIncidente } from "./avisar-cliente";

/**
 * Avisa a la oficina de un incidente: correo al buzón y notificación al
 * teléfono del dueño y de los administradores. Lo usan la web del chofer
 * (app/acciones-chofer.js) y la app (/api/app/incidente-avisado).
 *
 * `sb` es un cliente con la llave de SERVICIO: lee el incidente con sus
 * relaciones y los tokens de la oficina, que el RLS no le deja ver al chofer.
 * Quien llama YA comprobó que el incidente es de ese chofer.
 *
 * UN aviso por incidente: antes de mandar nada se marca `avisado_en` en una
 * sola sentencia que solo cambia la fila si seguía en null. Si la app
 * reintenta (se cayó la señal justo después), el segundo intento no cambia
 * nada y no manda otra vez. Si después el correo falla, el incidente se queda
 * marcado igual: ya está en la bandeja del panel, y el fallo queda en el log.
 *
 * Nunca lanza: el reporte ya está guardado y eso es lo importante.
 */

/** Lo que necesita el correo, en una sola consulta. */
const CAMPOS = `
  id, tipo, descripcion, retraso_min, ubicacion, operador_id, solicitud_id, creado, avisado_en,
  rutas ( nombre, unidad ),
  unidades ( numero_economico ),
  solicitudes_recoleccion ( folio, clientes ( empresa ), domicilios ( alias ) ),
  contenedores ( codigo )
`;

/** El incidente con todo lo que lleva el aviso, o null. */
export async function cargarIncidente(sb, id, { log = console } = {}) {
  try {
    let { data, error } = await sb.from("incidentes").select(CAMPOS).eq("id", id).maybeSingle();
    if (error && /avisado_en/.test(error.message || "")) {
      // La web se puede desplegar antes de correr la migración 026: sin la
      // columna, se lee sin ella y el aviso sale igual (sin el candado de
      // "uno solo", que es lo de menos).
      ({ data, error } = await sb.from("incidentes").select(CAMPOS.replace(", avisado_en", "")).eq("id", id).maybeSingle());
    }
    if (error) throw new Error(error.message);
    return data ?? null;
  } catch (e) {
    log.error("[incidentes] no se pudo leer el incidente:", e?.message || e);
    return null;
  }
}

/**
 * @param {{ sb: object, incidente: object, chofer: string, log?: object }} p
 *   `incidente` como lo devuelve `cargarIncidente`; `chofer`, su nombre.
 * @returns {Promise<{ yaAvisado?: true, correo: boolean, notificaciones: number }>}
 */
export async function avisarOficina({ sb, incidente, chofer, log = console }) {
  // Apartar el aviso. Si la columna no existe (026 sin correr) se avisa igual:
  // mejor un aviso repetido que ninguno.
  try {
    const { data, error } = await sb
      .from("incidentes")
      .update({ avisado_en: new Date().toISOString() })
      .eq("id", incidente.id)
      .is("avisado_en", null)
      .select("id");
    if (error) log.error("[incidentes] no se pudo marcar como avisado:", error.message);
    else if (!data?.length) return { yaAvisado: true, correo: false, notificaciones: 0 };
  } catch (e) {
    log.error("[incidentes] no se pudo marcar como avisado:", e?.message || e);
  }

  // El correo y la notificación van a la par: ninguno espera al otro y el
  // fallo de uno no tumba al otro.
  const [correo, push] = await Promise.all([
    (async () => {
      if (!hayResend()) {
        log.warn(`[avisos] incidente ${incidente.tipo}: no se mandó el correo, falta RESEND_API_KEY`);
        return false;
      }
      try {
        await correoIncidente(datosCorreoIncidente(incidente, { chofer }));
        return true;
      } catch (e) {
        log.error(`[avisos] incidente ${incidente.tipo}: no se pudo mandar el correo —`, e?.message || e);
        return false;
      }
    })(),
    (async () => {
      const tokens = await tokensDeUsuarios(sb, await usuariosOficina(sb, { log }), { log });
      return enviarPush(tokens, mensajePushIncidente(incidente, { chofer }), { sb, log });
    })(),
  ]);

  // Si el incidente retrasa la recolección de un cliente (va amarrado a su
  // parada), también se le avisa a él (6-oct-2026). Ya pasó el candado de
  // `avisado_en`: sale una sola vez. Nunca lanza.
  try {
    await avisarClienteDeIncidente({ sb, incidente, log });
  } catch (e) {
    log.error("[incidentes] no se pudo avisar al cliente:", e?.message || e);
  }

  return { correo, notificaciones: push.enviadas };
}
