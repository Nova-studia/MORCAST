import { puedeCancelar, puedeReagendar, validarReagenda, motivoCancelacion } from "./solicitud-cliente.mjs";

/**
 * CANCELAR O REAGENDAR, DEL LADO DEL SERVIDOR (Entrega 4, 9-oct-2026).
 *
 * El cliente no tiene política de UPDATE en `solicitudes_recoleccion` (y está
 * bien así): esto va con la llave de SERVICIO, siempre comprobando que la
 * solicitud sea de la empresa de la sesión (`quien.cliente_id`). El UPDATE
 * lleva también el estado esperado: si entre tanto cambió (o es un doble
 * clic), no toca nada ni vuelve a avisar.
 *
 * Avisos inyectados (oficina por correo y notificación; chofer por
 * notificación) para probarlo sin red: tests/solicitud-cliente-servidor.test.mjs.
 */
export async function cambiarSolicitudClienteCon({ sb, quien, anotar, avisarOficina, avisarChofer }, datos = {}) {
  const { id, accion, hoy } = datos;
  const { data: s } = await sb
    .from("solicitudes_recoleccion")
    .select("id, folio, estado, cliente_id, chofer_id, fecha_pedida, fecha_confirmada, hora_confirmada, rutas ( chofer_id ), clientes ( empresa )")
    .eq("id", id)
    .maybeSingle();
  if (!s || s.cliente_id !== quien.cliente_id) return { ok: false, motivo: "No encontré esa solicitud." };

  let cambios;
  let estados;
  let detalle;
  if (accion === "cancelar") {
    if (!puedeCancelar(s.estado)) {
      return {
        ok: false,
        motivo: s.estado === "en-ruta"
          ? "El chofer ya va en camino: para cancelarla, llámanos."
          : "Esta solicitud ya no se puede cancelar.",
      };
    }
    cambios = { estado: "rechazada", motivo_rechazo: motivoCancelacion(datos.motivo) };
    estados = ["solicitada", "confirmada"];
    detalle = { folio: s.folio, antes: s.estado, motivo: cambios.motivo_rechazo };
  } else if (accion === "reagendar") {
    if (!puedeReagendar(s.estado)) {
      return { ok: false, motivo: "Ya está confirmada: para cambiarle la fecha, escríbenos." };
    }
    const v = validarReagenda({ fecha: datos.fecha, hoy, actual: s.fecha_pedida });
    if (!v.ok) return v;
    cambios = { fecha_pedida: v.fecha };
    estados = ["solicitada"];
    detalle = { folio: s.folio, antes: s.fecha_pedida, despues: v.fecha };
  } else {
    return { ok: false, motivo: "Acción desconocida." };
  }

  const { data, error } = await sb
    .from("solicitudes_recoleccion")
    .update(cambios)
    .eq("id", s.id)
    .eq("cliente_id", quien.cliente_id)
    .in("estado", estados)
    .select("id");
  if (error) return { ok: false, motivo: `No se pudo guardar: ${error.message}` };
  if (!data?.length) return { ok: false, motivo: "La solicitud cambió mientras tanto. Recarga la página." };

  await anotar({
    accion: accion === "cancelar" ? "cliente_cancela_recoleccion" : "cliente_reagenda_recoleccion",
    tabla: "solicitudes_recoleccion",
    registroId: s.id,
    detalle,
  });

  const empresa = s.clientes?.empresa || "";
  try {
    await avisarOficina({ accion, folio: s.folio, empresa, ...detalle });
  } catch {
    /* el cambio ya quedó; el aviso no lo deshace */
  }
  // Si ya tenía chofer (confirmada), a él: "te quitaron una parada".
  const uid = accion === "cancelar" && s.estado === "confirmada" ? s.chofer_id || s.rutas?.chofer_id : null;
  if (uid) {
    try {
      await avisarChofer({
        uid,
        parada: { id: s.id, folio: s.folio, cliente: empresa, fecha: s.fecha_confirmada || s.fecha_pedida, hora: s.hora_confirmada },
      });
    } catch {
      /* igual */
    }
  }
  return { ok: true, ...(accion === "reagendar" ? { fecha: cambios.fecha_pedida } : {}) };
}
