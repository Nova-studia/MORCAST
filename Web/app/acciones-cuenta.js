"use server";

import { usuarioActual, supabaseSesion } from "@/lib/supabase-sesion";
import { supabaseServidor, haySupabase } from "@/lib/supabase";
import { registrar } from "@/lib/bitacora";
import { validarEdicionUsuario } from "@/lib/equipo.mjs";
import { validarCambioContrasena } from "@/lib/mi-cuenta.mjs";
import { pasarFreno } from "@/lib/freno";
import { cambiarContrasenaServidor } from "@/lib/apps-servidor";

/**
 * MI CUENTA (Entrega 2, 9-oct-2026): personal y choferes. Cada quien SOLO
 * lo suyo: el id sale de la sesión, nunca de un parámetro.
 */

// El cliente también (Entrega 4): su nombre, teléfono y contraseña.
const PUEDEN = ["dueno", "admin", "operador", "cliente"];

async function yo() {
  const quien = await usuarioActual();
  if (!quien) return { error: "Tu sesión se venció. Vuelve a entrar." };
  if (!PUEDEN.includes(quien.rol)) return { error: "No tienes permiso para esto." };
  return { quien };
}

export async function miCuentaAccion() {
  if (!haySupabase()) return { ok: true, demo: true, nombre: "Demostración", telefono: "", correo: "demo@morcast.mx" };
  const { quien, error } = await yo();
  if (error) return { ok: false, motivo: error };
  const sb = await supabaseSesion();
  const [{ data }, { data: { user } }] = await Promise.all([
    sb.from("perfiles").select("nombre, telefono").eq("id", quien.id).maybeSingle(),
    sb.auth.getUser(),
  ]);
  // Quien entra solo con Google no tiene contraseña que cambiar (Entrega 4).
  const proveedores = user?.app_metadata?.providers || [user?.app_metadata?.provider].filter(Boolean);
  const tieneContrasena = proveedores.length === 0 || proveedores.includes("email");
  return { ok: true, nombre: data?.nombre || "", telefono: data?.telefono || "", correo: quien.correo, tieneContrasena };
}

export async function guardarMiCuentaAccion({ nombre, telefono } = {}) {
  if (!haySupabase()) return { ok: true, demo: true };
  const { quien, error } = await yo();
  if (error) return { ok: false, motivo: error };
  const v = validarEdicionUsuario({ nombre, telefono });
  if (!v.ok) return v;
  const sb = await supabaseSesion();
  // perfiles_edita_el_suyo (db/002); el disparador de la 022 impide tocar rol,
  // empresa o estado aunque alguien lo intente desde aquí.
  const { data, error: e } = await sb.from("perfiles")
    .update({ nombre: v.limpio.nombre, telefono: v.limpio.telefono }).eq("id", quien.id).select("id");
  if (e || !data?.length) return { ok: false, motivo: `No se guardó: ${e?.message || "ninguna fila"}` };
  // El nombre que se ve arriba en el panel sale de Auth.
  await sb.auth.updateUser({ data: { nombre: v.limpio.nombre } });
  await registrar({ accion: "mi_cuenta", tabla: "perfiles", registroId: quien.id, detalle: v.limpio });
  return { ok: true };
}

/**
 * Cambiar la contraseña con la ACTUAL. La actual se comprueba con un cliente
 * aparte, sin cookies (no toca la sesión abierta ni el segundo paso del
 * panel), y esa sesión de prueba se cierra en seguida.
 */
export async function cambiarMiContrasenaAccion({ actual, nueva, repetir } = {}) {
  if (!haySupabase()) return { ok: true, demo: true };
  const { quien, error } = await yo();
  if (error) return { ok: false, motivo: error };
  // Primero lo que no cuesta un intento (dedos torpes en "repetir")…
  const v = validarCambioContrasena({ actual, nueva, repetir });
  if (!v.ok) return v;
  // …y el freno por USUARIO, no por IP: con una sesión robada se cambia de IP.
  if (!(await pasarFreno(`mi-contrasena:${quien.id}`, { maximo: 5, minutos: 15, porIp: false }))) {
    return { ok: false, motivo: "Demasiados intentos. Espera 15 minutos." };
  }
  const { data: { session } } = await (await supabaseSesion()).auth.getSession();
  // El trabajo vive en lib/apps-servidor.js: el mismo que usa la app.
  return cambiarContrasenaServidor(
    { sbServicio: supabaseServidor(), uid: quien.id, correo: quien.correo, token: session?.access_token, anotar: registrar },
    { actual, nueva, repetir }
  );
}
