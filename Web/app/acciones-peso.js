"use server";

import { supabaseSesion, usuarioActual } from "@/lib/supabase-sesion";
import { registrar } from "@/lib/bitacora";
import { haySupabase } from "@/lib/supabase";
import { leerKg, cambiosDeRecolecciones } from "@/lib/peso.mjs";

/**
 * PESO REAL: los viajes al relleno y el peso real de una recolección.
 *
 * Mismo molde que `acciones-auditadas.js`, y por las mismas razones:
 *
 * 1. El rol se comprueba AQUÍ, en el servidor. Una acción de servidor es un
 *    endpoint al que se le puede hacer POST a mano; esconder el botón no
 *    protege nada.
 * 2. Las escrituras van con la SESIÓN del usuario, no con la llave de
 *    servicio: el RLS (viajes_personal, recolecciones_personal) y el
 *    disparador `peso_real_solo_personal` de db/023 siguen siendo el guardia.
 * 3. Se cuentan las filas que devuelve cada UPDATE. Uno bloqueado por RLS no
 *    da error: cambia cero filas y responde 200.
 * 4. Queda en la bitácora quién puso qué peso. El peso real es la base del
 *    cobro por tonelada; cuando un cliente reclame, esto es lo que contesta.
 */

const PERSONAL = ["dueno", "admin"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function exigirPersonal() {
  const quien = await usuarioActual();
  if (!quien) return { error: "Tu sesión se venció. Vuelve a entrar." };
  // `sin-verificar` (le falta el código del correo) cae aquí también: no
  // está en la lista.
  if (!PERSONAL.includes(quien.rol)) return { error: "No tienes permiso para esto." };
  return { quien };
}

/** AAAA-MM-DD que de verdad existe. */
function fechaValida(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return false;
  const [a, m, d] = iso.split("-").map(Number);
  const f = new Date(Date.UTC(a, m - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
}

/** Texto libre recortado; vacío → null para no guardar cadenas vacías. */
function texto(v, max) {
  const t = String(v ?? "").trim().slice(0, max);
  return t || null;
}

/**
 * Registra o edita un viaje al relleno, con las recolecciones que iban en él.
 *
 * @param {{id?: string, fecha: string, unidadId?: string, operadorId?: string,
 *          pesoRealKg: string|number, folioTicket?: string, notas?: string,
 *          recoleccionIds?: string[]}} datos
 * @returns {{ok: boolean, id?: string, motivo?: string, aviso?: string}}
 */
export async function guardarViaje(datos = {}) {
  if (!haySupabase()) return { ok: true, demo: true };

  const { error: sinPermiso } = await exigirPersonal();
  if (sinPermiso) return { ok: false, motivo: sinPermiso };

  // Todo se valida otra vez aquí aunque la pantalla ya lo haga: lo que llega
  // a una acción de servidor puede no venir de la pantalla.
  if (!fechaValida(datos.fecha)) return { ok: false, motivo: "La fecha del viaje no es válida." };
  const peso = leerKg(datos.pesoRealKg);
  if (peso.error) return { ok: false, motivo: peso.error };
  if (datos.id && !UUID.test(datos.id)) return { ok: false, motivo: "Ese viaje no existe." };
  const unidadId = datos.unidadId || null;
  const operadorId = datos.operadorId || null;
  if ((unidadId && !UUID.test(unidadId)) || (operadorId && !UUID.test(operadorId))) {
    return { ok: false, motivo: "La unidad o el chofer no son válidos." };
  }
  const elegidas = [...new Set(Array.isArray(datos.recoleccionIds) ? datos.recoleccionIds : [])];
  if (elegidas.length > 300 || elegidas.some((id) => !UUID.test(String(id)))) {
    return { ok: false, motivo: "La lista de recolecciones no es válida." };
  }

  const fila = {
    fecha: datos.fecha,
    unidad_id: unidadId,
    operador_id: operadorId,
    peso_real_kg: peso.kg,
    folio_ticket: texto(datos.folioTicket, 60),
    notas: texto(datos.notas, 1000),
  };

  const supabase = await supabaseSesion();
  const nuevo = !datos.id;
  let id = datos.id;

  if (nuevo) {
    const { data, error } = await supabase.from("viajes_relleno").insert(fila).select("id");
    if (error) return { ok: false, motivo: error.message };
    if (!data?.length) return { ok: false, motivo: "No se guardó: la base no te deja registrar viajes." };
    id = data[0].id;
  } else {
    const { data, error } = await supabase.from("viajes_relleno").update(fila).eq("id", id).select("id");
    if (error) return { ok: false, motivo: error.message };
    if (!data?.length) {
      return { ok: false, motivo: "No se cambió nada: ese viaje ya no existe o la base no te deja editarlo." };
    }
  }

  // Las recolecciones: solo se toca lo que cambió.
  const { data: actualesFilas, error: errorActuales } = await supabase
    .from("recolecciones").select("id").eq("viaje_id", id);
  if (errorActuales) {
    return { ok: true, id, aviso: `El viaje se guardó, pero no se pudieron leer sus recolecciones: ${errorActuales.message}` };
  }
  const { agregar, quitar } = cambiosDeRecolecciones((actualesFilas || []).map((r) => r.id), elegidas);

  let quitadas = 0;
  let agregadas = 0;
  const problemas = [];

  if (quitar.length) {
    const { data, error } = await supabase
      .from("recolecciones").update({ viaje_id: null })
      .in("id", quitar).eq("viaje_id", id).select("id");
    if (error) problemas.push(`no se pudieron soltar ${quitar.length}: ${error.message}`);
    quitadas = data?.length || 0;
  }
  if (agregar.length) {
    // `viaje_id is null` a propósito: una recolección que ya va en OTRO viaje
    // no se le quita en silencio. Habría que soltarla primero desde ese viaje,
    // que es lo que la pantalla le pide a quien lo intente.
    const { data, error } = await supabase
      .from("recolecciones").update({ viaje_id: id })
      .in("id", agregar).is("viaje_id", null).select("id");
    if (error) problemas.push(`no se pudieron amarrar ${agregar.length}: ${error.message}`);
    agregadas = data?.length || 0;
    const faltan = agregar.length - agregadas;
    if (!error && faltan > 0) {
      problemas.push(`${faltan} recolección(es) no se amarraron porque ya van en otro viaje`);
    }
  }

  await registrar({
    accion: nuevo ? "registrar_viaje_relleno" : "editar_viaje_relleno",
    tabla: "viajes_relleno",
    registroId: id,
    detalle: {
      fecha: fila.fecha,
      peso_real_kg: fila.peso_real_kg,
      folio_ticket: fila.folio_ticket,
      unidad_id: fila.unidad_id,
      operador_id: fila.operador_id,
      recolecciones_agregadas: agregadas,
      recolecciones_quitadas: quitadas,
    },
  });

  return problemas.length
    ? { ok: true, id, aviso: `El viaje se guardó, pero ${problemas.join("; ")}.` }
    : { ok: true, id };
}

/**
 * Guarda en el viaje la ruta de la foto del ticket ya subida a la cubeta.
 *
 * La foto la sube el navegador (lib/datos-viajes.js → subirTicket). Aquí se
 * comprueba que la ruta sea de la carpeta de ESTE viaje: sin eso, se podría
 * colgar de un viaje el ticket de otro.
 */
export async function fijarFotoTicket(viajeId, ruta) {
  if (!haySupabase()) return { ok: true, demo: true };

  const { error: sinPermiso } = await exigirPersonal();
  if (sinPermiso) return { ok: false, motivo: sinPermiso };

  const r = String(ruta || "");
  if (!UUID.test(String(viajeId || "")) || !r.startsWith(`${viajeId}/`) || r.includes("..") || r.length > 300) {
    return { ok: false, motivo: "La foto no corresponde a ese viaje." };
  }

  const supabase = await supabaseSesion();
  const { data, error } = await supabase
    .from("viajes_relleno").update({ foto_ticket: r }).eq("id", viajeId).select("id");
  if (error) return { ok: false, motivo: error.message };
  if (!data?.length) return { ok: false, motivo: "No se guardó la foto: la base no te deja tocar ese viaje." };

  await registrar({
    accion: "subir_ticket_viaje",
    tabla: "viajes_relleno",
    registroId: viajeId,
    detalle: { foto_ticket: r },
  });
  return { ok: true };
}

/**
 * Borra un viaje mal capturado. Sus recolecciones quedan sueltas (la llave
 * es `on delete set null`) y vuelven a contar con su propio peso. La foto
 * del ticket se queda en la cubeta como respaldo.
 */
export async function borrarViaje(viajeId) {
  if (!haySupabase()) return { ok: true, demo: true };

  const { error: sinPermiso } = await exigirPersonal();
  if (sinPermiso) return { ok: false, motivo: sinPermiso };
  if (!UUID.test(String(viajeId || ""))) return { ok: false, motivo: "Ese viaje no existe." };

  const supabase = await supabaseSesion();
  const { data, error } = await supabase
    .from("viajes_relleno").delete().eq("id", viajeId)
    .select("id, fecha, peso_real_kg, folio_ticket");
  if (error) return { ok: false, motivo: error.message };
  if (!data?.length) return { ok: false, motivo: "No se borró: ese viaje ya no existe o la base no te deja." };

  await registrar({
    accion: "borrar_viaje_relleno",
    tabla: "viajes_relleno",
    registroId: viajeId,
    detalle: {
      fecha: data[0].fecha,
      peso_real_kg: Number(data[0].peso_real_kg),
      folio_ticket: data[0].folio_ticket,
    },
  });
  return { ok: true };
}

/**
 * Pone (o quita, con `kg` vacío) el peso real de UNA recolección.
 *
 * Es el "por si acaso" de los dueños: cuando el viaje lleva un solo
 * contenedor (roll-off) el ticket del viaje ES el de la recolección. Quién y
 * cuándo se guardan en la propia fila (`peso_real_por`, `peso_real_en`) y en
 * la bitácora, con el valor de antes.
 */
export async function ponerPesoRealRecoleccion(recoleccionId, kg) {
  if (!haySupabase()) return { ok: true, demo: true };

  const { quien, error: sinPermiso } = await exigirPersonal();
  if (sinPermiso) return { ok: false, motivo: sinPermiso };
  if (!UUID.test(String(recoleccionId || ""))) return { ok: false, motivo: "Esa recolección no existe." };

  const quitar = kg === null || kg === undefined || String(kg).trim() === "";
  let valor = null;
  if (!quitar) {
    const p = leerKg(kg);
    if (p.error) return { ok: false, motivo: p.error };
    valor = p.kg;
  }

  const supabase = await supabaseSesion();
  const { data: antes } = await supabase
    .from("recolecciones")
    .select("peso_real_kg, viaje_id, solicitudes_recoleccion ( folio )")
    .eq("id", recoleccionId)
    .maybeSingle();

  const en = quitar ? null : new Date().toISOString();
  const { data, error } = await supabase
    .from("recolecciones")
    .update({ peso_real_kg: valor, peso_real_por: quitar ? null : quien.id, peso_real_en: en })
    .eq("id", recoleccionId)
    .select("id");
  if (error) return { ok: false, motivo: error.message };
  if (!data?.length) return { ok: false, motivo: "No se guardó: la base no te deja tocar esa recolección." };

  await registrar({
    accion: quitar ? "quitar_peso_real" : "poner_peso_real",
    tabla: "recolecciones",
    registroId: recoleccionId,
    detalle: {
      folio: antes?.solicitudes_recoleccion?.folio || null,
      antes_kg: antes?.peso_real_kg != null ? Number(antes.peso_real_kg) : null,
      despues_kg: valor,
      viaje_id: antes?.viaje_id || null,
    },
  });
  return { ok: true, kg: valor, en };
}
