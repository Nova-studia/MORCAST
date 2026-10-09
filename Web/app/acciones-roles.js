"use server";

import { supabaseSesion } from "@/lib/supabase-sesion";
import { haySupabase } from "@/lib/supabase";
import { exigirSeccion } from "@/lib/permisos-servidor";
import { registrar } from "@/lib/bitacora";
import { validarRol } from "@/lib/permisos.mjs";

/**
 * ROLES PERSONALIZADOS (Entrega 2, 9-oct-2026): solo el dueño los crea,
 * cambia y borra. Va con la SESIÓN, no con la llave de servicio: la base
 * (db/029, `roles_dueno`) tampoco deja a nadie más, así que hay dos candados.
 */

async function exigirDueno() {
  const { quien, error } = await exigirSeccion(null);
  if (error) return { error };
  if (quien.rol !== "dueno") return { error: "Solo el dueño crea y cambia roles." };
  return { quien, sb: await supabaseSesion() };
}

const demo = { ok: true, demo: true };

export async function crearRolAccion(datos) {
  if (!haySupabase()) return demo;
  const { quien, sb, error } = await exigirDueno();
  if (error) return { ok: false, motivo: error };
  const v = validarRol(datos);
  if (!v.ok) return v;
  const { data, error: e } = await sb.from("roles").insert({ ...v.limpio, creado_por: quien.id }).select("id").single();
  if (e) return { ok: false, motivo: /duplicate|unique/i.test(e.message) ? "Ya hay un rol con ese nombre." : e.message };
  await registrar({ accion: "rol_creado", tabla: "roles", registroId: data.id, detalle: v.limpio });
  return { ok: true, id: data.id };
}

export async function editarRolAccion({ id, ...datos } = {}) {
  if (!haySupabase()) return demo;
  const { sb, error } = await exigirDueno();
  if (error) return { ok: false, motivo: error };
  const v = validarRol(datos);
  if (!v.ok) return v;
  const { data, error: e } = await sb.from("roles").update(v.limpio).eq("id", id).select("id");
  if (e) return { ok: false, motivo: /duplicate|unique/i.test(e.message) ? "Ya hay un rol con ese nombre." : e.message };
  if (!data?.length) return { ok: false, motivo: "Ese rol ya no existe." };
  await registrar({ accion: "rol_cambiado", tabla: "roles", registroId: id, detalle: v.limpio });
  return { ok: true };
}

/** Quien tenía este rol se queda SIN rol: solo puede ver, no cambiar nada. */
export async function borrarRolAccion({ id } = {}) {
  if (!haySupabase()) return demo;
  const { sb, error } = await exigirDueno();
  if (error) return { ok: false, motivo: error };
  const { data, error: e } = await sb.from("roles").delete().eq("id", id).select("id, nombre");
  if (e) return { ok: false, motivo: e.message };
  if (!data?.length) return { ok: false, motivo: "Ese rol ya no existe." };
  await registrar({ accion: "rol_borrado", tabla: "roles", registroId: id, detalle: { nombre: data[0].nombre } });
  return { ok: true };
}
