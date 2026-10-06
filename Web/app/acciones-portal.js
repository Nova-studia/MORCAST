"use server";

import { haySupabase, supabaseServidor } from "@/lib/supabase";
import { usuarioActual } from "@/lib/supabase-sesion";
import { choferesDelCliente } from "@/lib/choferes-servicios";

/**
 * Lo que el PORTAL DE CLIENTES necesita del servidor porque el RLS no se lo
 * deja leer desde el navegador (6-oct-2026).
 *
 * `choferesDeMisServicios`: quién es el chofer de cada servicio del cliente
 * con sesión. El historial decía el del texto libre de la ruta, no el que
 * hizo la recolección. El cliente sale de la SESIÓN (cookie), nunca de un
 * parámetro: con la llave de servicio, ese filtro es el que separa a un
 * cliente de otro. Mismo código que la app (`/api/app/mis-choferes`).
 *
 * @returns {Promise<{ok: true, choferes: object} | {ok: false, motivo: string}>}
 */
export async function choferesDeMisServicios() {
  if (!haySupabase()) return { ok: false, motivo: "Sin base de datos." };
  const quien = await usuarioActual();
  if (!quien) return { ok: false, motivo: "Tu sesión se venció. Vuelve a entrar." };
  if (quien.rol !== "cliente") return { ok: false, motivo: "Esto es solo para clientes." };
  return choferesDelCliente(supabaseServidor(), quien.cliente_id || null);
}
