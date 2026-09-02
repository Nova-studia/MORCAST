"use client";

/**
 * Subida y lectura de archivos (fotos del chofer, comprobantes de pago).
 *
 * Las dos cubetas son PRIVADAS. No existe una dirección pública que se pueda
 * pegar en un chat: para ver una foto hay que pedir una URL FIRMADA, y esa
 * caduca. Quién puede pedirla lo deciden las políticas de db/008.
 *
 * ⚠️ La ruta del archivo NO es decorativa: la primera carpeta es de dónde
 * sale el permiso. `evidencias/<id-solicitud>/antes.jpg` funciona;
 * `evidencias/foto1.jpg` lo rechaza la base, y así debe ser.
 */

import { supabaseNavegador, haySupabaseNavegador } from "@/lib/supabase-navegador";

/** Minutos que dura un enlace de foto antes de caducar. */
const MINUTOS_VIGENCIA = 60;

/** Quita acentos y espacios del nombre para que la ruta no dé sorpresas. */
function nombreLimpio(nombre) {
  return String(nombre)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .slice(-60);
}

/**
 * Sube la foto de una recolección.
 * `momento` es "antes" o "despues".
 */
export async function subirEvidencia(solicitudId, momento, archivo) {
  if (!haySupabaseNavegador()) return { ok: true, demo: true };
  if (!solicitudId) return { ok: false, motivo: "Falta la recolección." };

  const extension = (archivo.name.split(".").pop() || "jpg").toLowerCase();
  // Se le pone la hora para no pisar un intento anterior: si el chofer se
  // equivocó de foto, quedan las dos y Morcast decide cuál vale.
  const ruta = `${solicitudId}/${momento}-${Date.now()}.${extension}`;

  const { error } = await supabaseNavegador()
    .storage.from("evidencias")
    .upload(ruta, archivo, { contentType: archivo.type, upsert: false });

  if (error) {
    console.error("[archivos] No se pudo subir la evidencia:", error.message);
    return { ok: false, motivo: error.message };
  }
  return { ok: true, ruta };
}

/** Sube el comprobante de pago de un cliente a su propia carpeta. */
export async function subirComprobante(clienteUuid, archivo) {
  if (!haySupabaseNavegador()) return { ok: true, demo: true };
  if (!clienteUuid) return { ok: false, motivo: "Falta la empresa." };

  const ruta = `${clienteUuid}/${Date.now()}-${nombreLimpio(archivo.name)}`;

  const { error } = await supabaseNavegador()
    .storage.from("comprobantes")
    .upload(ruta, archivo, { contentType: archivo.type, upsert: false });

  if (error) {
    console.error("[archivos] No se pudo subir el comprobante:", error.message);
    return { ok: false, motivo: error.message };
  }
  return { ok: true, ruta };
}

/**
 * Enlace temporal para ver un archivo privado.
 *
 * Devuelve null si quien pregunta no tiene permiso, en vez de reventar: para
 * la pantalla, "no hay foto" y "no te toca verla" se dibujan igual, y no hay
 * razón para decirle a nadie que el archivo existe pero no es suyo.
 */
export async function enlaceTemporal(cubeta, ruta) {
  if (!haySupabaseNavegador() || !ruta) return null;

  const { data, error } = await supabaseNavegador()
    .storage.from(cubeta)
    .createSignedUrl(ruta, MINUTOS_VIGENCIA * 60);

  if (error) return null;
  return data?.signedUrl || null;
}

/** Atajo para las fotos de una recolección. */
export const enlaceEvidencia = (ruta) => enlaceTemporal("evidencias", ruta);

/** Atajo para el comprobante de un pago. */
export const enlaceComprobante = (ruta) => enlaceTemporal("comprobantes", ruta);

/**
 * Atajo para el currículum de un candidato.
 *
 * Éste SÍ vive aquí, aunque la SUBIDA no: subir lo hace el servidor, porque
 * quien aplica no tiene sesión. Leerlo lo hace el panel, que sí la tiene.
 */
export const enlaceCurriculum = (ruta) => enlaceTemporal("curriculums", ruta);
