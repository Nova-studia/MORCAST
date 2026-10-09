"use server";

import { exigirSeccion } from "@/lib/permisos-servidor";
import { validarRecoleccionOficina } from "@/lib/recoleccion-nueva.mjs";
import { hoyMatamoros } from "@/lib/avisos.mjs";
import { TIPOS_RESIDUO } from "@/lib/cotizar-whatsapp";
import { supabaseSesion } from "@/lib/supabase-sesion";
import { registrar } from "@/lib/bitacora";
import { haySupabase, supabaseServidor } from "@/lib/supabase";
import { hayResend } from "@/lib/correo";
import { resolverDepositoServidor } from "@/lib/saldos-servidor";
import { cambiarEstadoSolicitudComo } from "@/lib/recolecciones-oficina";
import { asignarRutaAPuntoCon, revisarAsignacion } from "@/lib/puntos-servidor";

/**
 * Los movimientos donde se mueve dinero o cambia el compromiso con el cliente.
 *
 * Antes vivían en el navegador (`lib/datos-*.js`). Se subieron al servidor por
 * dos razones:
 *
 * 1. **Para poder auditarlos.** La bitácora se escribe con la llave de
 *    servicio y el actor sale de la sesión. Desde el navegador, quien firma el
 *    movimiento sería quien dijera el navegador.
 * 2. **Para contar las filas.** Es el error que más caro nos salió: un UPDATE
 *    bloqueado por RLS NO da error. Postgres no encuentra ninguna fila que le
 *    toque al usuario, actualiza cero y responde 200. La pantalla decía
 *    "listo" y no se había guardado nada. Aquí se cuenta lo devuelto y si son
 *    cero se dice que no pasó.
 *
 * El UPDATE sigue yendo con la sesión del usuario, no con la llave de
 * servicio: el RLS tiene que seguir siendo el guardia. Esto añade auditoría,
 * no se salta la seguridad.
 */


/**
 * Los avisos NO pueden tumbar la operación.
 *
 * Si Resend falla o no está configurado, confirmar una recolección y aplicar
 * un saldo tienen que seguir funcionando: la base es la fuente de la verdad y
 * el correo es cortesía. Pero el fallo se ANOTA, porque el 19-ago se descubrió
 * que el sitio llevaba un mes sin mandar un solo correo y nadie se enteró
 * justo porque los errores se tragaban en silencio.
 */
async function avisar(que, fn) {
  if (!hayResend()) {
    console.warn(`[avisos] ${que}: no se mandó, falta RESEND_API_KEY`);
    return;
  }
  try {
    await fn();
  } catch (e) {
    console.error(`[avisos] ${que}: no se pudo mandar —`, e?.message || e);
  }
}

async function exigirPersonal(seccion) {
  return exigirSeccion(seccion);
}

/**
 * Aplica o rechaza un depósito del cliente. Aquí se mueve dinero.
 *
 * El UPDATE, la cuenta de filas, la bitácora y el correo de "saldo resuelto"
 * viven en lib/saldos-resolver.mjs: la MISMA copia que usa la app
 * (/api/app/saldos/resolver, 6-oct-2026), que antes aplicaba sin dejar
 * huella ni avisar al cliente.
 */
export async function resolverDepositoAuditado(id, estado, notas) {
  if (!haySupabase()) return { ok: true, demo: true };

  const { quien, error: sinPermiso } = await exigirPersonal("saldos");
  if (sinPermiso) return { ok: false, motivo: sinPermiso };

  return resolverDepositoServidor({
    sb: await supabaseSesion(),
    actorId: quien.id,
    id,
    estado,
    notas,
    anotar: registrar,
  });
}

/**
 * Cambia el estado de una solicitud de recolección (confirmar, rechazar…).
 *
 * El trabajo de verdad (UPDATE contado, bitácora, correos y notificaciones al
 * cliente y al chofer) vive en lib/recolecciones-oficina.js desde el
 * 6-oct-2026: la app de la oficina (/api/app/recolecciones/*) llama a esa
 * MISMA función con su token, y así las dos puertas no se separan nunca.
 */
export async function cambiarEstadoSolicitudAuditado(id, cambios, accion) {
  if (!haySupabase()) return { ok: true, demo: true };

  const { quien, error: sinPermiso } = await exigirPersonal("recolecciones");
  if (sinPermiso) return { ok: false, motivo: sinPermiso };

  const r = await cambiarEstadoSolicitudComo({
    sb: await supabaseSesion(),
    sbServicio: supabaseServidor(),
    actor: { id: quien.id, correo: quien.correo },
    id,
    cambios,
    accion,
  });
  return r.ok ? { ok: true } : { ok: false, motivo: r.motivo };
}

/**
 * ASIGNAR UN PUNTO DE RECOLECCIÓN A UNA RUTA (6-oct-2026, Luis).
 *
 * El trabajo vive en `lib/puntos-servidor.js` (ahí está la historia): es el
 * MISMO que llama la app desde `/api/app/puntos/ruta`. Aquí queda la puerta
 * de la web, y el UPDATE sigue yendo con la SESIÓN del usuario: el RLS
 * `suscripciones_personal` es el guardia, también desde el teléfono.
 */
export async function asignarRutaAPunto(datos) {
  const revisado = revisarAsignacion(datos || {});
  if (!revisado.ok) return revisado;
  if (!haySupabase()) return { ok: true, demo: true, suscripcion: revisado.resultado };

  const { error: sinPermiso } = await exigirPersonal(["rutas", "clientes"]);
  if (sinPermiso) return { ok: false, motivo: sinPermiso };

  return asignarRutaAPuntoCon({ sb: await supabaseSesion(), anotar: registrar }, datos || {});
}

// PENDIENTE: el cambio de rol. Va aquí en cuanto la pantalla de "Usuarios y
// roles" trabaje contra la base — hoy maneja nombres de pantalla
// ("Administrador", "Auxiliar de administrador") y la base usa
// dueno/admin/operador/pendiente, así que no hay de dónde engancharla.
// No se deja escrita de antemano: una acción de servidor que nadie llama
// sigue siendo un endpoint abierto al mundo. Cuando haya pantalla, se agrega
// con la misma forma que las de arriba (exigir dueño, contar filas, registrar).

/**
 * LA OFICINA CREA UNA RECOLECCIÓN (Entrega 3, 9-oct-2026): pedidos por
 * teléfono o WhatsApp. Nace "solicitada" o, si la oficina ya la programa,
 * pasa enseguida por `cambiarEstadoSolicitudComo` (la MISMA que "Confirmar"),
 * que avisa al cliente y al chofer y escribe la bitácora.
 *
 * El INSERT va con la SESIÓN: la base exige la sección Recolecciones
 * (db/029) y pone el folio (db/031).
 */
export async function crearRecoleccionOficinaAccion(datos) {
  if (!haySupabase()) return { ok: true, demo: true, folio: "REC-DEMO" };

  const { quien, error: sinPermiso } = await exigirPersonal("recolecciones");
  if (sinPermiso) return { ok: false, motivo: sinPermiso };

  const v = validarRecoleccionOficina(datos || {}, { hoy: hoyMatamoros(), tipos: TIPOS_RESIDUO });
  if (!v.ok) return v;
  const l = v.limpio;

  const sb = await supabaseSesion();
  // El punto tiene que ser de ESE cliente, y la ruta es la de su servicio.
  const { data: punto } = await sb
    .from("domicilios")
    .select("id, cliente_id, clientes ( estado, empresa ), suscripciones ( estado, ruta_id )")
    .eq("id", l.domicilioId)
    .maybeSingle();
  if (!punto || punto.cliente_id !== l.clienteId) return { ok: false, motivo: "Ese punto no es de ese cliente." };
  if (punto.clientes?.estado === "baja") return { ok: false, motivo: "Ese cliente está dado de baja." };
  // La ruta de su servicio activo (o pausado); nunca la de uno cancelado.
  const subs = punto.suscripciones || [];
  const servicio = subs.find((s) => s.estado === "activa") || subs.find((s) => s.estado === "pausada");

  const { data: creada, error } = await sb
    .from("solicitudes_recoleccion")
    .insert({
      folio: null,
      cliente_id: l.clienteId,
      domicilio_id: l.domicilioId,
      ruta_id: servicio?.ruta_id || null,
      origen: l.origen,
      fecha_pedida: l.fecha,
      estado: "solicitada",
      nota: l.nota,
      tipo_residuo: l.tipoResiduo,
      creada_por: quien.id,
    })
    .select("id, folio")
    .single();
  if (error || !creada) return { ok: false, motivo: `No se pudo crear: ${error?.message || "sin respuesta"}` };

  await registrar({
    accion: "crear_recoleccion_oficina",
    tabla: "solicitudes_recoleccion",
    registroId: creada.id,
    detalle: { folio: creada.folio, cliente: punto.clientes?.empresa, fecha: l.fecha, confirmar: l.confirmar },
  });

  if (!l.confirmar) return { ok: true, folio: creada.folio, estado: "solicitada" };

  const r = await cambiarEstadoSolicitudComo({
    sb,
    sbServicio: supabaseServidor(),
    actor: { id: quien.id, correo: quien.correo },
    id: creada.id,
    cambios: { estado: "confirmada", fecha_confirmada: l.fecha, hora_confirmada: l.hora, chofer_id: l.choferId },
    accion: "confirmar_recoleccion",
  });
  return r.ok
    ? { ok: true, folio: creada.folio, estado: "confirmada" }
    : { ok: true, folio: creada.folio, estado: "solicitada", motivo: `Se creó, pero no se pudo confirmar: ${r.motivo}` };
}
