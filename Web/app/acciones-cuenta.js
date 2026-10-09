"use server";

import { createClient } from "@supabase/supabase-js";
import { usuarioActual, supabaseSesion } from "@/lib/supabase-sesion";
import { supabaseServidor, haySupabase } from "@/lib/supabase";
import { registrar } from "@/lib/bitacora";
import { correoContrasenaCambiada } from "@/lib/correo";
import { validarEdicionUsuario } from "@/lib/equipo.mjs";
import { cambiarContrasenaCon } from "@/lib/mi-cuenta.mjs";
import { pasarFreno } from "@/lib/freno";

/**
 * MI CUENTA (Entrega 2, 9-oct-2026): personal y choferes. Cada quien SOLO
 * lo suyo: el id sale de la sesión, nunca de un parámetro.
 */

const PUEDEN = ["dueno", "admin", "operador"];

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
  const { data } = await (await supabaseSesion()).from("perfiles").select("nombre, telefono").eq("id", quien.id).maybeSingle();
  return { ok: true, nombre: data?.nombre || "", telefono: data?.telefono || "", correo: quien.correo };
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
  if (!(await pasarFreno(`mi-contrasena:${quien.id}`, { maximo: 5, minutos: 15 }))) {
    return { ok: false, motivo: "Demasiados intentos. Espera 15 minutos." };
  }

  const r = await cambiarContrasenaCon(
    {
      comprobar: async (correo, clave) => {
        const prueba = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data, error: e } = await prueba.auth.signInWithPassword({ email: correo, password: clave });
        if (e || data?.user?.id !== quien.id) return false;
        await prueba.auth.signOut({ scope: "local" });
        return true;
      },
      guardar: async (uid, clave) => {
        const { error: e } = await supabaseServidor().auth.admin.updateUserById(uid, { password: clave });
        if (e) throw new Error(e.message);
      },
      avisar: async () => {
        try { await correoContrasenaCambiada({ correo: quien.correo }); } catch (e) {
          console.error("[mi-cuenta] no se pudo avisar:", e?.message);
        }
      },
    },
    { correo: quien.correo, uid: quien.id, actual, nueva, repetir }
  );
  if (r.ok) await registrar({ accion: "mi_contrasena", tabla: "perfiles", registroId: quien.id, detalle: {} });
  return r;
}
