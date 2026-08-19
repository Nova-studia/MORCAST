"use client";

/**
 * SOLICITUDES DE COTIZACIÓN: las que llegan del formulario público de la web.
 *
 * A diferencia del resto, estas ya existían: la tabla `cotizaciones` lleva
 * tiempo recibiendo prospectos reales desde el formulario de contacto. Lo que
 * faltaba era que el panel pudiera verlas.
 *
 * Solo el personal de Morcast las lee. Quien deja su teléfono en el
 * formulario no tiene por qué ser visible para nadie más.
 */

import { supabaseNavegador, haySupabaseNavegador } from "@/lib/supabase-navegador";
import { SOLICITUDES } from "@/lib/admin-datos";

export async function listarCotizaciones() {
  if (!haySupabaseNavegador()) return SOLICITUDES;

  const { data, error } = await supabaseNavegador()
    .from("cotizaciones")
    .select("id, creado_en, nombre, empresa, telefono, correo, tipo_servicio, frecuencia, direccion, mensaje, estado, notas")
    .order("creado_en", { ascending: false });

  if (error) {
    console.error("[cotizaciones] No se pudieron leer:", error.message);
    return [];
  }

  return (data || []).map((c) => ({
    id: c.id,
    folio: `COT-${String(c.id).slice(0, 8)}`,
    fecha: (c.creado_en || "").slice(0, 10),
    empresa: c.empresa || c.nombre || "Sin empresa",
    contacto: c.nombre || "",
    telefono: c.telefono || "",
    correo: c.correo || "",
    servicio: c.tipo_servicio || "",
    frecuencia: c.frecuencia || "",
    direccion: c.direccion || "",
    mensaje: c.mensaje || "",
    // Las filas viejas pueden venir sin estado: se asumen nuevas.
    estado: c.estado || "nueva",
    notas: c.notas || "",
  }));
}

/** Mueve una solicitud por el embudo (nueva → contactada → ganada/perdida). */
export async function cambiarEstadoCotizacion(id, estado, notas) {
  if (!haySupabaseNavegador()) return { ok: true, demo: true };

  const cambios = { estado };
  if (notas !== undefined) cambios.notas = notas;

  const { data, error } = await supabaseNavegador()
    .from("cotizaciones")
    .update(cambios)
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("[cotizaciones] No se pudo actualizar:", error.message);
    return { ok: false, motivo: error.message };
  }
  // Un UPDATE que el RLS bloquea NO da error: no encuentra ninguna fila
  // que le toque al usuario, cambia CERO y responde 200. Por eso se
  // cuentan las filas devueltas en vez de confiar en que no hubo error.
  if (!data?.length) {
    return { ok: false, motivo: "No se cambió nada: el permiso de la base no te deja tocar esa solicitud." };
  }
  return { ok: true };
}
