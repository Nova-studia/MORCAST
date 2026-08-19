"use client";

/**
 * ZONAS PEDIDAS: gente que quedó fuera de cobertura y dejó su contacto.
 * Es la lista de por dónde conviene abrir la siguiente ruta.
 */

import { supabaseNavegador, haySupabaseNavegador } from "@/lib/supabase-navegador";
import { ZONAS_PEDIDAS_SEED } from "@/lib/rutas-datos";

function aFormatoPantalla(z) {
  return {
    id: z.clave,
    uuid: z.id,
    nombreContacto: z.nombre_contacto || "",
    empresa: z.empresa || "",
    telefono: z.telefono || "",
    correo: z.correo || "",
    colonia: z.colonia || "",
    lat: z.lat,
    lng: z.lng,
    volumenEstimado: z.volumen_estimado || "",
    estado: z.estado,
    fecha: z.fecha,
  };
}

export async function listarZonasPedidas() {
  if (!haySupabaseNavegador()) return ZONAS_PEDIDAS_SEED;

  const { data, error } = await supabaseNavegador()
    .from("zonas_pedidas")
    .select("id, clave, nombre_contacto, empresa, telefono, correo, colonia, lat, lng, volumen_estimado, estado, fecha")
    .order("fecha", { ascending: false });

  if (error) {
    console.error("[zonas] No se pudieron leer:", error.message);
    return [];
  }
  return (data || []).map(aFormatoPantalla);
}

/** Cambia el estado de una zona pedida (nueva → en evaluación → aprobada). */
export async function cambiarEstadoZona(uuid, estado) {
  if (!haySupabaseNavegador()) return { ok: true, demo: true };

  const { data, error } = await supabaseNavegador()
    .from("zonas_pedidas")
    .update({ estado })
    .eq("id", uuid)
    .select("id");

  if (error) {
    console.error("[zonas] No se pudo actualizar:", error.message);
    return { ok: false, motivo: error.message };
  }
  // Un UPDATE que el RLS bloquea NO da error: no encuentra ninguna fila
  // que le toque al usuario, cambia CERO y responde 200. Por eso se
  // cuentan las filas devueltas en vez de confiar en que no hubo error.
  if (!data?.length) {
    return { ok: false, motivo: "No se cambió nada: el permiso de la base no te deja tocar esa zona." };
  }
  return { ok: true };
}
