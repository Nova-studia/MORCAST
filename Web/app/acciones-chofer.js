"use server";

import { supabaseSesion, usuarioActual } from "@/lib/supabase-sesion";
import { haySupabase, supabaseServidor } from "@/lib/supabase";
import { registrar } from "@/lib/bitacora";
import { cargarIncidente, avisarOficina } from "@/lib/avisar-incidente";
import { validarReporte, validarNoProcedio, rutaEnCarpeta } from "@/lib/chofer-reportes.mjs";

/**
 * Lo que el CHOFER manda desde la calle y tiene que quedar firmado:
 * el "No procedió" de una parada (no se le cobra al cliente) y los
 * incidentes (accidente, retraso, contenedor dañado…), que además avisan
 * a la oficina por correo y con una notificación al teléfono.
 *
 * Mismo criterio que `acciones-auditadas.js`:
 *   · La escritura va con la SESIÓN del chofer, no con la llave de servicio.
 *     El RLS sigue siendo el guardia (db/023: `solicitudes_cierra_operador`
 *     e `incidentes_reporta_operador`); esto agrega bitácora y correo.
 *   · Se cuentan las filas devueltas: un UPDATE que el RLS bloquea no da
 *     error, cambia cero filas y responde que todo bien.
 *   · Lo que llega del navegador se vuelve a validar aquí. La validación del
 *     teléfono es para ayudar al chofer, no para proteger la base.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function exigirChofer() {
  const quien = await usuarioActual();
  if (!quien) return { error: "Tu sesión se venció. Vuelve a entrar." };
  if (quien.rol !== "operador") return { error: "Esto solo lo puede hacer un chofer." };
  return { quien };
}

/**
 * "No procedió": el chofer llegó y no se pudo recoger (otro residuo,
 * cerrado, el contenedor no estaba…). La parada se cierra sin cobro.
 *
 * `foto` es opcional y llega YA SUBIDA a `evidencias/<solicitud>/…` (mismo
 * camino que las fotos de la evidencia). La tabla no tiene columna para
 * ella: su ruta queda en la bitácora, que es el respaldo ante el cliente.
 */
export async function marcarNoProcedio(solicitudId, { motivo, detalle, foto } = {}) {
  if (typeof solicitudId !== "string" || !UUID.test(solicitudId)) {
    return { ok: false, motivo: "Esa parada no existe." };
  }
  const v = validarNoProcedio({ motivo, detalle });
  if (!v.ok) return { ok: false, motivo: v.mensaje, campo: v.campo };
  if (foto && !rutaEnCarpeta(foto, solicitudId)) {
    return { ok: false, motivo: "La foto no es de esta parada." };
  }

  if (!haySupabase()) return { ok: true, demo: true };

  const { error: sinPermiso } = await exigirChofer();
  if (sinPermiso) return { ok: false, motivo: sinPermiso };

  const supabase = await supabaseSesion();
  const { data, error } = await supabase
    .from("solicitudes_recoleccion")
    .update({ estado: "no-procedio", ...v.datos })
    .eq("id", solicitudId)
    .select("id, folio");

  // El trigger de db/023 responde en español ("hay que decir el motivo"):
  // se le pasa tal cual al chofer.
  if (error) return { ok: false, motivo: error.message };
  if (!data?.length) {
    return {
      ok: false,
      motivo: "No se cambió nada: esa parada ya no está abierta o no es de tu ruta. Avisa a la oficina.",
    };
  }

  await registrar({
    accion: "no_procedio",
    tabla: "solicitudes_recoleccion",
    registroId: solicitudId,
    detalle: {
      folio: data[0].folio,
      motivo: v.datos.motivo_no_procedio,
      detalle: v.datos.detalle_no_procedio,
      foto: foto || null,
    },
  });

  return { ok: true };
}

/**
 * El chofer reporta un incidente. Se guarda SIEMPRE primero y después se
 * avisa por correo: si el correo falla, el reporte no se pierde.
 *
 * La unidad y la ruta no las dice el chofer: salen de la parada (si el
 * reporte va amarrado a una) o de la ruta que él maneja. Así el panel sabe
 * qué camión fue aunque con las prisas nadie lo haya escrito.
 */
export async function reportarIncidente(entrada = {}) {
  const v = validarReporte(entrada);
  if (!v.ok) return { ok: false, motivo: v.mensaje, campo: v.campo };
  const datos = v.datos;

  if (!haySupabase()) return { ok: true, demo: true, correo: false };

  const { quien, error: sinPermiso } = await exigirChofer();
  if (sinPermiso) return { ok: false, motivo: sinPermiso };

  // La foto llega ya subida; solo se acepta si está en SU carpeta.
  const foto = entrada.foto ? String(entrada.foto) : null;
  if (foto && !rutaEnCarpeta(foto, quien.id)) {
    return { ok: false, motivo: "La foto no se subió a tu carpeta. Tómala otra vez." };
  }

  const supabase = await supabaseSesion();
  const camposRuta = "id, nombre, unidad, unidad_id, unidades ( numero_economico )";

  // Contexto de la parada. Si el RLS no la deja ver, no es suya.
  let parada = null;
  if (datos.solicitud_id) {
    const { data } = await supabase
      .from("solicitudes_recoleccion")
      .select(`id, folio, clientes ( empresa ), domicilios ( alias ), rutas ( ${camposRuta} )`)
      .eq("id", datos.solicitud_id)
      .maybeSingle();
    if (!data) return { ok: false, motivo: "Esa parada no está en tu ruta." };
    parada = data;
  }

  let ruta = parada?.rutas || null;
  if (!ruta) {
    // Sin parada (o parada sin ruta): la ruta activa que maneja. Si tiene
    // varias, primero la que ya tiene unidad asignada.
    const { data } = await supabase
      .from("rutas")
      .select(camposRuta)
      .eq("chofer_id", quien.id)
      .eq("activa", true)
      .order("unidad_id", { ascending: true, nullsFirst: false })
      .limit(1);
    ruta = data?.[0] || null;
  }

  // Si el RLS no le deja ver el contenedor, no es de sus paradas.
  if (datos.contenedor_id) {
    const { data } = await supabase
      .from("contenedores")
      .select("id")
      .eq("id", datos.contenedor_id)
      .maybeSingle();
    if (!data) return { ok: false, motivo: "Ese contenedor no es de tus paradas." };
  }

  const { data: filas, error } = await supabase
    .from("incidentes")
    .insert({
      ...datos,
      foto,
      operador_id: quien.id,
      unidad_id: ruta?.unidad_id || null,
      ruta_id: ruta?.id || null,
    })
    .select("id");

  if (error) {
    console.error("[incidentes] No se pudo guardar:", error.message);
    return { ok: false, motivo: "No se pudo guardar el reporte. Revisa tu señal e intenta otra vez." };
  }
  if (!filas?.length) {
    return { ok: false, motivo: "No se guardó el reporte: la base no te dejó. Llama a la oficina." };
  }

  await registrar({
    accion: "reportar_incidente",
    tabla: "incidentes",
    registroId: filas[0].id,
    detalle: { tipo: datos.tipo, solicitud_id: datos.solicitud_id, ruta_id: ruta?.id || null },
  });

  // El aviso a la oficina (correo + notificación al teléfono del dueño y los
  // administradores) es el mismo que pide la app: lib/avisar-incidente.js.
  // Se relee el incidente con la llave de servicio para armarlo igual en los
  // dos casos; si algo falla, el reporte ya quedó guardado.
  let aviso = { correo: false, notificaciones: 0 };
  try {
    const sb = supabaseServidor();
    const incidente = await cargarIncidente(sb, filas[0].id);
    if (incidente) aviso = await avisarOficina({ sb, incidente, chofer: quien.nombre || quien.correo });
    else console.error("[incidentes] no se pudo releer el incidente para avisar:", filas[0].id);
  } catch (e) {
    console.error("[incidentes] no se pudo avisar a la oficina:", e?.message || e);
  }

  return { ok: true, id: filas[0].id, correo: aviso.correo, notificaciones: aviso.notificaciones };
}
