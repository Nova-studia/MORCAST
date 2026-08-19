"use server";

import { supabaseServidor, haySupabase } from "@/lib/supabase";
import { correoAvisoAlta, correoAcuseAlta } from "@/lib/correo";
import { registrar } from "@/lib/bitacora";

/**
 * Alta de cliente desde la pantalla pública.
 *
 * Va por el servidor con la llave de servicio, no desde el navegador. La
 * tabla `solicitudes_alta` no tiene política de inserción a propósito: si se
 * abriera al público, cualquiera podría llenarla de basura desde fuera sin
 * pasar por la pantalla.
 *
 * No confía en nada de lo que manda el navegador: valida y recorta aquí. El
 * cliente puede mandar lo que quiera.
 */

/**
 * Las zonas de cobertura, para la pantalla PÚBLICA de alta.
 *
 * Va por el servidor porque la tabla `rutas` solo se le entrega a quien tiene
 * sesión, y quien se da de alta todavía no tiene. Antes esta pantalla usaba
 * unas zonas escritas a mano en el código: si Morcast redibujaba una zona en el
 * panel, el formulario público seguía contestando con las viejas — y de ahí
 * salía el "sí estás en cobertura" que se guarda y se manda por correo.
 *
 * Devuelve SOLO lo que la pantalla enseña. La zona no es un secreto (es lo que
 * se le presume al cliente), pero el chofer asignado y la unidad no tienen por
 * qué salir al público.
 */
export async function zonasDeCobertura() {
  if (!haySupabase()) return null; // sin base, la pantalla usa sus zonas de respaldo

  const { data, error } = await supabaseServidor()
    .from("rutas")
    .select("id, clave, nombre, tipo, dias, zona, activa")
    .eq("activa", true)
    .order("clave");

  if (error) {
    console.error("[alta] no se pudieron leer las zonas:", error.message);
    return null;
  }
  return (data || [])
    .filter((r) => Array.isArray(r.zona) && r.zona.length >= 3)
    .map((r) => ({
      id: r.id,
      clave: r.clave,
      nombre: r.nombre,
      tipo: r.tipo,
      dias: r.dias || [],
      zona: r.zona,
      activa: true,
    }));
}

const LIMITES = {
  empresa: 120, contacto: 120, telefono: 30, correo: 160,
  alias: 80, calle: 160, colonia: 120, cp: 10, referencias: 400,
  razonSocial: 160, rfc: 20, domicilioFiscal: 240, usoCFDI: 80, formaPago: 80,
};

const texto = (v, max) => String(v ?? "").trim().slice(0, max);

function folioNuevo() {
  // ALTA-2026-8F3K: legible por teléfono y sin depender de un contador que
  // obligaría a leer la tabla antes de escribir.
  const azar = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ALTA-${new Date().getFullYear()}-${azar}`;
}

export async function registrarAlta(entrada) {
  const empresa = texto(entrada.empresa, LIMITES.empresa);
  const contacto = texto(entrada.contacto, LIMITES.contacto);
  const telefono = texto(entrada.telefono, LIMITES.telefono);
  const correo = texto(entrada.correo, LIMITES.correo);

  if (!empresa || !contacto || !telefono || !correo) {
    return { ok: false, motivo: "Faltan datos de contacto." };
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) {
    return { ok: false, motivo: "El correo no parece válido." };
  }

  const servicios = Number.parseInt(entrada.serviciosPorMes, 10);
  if (!Number.isFinite(servicios) || servicios < 1 || servicios > 200) {
    return { ok: false, motivo: "Di cuántas recolecciones al mes necesitas (entre 1 y 200)." };
  }

  const fila = {
    folio: folioNuevo(),
    empresa, contacto, telefono, correo,
    alias: texto(entrada.alias, LIMITES.alias),
    calle: texto(entrada.calle, LIMITES.calle),
    colonia: texto(entrada.colonia, LIMITES.colonia),
    cp: texto(entrada.cp, LIMITES.cp),
    referencias: texto(entrada.referencias, LIMITES.referencias),
    lat: Number.isFinite(Number(entrada.lat)) ? Number(entrada.lat) : null,
    lng: Number.isFinite(Number(entrada.lng)) ? Number(entrada.lng) : null,
    residuos: Array.isArray(entrada.residuos) ? entrada.residuos.slice(0, 20) : [],
    equipo: Array.isArray(entrada.equipo) ? entrada.equipo.slice(0, 20) : [],
    servicios_por_mes: servicios,
    razon_social: texto(entrada.razonSocial, LIMITES.razonSocial),
    rfc: texto(entrada.rfc, LIMITES.rfc).toUpperCase(),
    domicilio_fiscal: texto(entrada.domicilioFiscal, LIMITES.domicilioFiscal),
    uso_cfdi: texto(entrada.usoCFDI, LIMITES.usoCFDI),
    forma_pago: texto(entrada.formaPago, LIMITES.formaPago),
    en_cobertura: Boolean(entrada.enCobertura),
    rutas_que_cubren: Array.isArray(entrada.rutasQueCubren) ? entrada.rutasQueCubren.slice(0, 10) : [],
  };

  // Sin base configurada la pantalla sigue siendo navegable (modo prototipo).
  if (!haySupabase()) return { ok: true, demo: true, folio: fila.folio };

  const { error } = await supabaseServidor().from("solicitudes_alta").insert(fila);
  if (error) {
    console.error("[alta] no se pudo guardar:", error.message);
    return { ok: false, motivo: "No se pudo guardar tu solicitud. Inténtalo de nuevo." };
  }

  // Los correos NO tumban el alta si fallan: ya quedó guardada, y perderla
  // por un problema del servicio de correo sería lo peor de los dos mundos.
  try {
    await correoAvisoAlta(fila);
  } catch (e) {
    console.error("[alta] aviso interno falló:", e?.message);
  }
  try {
    await correoAcuseAlta(fila);
  } catch (e) {
    console.error("[alta] acuse al cliente falló:", e?.message);
  }

  await registrar({
    accion: "alta_solicitada",
    tabla: "solicitudes_alta",
    registroId: fila.folio,
    detalle: { empresa, servicios_por_mes: servicios, en_cobertura: fila.en_cobertura },
  });

  return { ok: true, folio: fila.folio };
}
