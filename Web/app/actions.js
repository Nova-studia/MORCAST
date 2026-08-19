"use server";

import { headers } from "next/headers";
import { supabaseServidor, haySupabase } from "@/lib/supabase";
import { hayResend, correoConfirmacion, correoAvisoInterno } from "@/lib/correo";
import { TIPOS_SERVICIO, FRECUENCIAS } from "@/lib/datos";

// Los correos no deben tumbar la solicitud: la BD es la fuente de la verdad
// y el prospecto ya quedó guardado cuando se envían.
async function enviarCorreos(datos) {
  if (!hayResend()) return;
  const resultados = await Promise.allSettled([
    correoConfirmacion(datos),
    correoAvisoInterno(datos),
  ]);
  for (const r of resultados) {
    if (r.status === "rejected") console.error("[cotizacion] Correo falló:", r.reason);
  }
}

/**
 * Las Server Actions son alcanzables por POST directo, no solo desde el
 * formulario. Todo lo de abajo (validación, honeypot, límite de envíos)
 * corre del lado del servidor a propósito.
 */

// Límite de envíos en memoria. Sirve para una sola instancia; si el sitio
// escala a varias, mover a Supabase o Upstash.
const ENVIOS = new Map();
const VENTANA_MS = 10 * 60 * 1000; // 10 minutos
const MAX_POR_VENTANA = 3;

function limiteAlcanzado(ip) {
  const ahora = Date.now();
  const previos = (ENVIOS.get(ip) ?? []).filter((t) => ahora - t < VENTANA_MS);
  if (previos.length >= MAX_POR_VENTANA) return true;
  previos.push(ahora);
  ENVIOS.set(ip, previos);

  // Limpieza oportunista para que el Map no crezca sin control
  if (ENVIOS.size > 500) {
    for (const [k, v] of ENVIOS) {
      if (v.every((t) => ahora - t >= VENTANA_MS)) ENVIOS.delete(k);
    }
  }
  return false;
}

const texto = (fd, campo, max) => {
  const v = fd.get(campo);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
};

const CORREO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function enviarCotizacion(_estadoPrevio, formData) {
  // Honeypot: campo oculto que solo un bot rellenaría.
  if (texto(formData, "sitio_web", 100)) {
    return { ok: true, mensaje: "Solicitud recibida." };
  }

  const datos = {
    nombre: texto(formData, "nombre", 120),
    empresa: texto(formData, "empresa", 160),
    telefono: texto(formData, "telefono", 30),
    correo: texto(formData, "correo", 160),
    tipo_servicio: texto(formData, "tipo_servicio", 80),
    frecuencia: texto(formData, "frecuencia", 60),
    direccion: texto(formData, "direccion", 300),
    mensaje: texto(formData, "mensaje", 1500),
  };

  // --- Validación ---
  const errores = {};
  if (datos.nombre.length < 2) errores.nombre = "Escribe tu nombre.";
  if (datos.telefono.replace(/\D/g, "").length < 10)
    errores.telefono = "Escribe un teléfono a 10 dígitos.";
  if (!CORREO_RE.test(datos.correo))
    errores.correo = "Escribe un correo válido.";
  if (!TIPOS_SERVICIO.includes(datos.tipo_servicio))
    errores.tipo_servicio = "Elige un tipo de servicio.";
  if (datos.frecuencia && !FRECUENCIAS.includes(datos.frecuencia))
    errores.frecuencia = "Elige una frecuencia de la lista.";

  if (Object.keys(errores).length) {
    return {
      ok: false,
      errores,
      mensaje: "Revisa los campos marcados.",
      valores: datos,
    };
  }

  // --- Límite de envíos ---
  const cabeceras = await headers();
  const ip =
    cabeceras.get("x-forwarded-for")?.split(",")[0].trim() ||
    cabeceras.get("x-real-ip") ||
    "desconocida";

  if (limiteAlcanzado(ip)) {
    return {
      ok: false,
      mensaje:
        "Ya recibimos varias solicitudes desde este equipo. Espera unos minutos o llámanos directo.",
      valores: datos,
    };
  }

  // --- Guardado ---
  if (!haySupabase()) {
    // Sin BD configurada no perdemos el prospecto: queda en el log del servidor.
    console.warn("[cotizacion] Supabase no configurado. Solicitud:", datos);
    await enviarCorreos(datos);
    return {
      ok: true,
      mensaje:
        "¡Gracias! Recibimos tu solicitud y te contactamos a la brevedad.",
    };
  }

  try {
    const sb = supabaseServidor();
    const { error } = await sb.from("cotizaciones").insert({
      ...datos,
      origen_ip: ip,
      user_agent: cabeceras.get("user-agent")?.slice(0, 300) ?? null,
    });

    if (error) throw error;

    await enviarCorreos(datos);

    return {
      ok: true,
      mensaje:
        "¡Gracias! Recibimos tu solicitud y te contactamos a la brevedad.",
    };
  } catch (e) {
    console.error("[cotizacion] Error al guardar:", e);
    return {
      ok: false,
      mensaje:
        "No pudimos enviar tu solicitud. Inténtalo de nuevo o escríbenos por WhatsApp.",
      valores: datos,
    };
  }
}
