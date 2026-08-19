"use client";

/**
 * Sesión del MODO CHOFER en la web.
 *
 * Es el mismo Supabase Auth que usan el panel y el portal; lo único distinto
 * es qué rol se acepta. Un chofer no entra al panel ni al portal, y al revés
 * tampoco.
 */

import { supabaseNavegador, haySupabaseNavegador } from "@/lib/supabase-navegador";

const LLAVE_DEMO = "morcast_chofer_sesion";

/** Acceso de demostración mientras no haya Supabase configurado. */
const CHOFER_DEMO = { correo: "chofer@demo.com", password: "chofer" };

function entrarDemo(correo, password) {
  const ok =
    correo.trim().toLowerCase() === CHOFER_DEMO.correo && password === CHOFER_DEMO.password;
  if (!ok) return { ok: false, mensaje: "Correo o contraseña incorrectos." };

  const sesion = { correo: CHOFER_DEMO.correo, nombre: "José Medina", demo: true };
  if (typeof window !== "undefined") {
    localStorage.setItem(LLAVE_DEMO, JSON.stringify(sesion));
  }
  return { ok: true, sesion };
}

function leerDemo() {
  if (typeof window === "undefined") return null;
  try {
    const crudo = localStorage.getItem(LLAVE_DEMO);
    return crudo ? JSON.parse(crudo) : null;
  } catch {
    return null;
  }
}

export async function iniciarSesionChofer(correo, password) {
  if (!haySupabaseNavegador()) return entrarDemo(correo, password);

  const supabase = supabaseNavegador();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: correo.trim().toLowerCase(),
    password,
  });

  if (error || !data?.user) {
    return { ok: false, mensaje: "Correo o contraseña incorrectos." };
  }

  const rol = data.user.app_metadata?.rol;
  if (rol !== "operador") {
    await supabase.auth.signOut();
    return {
      ok: false,
      mensaje:
        rol === "cliente"
          ? "Esta cuenta es de cliente. Entra por el Portal de Clientes."
          : "Esta cuenta no es de chofer.",
    };
  }

  return {
    ok: true,
    sesion: {
      correo: data.user.email,
      nombre: data.user.user_metadata?.nombre || data.user.email,
    },
  };
}

export async function obtenerSesionChofer() {
  if (!haySupabaseNavegador()) return leerDemo();

  const supabase = supabaseNavegador();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  if (user.app_metadata?.rol !== "operador") return null;

  return {
    id: user.id,
    correo: user.email,
    nombre: user.user_metadata?.nombre || user.email,
  };
}

export async function cerrarSesionChofer() {
  if (typeof window !== "undefined") localStorage.removeItem(LLAVE_DEMO);
  if (haySupabaseNavegador()) await supabaseNavegador().auth.signOut();
}
