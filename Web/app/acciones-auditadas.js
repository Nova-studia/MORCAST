"use server";

import { supabaseSesion, usuarioActual } from "@/lib/supabase-sesion";
import { registrar } from "@/lib/bitacora";
import { haySupabase } from "@/lib/supabase";

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

const PERSONAL = ["dueno", "admin"];

async function exigirPersonal() {
  const quien = await usuarioActual();
  if (!quien) return { error: "Tu sesión se venció. Vuelve a entrar." };
  if (!PERSONAL.includes(quien.rol)) return { error: "No tienes permiso para esto." };
  return { quien };
}

/** Aplica o rechaza un depósito del cliente. Aquí se mueve dinero. */
export async function resolverDepositoAuditado(id, estado, notas) {
  if (!haySupabase()) return { ok: true, demo: true };

  const { quien, error: sinPermiso } = await exigirPersonal();
  if (sinPermiso) return { ok: false, motivo: sinPermiso };

  const supabase = await supabaseSesion();
  const { data, error } = await supabase
    .from("movimientos_saldo")
    .update({ estado, notas: notas || null, verificado_por: quien.id })
    .eq("id", id)
    .select("id, folio, monto, cliente_id");

  if (error) return { ok: false, motivo: error.message };
  if (!data?.length) {
    return {
      ok: false,
      motivo: "No se cambió nada: el permiso de la base no te deja tocar ese movimiento.",
    };
  }

  await registrar({
    accion: estado === "aplicada" ? "aplicar_saldo" : "rechazar_saldo",
    tabla: "movimientos_saldo",
    registroId: id,
    detalle: {
      folio: data[0].folio,
      monto: Number(data[0].monto),
      cliente_id: data[0].cliente_id,
      notas: notas || null,
    },
  });

  return { ok: true };
}

/** Cambia el estado de una solicitud de recolección (confirmar, rechazar…). */
export async function cambiarEstadoSolicitudAuditado(id, cambios, accion) {
  if (!haySupabase()) return { ok: true, demo: true };

  const { error: sinPermiso } = await exigirPersonal();
  if (sinPermiso) return { ok: false, motivo: sinPermiso };

  const supabase = await supabaseSesion();
  const { data, error } = await supabase
    .from("solicitudes_recoleccion")
    .update(cambios)
    .eq("id", id)
    .select("id, folio, estado, cliente_id, fecha_confirmada");

  if (error) return { ok: false, motivo: error.message };
  if (!data?.length) {
    return {
      ok: false,
      motivo: "No se cambió nada: el permiso de la base no te deja tocar esa solicitud.",
    };
  }

  await registrar({
    accion: accion || "cambiar_estado_solicitud",
    tabla: "solicitudes_recoleccion",
    registroId: id,
    detalle: {
      folio: data[0].folio,
      estado: data[0].estado,
      cliente_id: data[0].cliente_id,
      cambios,
    },
  });

  return { ok: true };
}

// PENDIENTE: el cambio de rol. Va aquí en cuanto la pantalla de "Usuarios y
// roles" trabaje contra la base — hoy maneja nombres de pantalla
// ("Administrador", "Auxiliar de administrador") y la base usa
// dueno/admin/operador/pendiente, así que no hay de dónde engancharla.
// No se deja escrita de antemano: una acción de servidor que nadie llama
// sigue siendo un endpoint abierto al mundo. Cuando haya pantalla, se agrega
// con la misma forma que las de arriba (exigir dueño, contar filas, registrar).
