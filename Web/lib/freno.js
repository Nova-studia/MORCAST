import { headers } from "next/headers";
import { supabaseServidor, haySupabase } from "./supabase";

/**
 * FRENO PARA LOS FORMULARIOS PÚBLICOS (cotizar, registro).
 *
 * El límite que había vivía en la memoria del proceso (`new Map()`), y en
 * Vercel cada instancia tiene la suya: un bot que pegara a varias a la vez
 * pasaba sin freno. Este cuenta en la base (`pasar_freno`, db/022), en una
 * sola sentencia, así que vale para todas las instancias.
 *
 * Si la base falla —o la migración 022 todavía no se corre— DEJA PASAR y lo
 * anota: un formulario de clientes caído por culpa del freno es peor que un
 * spam de más.
 */

/** La IP de quien manda el formulario, como la ve Vercel. */
export async function ipDeLaPeticion() {
  const cabeceras = await headers();
  return (
    cabeceras.get("x-forwarded-for")?.split(",")[0].trim() ||
    cabeceras.get("x-real-ip") ||
    "desconocida"
  );
}

/**
 * ¿Puede pasar otra vez esta IP por este formulario?
 * @param {string} formulario  nombre corto: "cotizar", "alta"…
 * @param {{ maximo: number, minutos: number }} limite
 */
export async function pasarFreno(formulario, { maximo, minutos }) {
  if (!haySupabase()) return true;
  const ip = await ipDeLaPeticion();
  try {
    const { data, error } = await supabaseServidor().rpc("pasar_freno", {
      p_clave: `${formulario}:${ip}`,
      p_maximo: maximo,
      p_ventana: `${minutos} minutes`,
    });
    if (error) {
      console.error(`[freno] ${formulario}: no se pudo consultar, se deja pasar —`, error.message);
      return true;
    }
    return data !== false;
  } catch (e) {
    console.error(`[freno] ${formulario}: no se pudo consultar, se deja pasar —`, e?.message || e);
    return true;
  }
}
