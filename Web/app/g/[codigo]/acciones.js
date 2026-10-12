"use server";

import { supabaseServidor, haySupabase } from "@/lib/supabase";
import { ipDeLaPeticion } from "@/lib/freno";
import { registrar } from "@/lib/bitacora";
import { resolverEmergencia } from "@/lib/gafete-emergencia.mjs";
import { almacenPersonal, llavePersonal } from "@/lib/personal-almacen";

/**
 * NIVEL 2 DEL GAFETE: la ficha de emergencia, con el PIN impreso atrás.
 *
 * El orden de los candados (freno por IP, freno por gafete, mismo error para
 * todo) vive en lib/gafete-emergencia.mjs, con sus pruebas. Aquí solo se le
 * dan las piezas de verdad: el freno de la base (`pasar_freno`, db/022), el
 * almacén y la llave. Cada ficha que se abre queda en la bitácora: qué
 * gafete y cuándo, sin datos.
 */

/**
 * ¿Cabe otro intento? A diferencia de lib/freno.js, si la base falla NO deja
 * pasar: aquí el freno es lo único que impide probar el millón de PIN.
 */
async function cabe(clave, { maximo, minutos }) {
  if (!haySupabase()) return true; // modo prototipo: nada real que cuidar
  try {
    const { data, error } = await supabaseServidor().rpc("pasar_freno", {
      p_clave: clave, p_maximo: maximo, p_ventana: `${minutos} minutes`,
    });
    if (error) console.error("[gafete] el freno del PIN falló:", error.message);
    return !error && data === true;
  } catch (e) {
    console.error("[gafete] el freno del PIN falló:", e?.message || e);
    return false;
  }
}

export async function abrirEmergencia(codigo, pin) {
  const r = await resolverEmergencia({
    codigo,
    pin,
    ip: await ipDeLaPeticion(),
    cabe,
    buscar: (c) => almacenPersonal().gafetePorCodigo(c),
    llave: llavePersonal(),
  });
  if (!r.ok) return { ...r };
  await registrar({ accion: "gafete_emergencia", tabla: "gafetes", registroId: r.gafeteId });
  return { ok: true, ficha: r.ficha };
}
