"use client";

/**
 * Datos del MODO CHOFER.
 *
 * El chofer ve las paradas de las rutas que trae asignadas, y solo esas. Eso
 * no se decide aquí: la política de RLS `solicitudes_del_operador` ya filtra
 * por `rutas.chofer_id = auth.uid()`.
 */

import { supabaseNavegador, haySupabaseNavegador } from "@/lib/supabase-navegador";
import { subirEvidencia } from "@/lib/datos-archivos";

/** Fecha de hoy en YYYY-MM-DD con la hora LOCAL, no en UTC. */
export function hoyISO() {
  const f = new Date();
  const mes = String(f.getMonth() + 1).padStart(2, "0");
  const dia = String(f.getDate()).padStart(2, "0");
  return `${f.getFullYear()}-${mes}-${dia}`;
}

/**
 * Las paradas del chofer para una fecha.
 *
 * Se traen las confirmadas y las que ya están en ruta. Una "solicitada" no
 * aparece a propósito: si Morcast no la ha confirmado, el chofer no debería
 * ir por ella.
 */
export async function rutaDelDia(fecha = hoyISO()) {
  if (!haySupabaseNavegador()) return [];

  const { data, error } = await supabaseNavegador()
    .from("solicitudes_recoleccion")
    .select(`
      id, folio, estado, fecha_pedida, fecha_confirmada, nota,
      clientes ( empresa ),
      domicilios ( alias, calle, colonia ),
      rutas ( nombre, unidad ),
      recolecciones ( id, qr, peso_kg, foto_antes, foto_despues, hora_antes, hora_despues )
    `)
    .in("estado", ["confirmada", "en-ruta", "completada"])
    .or(`fecha_confirmada.eq.${fecha},and(fecha_confirmada.is.null,fecha_pedida.eq.${fecha})`)
    .order("folio");

  if (error) {
    console.error("[chofer] No se pudo leer la ruta:", error.message);
    return [];
  }

  return (data || []).map((s) => {
    const ev = s.recolecciones?.[0] || null;
    return {
      id: s.id,
      folio: s.folio,
      cliente: s.clientes?.empresa || "—",
      direccion: s.domicilios
        ? [s.domicilios.alias, s.domicilios.calle, s.domicilios.colonia].filter(Boolean).join(" · ")
        : "Sin domicilio registrado",
      unidad: s.rutas?.unidad || "Sin unidad",
      ruta: s.rutas?.nombre || "",
      nota: s.nota || "",
      // "Completado" es que ya se levantó la evidencia, no solo que el estado
      // diga completada: el chofer necesita ver lo que le falta POR HACER.
      estatus: s.estado === "completada" && ev ? "completado" : "pendiente",
      evidencia: ev,
    };
  });
}

/**
 * Cambia el estado de una parada comprobando que DE VERDAD haya cambiado.
 *
 * ⚠️ Un UPDATE bloqueado por RLS **no da error**: Postgres no encuentra
 * ninguna fila que le toque a este usuario, actualiza cero y responde que
 * todo bien. Por eso se pide `.select()` y se cuentan las filas devueltas.
 * Sin esto, el sistema cree que cerró un servicio que sigue abierto.
 */
async function cambiarEstadoParada(solicitudId, estado) {
  const { data, error } = await supabaseNavegador()
    .from("solicitudes_recoleccion")
    .update({ estado })
    .eq("id", solicitudId)
    .select("id");

  if (error) return { ok: false, motivo: error.message };
  if (!data || data.length === 0) {
    return { ok: false, motivo: "No tienes permiso para cambiar esta parada." };
  }
  return { ok: true };
}

/** Marca que el chofer va en camino. */
export async function marcarEnRuta(solicitudId) {
  if (!haySupabaseNavegador()) return { ok: true, demo: true };
  return cambiarEstadoParada(solicitudId, "en-ruta");
}

/**
 * Cierra la recolección: guarda la evidencia y da el servicio por completado.
 *
 * El orden importa. Primero suben las fotos, luego se guarda el registro que
 * las apunta, y hasta el final se marca completada la solicitud. Al revés, un
 * fallo a media subida dejaría un servicio "completado" sin evidencia, que es
 * justo lo que no puede pasar: la evidencia es el comprobante ambiental del
 * cliente.
 */
export async function cerrarRecoleccion({
  solicitudId, qr, pesoKg, horaAntes, horaDespues,
  // Las fotos llegan YA SUBIDAS, como rutas. La pantalla las sube en cuanto
  // se toman: si el chofer recarga o pierde señal a media parada, no pierde
  // lo que ya hizo. Se aceptan también los archivos sueltos por si alguna
  // pantalla vieja todavía los manda.
  rutaAntes = null, rutaDespues = null, fotoAntes, fotoDespues,
}) {
  if (!haySupabaseNavegador()) return { ok: true, demo: true };

  const supabase = supabaseNavegador();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, motivo: "No hay sesión." };

  let antes = rutaAntes;
  let despues = rutaDespues;

  if (!antes && fotoAntes) {
    const r = await subirEvidencia(solicitudId, "antes", fotoAntes);
    if (!r.ok) return { ok: false, motivo: "No se pudo subir la foto de antes." };
    antes = r.ruta;
  }
  if (!despues && fotoDespues) {
    const r = await subirEvidencia(solicitudId, "despues", fotoDespues);
    if (!r.ok) return { ok: false, motivo: "No se pudo subir la foto de después." };
    despues = r.ruta;
  }

  const { error: errorEv } = await supabase.from("recolecciones").insert({
    solicitud_id: solicitudId,
    operador_id: user.id,
    qr: qr || null,
    peso_kg: pesoKg ? Number(pesoKg) : null,
    foto_antes: antes,
    foto_despues: despues,
    hora_antes: horaAntes || null,
    hora_despues: horaDespues || null,
  });

  if (errorEv) {
    console.error("[chofer] No se pudo guardar la evidencia:", errorEv.message);
    return { ok: false, motivo: errorEv.message };
  }

  const cierre = await cambiarEstadoParada(solicitudId, "completada");
  if (!cierre.ok) {
    // La evidencia sí quedó guardada; solo falló el último paso. Se avisa en
    // vez de callarlo, porque el servicio seguiría apareciendo como pendiente
    // y nadie sabría por qué.
    return {
      ok: false,
      motivo: "Se guardaron las fotos y el peso, pero no se pudo cerrar el servicio. Avisa a la oficina.",
    };
  }

  return { ok: true };
}
