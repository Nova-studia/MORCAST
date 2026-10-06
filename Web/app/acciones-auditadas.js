"use server";

import { supabaseSesion, usuarioActual } from "@/lib/supabase-sesion";
import { registrar } from "@/lib/bitacora";
import { haySupabase, supabaseServidor } from "@/lib/supabase";
import {
  hayResend,
  correoRecoleccionConfirmada,
  correoRecoleccionRechazada,
  correoParadaAsignada,
  correoSaldoResuelto,
} from "@/lib/correo";
import { cargarParada, avisarCliente } from "@/lib/avisar-cliente";

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

/** Correo de un usuario del equipo. Vive en auth.users, no en `perfiles`. */
async function correoDe(uid) {
  if (!uid) return null;
  try {
    const { data } = await supabaseServidor().auth.admin.getUserById(uid);
    return data?.user?.email || null;
  } catch {
    return null;
  }
}

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
    .select("id, folio, monto, cliente_id, clientes ( empresa, correo )");

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

  await avisar("saldo resuelto", () =>
    correoSaldoResuelto({
      correo: data[0].clientes?.correo,
      empresa: data[0].clientes?.empresa,
      monto: Number(data[0].monto),
      aplicado: estado === "aplicada",
      notas,
    })
  );

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
    .select(`
      id, folio, estado, cliente_id, fecha_confirmada, hora_confirmada,
      chofer_id, motivo_rechazo,
      clientes ( empresa, correo ),
      domicilios ( alias, calle, colonia ),
      rutas ( chofer_id ),
      choferParada:perfiles!solicitudes_recoleccion_chofer_id_fkey ( nombre )
    `);

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

  const s = data[0];
  const domicilio = s.domicilios
    ? [s.domicilios.alias, s.domicilios.calle, s.domicilios.colonia].filter(Boolean).join(" · ")
    : "";

  if (s.estado === "confirmada") {
    // Un CAMBIO de día, hora o chofer de algo ya acordado (o reagendar una
    // vencida) se le dice como tal: "cambió tu recolección", no otra
    // confirmación igual a la primera que lo confunda (6-oct-2026).
    const esCambio = ["cambiar_recoleccion_confirmada", "reagendar_recoleccion_vencida"].includes(accion);
    try {
      const parada = await cargarParada(supabaseServidor(), id);
      if (esCambio) {
        await avisarCliente({ sb: supabaseServidor(), parada, evento: "reagendada" });
      } else {
        await avisar("recolección confirmada", () =>
          correoRecoleccionConfirmada({
            correo: s.clientes?.correo,
            empresa: s.clientes?.empresa,
            folio: s.folio,
            fecha: s.fecha_confirmada,
            hora: s.hora_confirmada,
            domicilio,
          })
        );
        // Y al teléfono, si tiene la app. El correo ya salió arriba.
        await avisarCliente({ sb: supabaseServidor(), parada, evento: "confirmada", soloPush: true });
      }
    } catch (e) {
      console.error("[avisos] aviso al cliente de la confirmación:", e?.message || e);
    }

    // Y al chofer que le toca: el asignado a la parada si lo hay, si no el
    // de la ruta. Su correo vive en auth.users, no en `perfiles`.
    const choferId = s.chofer_id || s.rutas?.chofer_id;
    await avisar("parada asignada", async () => {
      const correo = await correoDe(choferId);
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
    });
  }

  if (s.estado === "rechazada") {
    await avisar("recolección rechazada", () =>
      correoRecoleccionRechazada({
        correo: s.clientes?.correo,
        empresa: s.clientes?.empresa,
        folio: s.folio,
        fecha: s.fecha_confirmada || cambios?.fecha_confirmada,
        motivo: s.motivo_rechazo,
      })
    );
  }

  return { ok: true };
}

/**
 * ASIGNAR UN PUNTO DE RECOLECCIÓN A UNA RUTA (6-oct-2026, Luis).
 *
 * Antes ninguna pantalla creaba `suscripciones`: solo el cargador del
 * cuaderno. Un cliente dado de alta desde la página se quedaba sin ruta para
 * siempre, y sin ruta el portal no le ofrece "Día de mi ruta" y la app no le
 * deja agendar. La suscripción es justo esa liga: cliente + punto + ruta.
 *
 * Hay a lo más UNA por punto (índice único cliente+domicilio, db/020): si ya
 * existe se actualiza, si no se crea. `rutaClave` vacío quita la ruta pero
 * conserva la fila (y su historia de precio, db/023).
 *
 * Va con la sesión del usuario (el RLS `suscripciones_personal` es el
 * guardia), cuenta las filas y queda en la bitácora con el antes y el después.
 */
export async function asignarRutaAPunto({ domicilioId, rutaClave, serviciosPorMes, porLlamada }) {
  const n = Number(serviciosPorMes);
  if (!Number.isInteger(n) || n < 1 || n > 200) {
    return { ok: false, motivo: "Las recolecciones al mes deben ser un número entero de 1 a 200." };
  }
  const resultado = {
    rutaClave: rutaClave || null,
    serviciosPorMes: n,
    porLlamada: Boolean(porLlamada),
  };
  if (!haySupabase()) return { ok: true, demo: true, suscripcion: resultado };

  const { error: sinPermiso } = await exigirPersonal();
  if (sinPermiso) return { ok: false, motivo: sinPermiso };

  const supabase = await supabaseSesion();

  const { data: dom } = await supabase
    .from("domicilios").select("id, cliente_id, alias").eq("id", domicilioId).maybeSingle();
  if (!dom) return { ok: false, motivo: "No se encontró ese punto de recolección." };

  let ruta = null;
  if (rutaClave) {
    const { data } = await supabase
      .from("rutas").select("id, clave, nombre, activa").eq("clave", rutaClave).maybeSingle();
    if (!data) return { ok: false, motivo: "No se encontró esa ruta." };
    if (!data.activa) return { ok: false, motivo: `La ruta ${data.nombre} está desactivada.` };
    ruta = data;
  }

  const { data: previa } = await supabase
    .from("suscripciones")
    .select("id, ruta_id, servicios_por_mes, por_llamada, estado")
    .eq("cliente_id", dom.cliente_id)
    .eq("domicilio_id", dom.id)
    .maybeSingle();

  const cambios = {
    ruta_id: ruta?.id ?? null,
    servicios_por_mes: n,
    por_llamada: Boolean(porLlamada),
    // Asignarle ruta es ponerla a trabajar: una pausada o cancelada vuelve.
    ...(ruta ? { estado: "activa" } : {}),
  };

  const { data, error } = previa
    ? await supabase.from("suscripciones").update(cambios).eq("id", previa.id).select("id")
    : await supabase
        .from("suscripciones")
        .insert({ cliente_id: dom.cliente_id, domicilio_id: dom.id, frecuencia: "mensual", estado: "activa", ...cambios })
        .select("id");

  if (error) return { ok: false, motivo: error.message };
  if (!data?.length) {
    return { ok: false, motivo: "No se guardó nada: el permiso de la base no te deja tocar ese punto." };
  }

  await registrar({
    accion: "asignar_ruta_punto",
    tabla: "suscripciones",
    registroId: data[0].id,
    detalle: {
      domicilio_id: dom.id,
      punto: dom.alias,
      cliente_id: dom.cliente_id,
      antes: previa
        ? { ruta_id: previa.ruta_id, servicios_por_mes: previa.servicios_por_mes, por_llamada: previa.por_llamada, estado: previa.estado }
        : null,
      despues: { ruta: ruta?.clave ?? null, ...cambios },
    },
  });

  return { ok: true, suscripcion: { ...resultado, rutaNombre: ruta?.nombre || "" } };
}

// PENDIENTE: el cambio de rol. Va aquí en cuanto la pantalla de "Usuarios y
// roles" trabaje contra la base — hoy maneja nombres de pantalla
// ("Administrador", "Auxiliar de administrador") y la base usa
// dueno/admin/operador/pendiente, así que no hay de dónde engancharla.
// No se deja escrita de antemano: una acción de servidor que nadie llama
// sigue siendo un endpoint abierto al mundo. Cuando haya pantalla, se agrega
// con la misma forma que las de arriba (exigir dueño, contar filas, registrar).
