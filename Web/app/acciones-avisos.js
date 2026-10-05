"use server";

import { supabaseSesion, usuarioActual } from "@/lib/supabase-sesion";
import { haySupabase, supabaseServidor } from "@/lib/supabase";
import { registrar } from "@/lib/bitacora";
import { hayResend, correoAvisoCliente } from "@/lib/correo";
import {
  validarAviso,
  validarAlcance,
  filaAviso,
  calcularDestinatarios,
  resumenDestinatarios,
  hoyMatamoros,
} from "@/lib/avisos.mjs";

/**
 * AVISOS A CLIENTES (/admin/avisos): mandar un aviso por correo y al portal.
 *
 * Por qué va en el servidor
 * -------------------------
 * 1. Para saber A QUIÉN le llega hay que leer los correos de todas las
 *    empresas del alcance, y eso se hace con la llave de servicio, que salta
 *    el RLS. Por eso lo primero es leer de la SESIÓN quién llama y pedir que
 *    sea dueño o administrador; la llave no se toca antes.
 * 2. Los correos salen de aquí (Resend) y la bitácora se escribe aquí: desde
 *    el navegador, quien firma el aviso sería quien dijera el navegador.
 *
 * El aviso en sí se INSERTA con la sesión, no con la llave: el RLS
 * (`avisos_personal`, db/023) sigue siendo el guardia, y `enviado_por` sale
 * solo de `auth.uid()`.
 *
 * Las reglas (qué se acepta, a quién le toca) viven en lib/avisos.mjs, con
 * pruebas; aquí solo se juntan los datos y se llama.
 */

const PERSONAL = ["dueno", "admin"];

/**
 * Pausa entre un correo y el siguiente.
 *
 * Resend acepta 2 envíos por segundo por omisión; si se le mandan 40 de
 * golpe, contesta 429 a casi todos y el aviso "se mandó" a cinco empresas.
 * A ~1.8 por segundo, 43 clientes (la operación real de hoy) tardan unos 24
 * segundos, por eso la página sube su tiempo máximo (avisos/page.js).
 */
const PAUSA_ENTRE_CORREOS_MS = 550;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/** Igual que en acciones-auditadas.js: `sin-verificar` (sin el segundo paso) no pasa. */
async function exigirPersonal() {
  const quien = await usuarioActual();
  if (!quien) return { error: "Tu sesión se venció. Vuelve a entrar." };
  if (!PERSONAL.includes(quien.rol)) return { error: "No tienes permiso para esto." };
  return { quien };
}

/**
 * Las filas que necesita `calcularDestinatarios`, solo las del alcance.
 *
 * Los clientes se piden todos (son decenas, no miles) para que el filtro de
 * estado viva en un solo lugar: lib/avisos.mjs. Domicilios y suscripciones
 * sí van filtrados por el sector o la ruta en la propia consulta.
 */
async function filasDelAlcance(limpio) {
  const sb = supabaseServidor();
  let clientes = sb.from("clientes").select("id, empresa, correo, estado");
  if (limpio.alcance === "cliente") clientes = clientes.eq("id", limpio.clienteId);

  const [c, d, s] = await Promise.all([
    clientes,
    limpio.alcance === "sector"
      ? sb.from("domicilios").select("cliente_id, sector_id").eq("sector_id", limpio.sectorId)
      : { data: [] },
    limpio.alcance === "ruta"
      ? sb.from("suscripciones").select("cliente_id, ruta_id, estado").eq("ruta_id", limpio.rutaId)
      : { data: [] },
  ]);

  const error = c.error || d.error || s.error;
  if (error) throw new Error(error.message);
  return { clientes: c.data || [], domicilios: d.data || [], suscripciones: s.data || [] };
}

/**
 * Vista previa: a cuántos clientes y correos les llegaría, ANTES de mandar.
 * No escribe nada.
 */
export async function contarDestinatarios(datos) {
  if (!haySupabase()) return { ok: true, demo: true };

  const { error: sinPermiso } = await exigirPersonal();
  if (sinPermiso) return { ok: false, motivo: sinPermiso };

  const v = validarAlcance(datos, { exigirUuid: true });
  if (!v.ok) return { ok: false, motivo: v.motivo };

  try {
    const d = calcularDestinatarios(v.limpio, await filasDelAlcance(v.limpio));
    return { ok: true, resumen: resumenDestinatarios(d) };
  } catch (e) {
    console.error("[avisos] no se pudo contar destinatarios:", e?.message);
    return { ok: false, motivo: "No se pudo calcular a quién le llega. Vuelve a intentarlo." };
  }
}

/** Un correo, con un reintento si Resend dice que vamos muy rápido. */
async function mandarUno(destino, limpio) {
  const datos = {
    correo: destino.correo,
    empresa: destino.empresa,
    titulo: limpio.titulo,
    mensaje: limpio.mensaje,
    motivo: limpio.motivo,
    vigenteHasta: limpio.vigenteHasta,
  };
  try {
    await correoAvisoCliente(datos);
    return true;
  } catch (e) {
    if (/Resend 429/.test(e?.message || "")) {
      await espera(1200);
      try {
        await correoAvisoCliente(datos);
        return true;
      } catch (e2) {
        console.error(`[avisos] no salió el correo a ${destino.correo}:`, e2?.message);
        return false;
      }
    }
    console.error(`[avisos] no salió el correo a ${destino.correo}:`, e?.message);
    return false;
  }
}

/**
 * Manda un aviso: lo guarda (el portal lo enseña desde ese momento) y le
 * escribe a cada empresa del alcance que tenga correo.
 *
 * Tolerante a fallos a propósito: si el correo de una empresa rebota, las
 * demás siguen y se cuenta. El aviso ya quedó en el portal de todas, así que
 * un correo que falla no deja a nadie sin enterarse; deja a la
 * administración sabiendo a quién hay que llamar.
 */
export async function enviarAviso(datos) {
  if (!haySupabase()) return { ok: true, demo: true };

  const { error: sinPermiso } = await exigirPersonal();
  if (sinPermiso) return { ok: false, motivo: sinPermiso };

  const v = validarAviso(datos, { hoy: hoyMatamoros(), exigirUuid: true });
  if (!v.ok) return { ok: false, motivo: v.motivo };
  const limpio = v.limpio;

  // Primero a quién, después guardar: si no se puede saber a quién le toca,
  // es mejor no dejar un aviso a medias que nadie sabe a cuántos llegó.
  let dest;
  try {
    dest = calcularDestinatarios(limpio, await filasDelAlcance(limpio));
  } catch (e) {
    console.error("[avisos] no se pudo calcular destinatarios:", e?.message);
    return { ok: false, motivo: "No se pudo calcular a quién le llega. No se mandó nada." };
  }

  const supabase = await supabaseSesion();
  const { data: aviso, error } = await supabase
    .from("avisos")
    .insert(filaAviso(limpio))
    .select("id, creado")
    .single();
  if (error || !aviso) {
    console.error("[avisos] no se pudo guardar:", error?.message);
    return { ok: false, motivo: "No se pudo guardar el aviso. No se mandó ningún correo." };
  }

  let enviados = 0;
  const fallidos = [];
  const sinResend = !hayResend();
  if (sinResend) {
    // Mismo criterio que acciones-auditadas.js: sin la llave el sitio sigue,
    // pero se anota en el log y se le DICE a quien mandó el aviso.
    console.warn("[avisos] no se mandaron correos: falta RESEND_API_KEY");
  } else {
    for (let i = 0; i < dest.correos.length; i++) {
      if (i > 0) await espera(PAUSA_ENTRE_CORREOS_MS);
      if (await mandarUno(dest.correos[i], limpio)) enviados++;
      else fallidos.push(dest.correos[i].empresa || dest.correos[i].correo);
    }
  }

  // Se cuenta lo devuelto: un UPDATE que el RLS bloquea no da error, cambia
  // cero filas y responde 200. Aquí no tumba nada (los correos ya salieron),
  // pero el historial diría "0 correos" y hay que saber por qué.
  const { data: act, error: errAct } = await supabase
    .from("avisos")
    .update({ correos_enviados: enviados })
    .eq("id", aviso.id)
    .select("id");
  if (errAct || !act?.length) {
    console.error("[avisos] no se guardó el conteo de correos:", errAct?.message || "0 filas");
  }

  const resumen = resumenDestinatarios(dest);
  await registrar({
    accion: "enviar_aviso",
    tabla: "avisos",
    registroId: aviso.id,
    detalle: {
      titulo: limpio.titulo,
      motivo: limpio.motivo,
      alcance: limpio.alcance,
      sector_id: limpio.sectorId,
      ruta_id: limpio.rutaId,
      cliente_id: limpio.clienteId,
      clientes: resumen.clientes,
      correos_enviados: enviados,
      correos_fallidos: fallidos.length,
      sin_correo: resumen.sinCorreo,
      sin_resend: sinResend || undefined,
    },
  });

  return {
    ok: true,
    id: aviso.id,
    creado: aviso.creado,
    resumen,
    enviados,
    fallidos,
    sinResend,
  };
}
