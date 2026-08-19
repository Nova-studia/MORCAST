"use client";

/**
 * Sesión del PANEL DE ADMINISTRACIÓN.
 *
 * Va contra Supabase Auth. La sesión vive en cookies (las escribe
 * `@supabase/ssr`), no en localStorage, para que el servidor también pueda
 * leerla y proteger las páginas antes de mandarlas — eso lo hace `proxy.js`.
 *
 * MODO DEMOSTRACIÓN: mientras no existan las variables de Supabase, se
 * mantiene el acceso de ejemplo para que el sitio siga navegable. En cuanto
 * se configuren, ese camino queda muerto solo.
 */

import { supabaseNavegador, haySupabaseNavegador } from "@/lib/supabase-navegador";
import { ADMIN_DEMO, ADMIN_PERFIL } from "@/lib/admin-datos";

const LLAVE_DEMO = "morcast_admin_sesion";

/** Roles que pueden entrar al panel. Un cliente NO entra aquí. */
const ROLES_PANEL = ["dueno", "admin"];

const NOMBRE_ROL = {
  dueno: "Dueño",
  admin: "Administrador",
};

/* ------------------------------------------------------------------ */
/* Modo demostración (sin Supabase)                                    */
/* ------------------------------------------------------------------ */

function entrarDemo(correo, password) {
  const ok =
    correo.trim().toLowerCase() === ADMIN_DEMO.correo &&
    password === ADMIN_DEMO.password;
  if (!ok) return { ok: false, mensaje: "Correo o contraseña incorrectos." };

  const sesion = {
    correo: ADMIN_PERFIL.correo,
    nombre: ADMIN_PERFIL.nombre,
    rol: ADMIN_PERFIL.rol,
    demo: true,
  };
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

/* ------------------------------------------------------------------ */
/* Supabase                                                            */
/* ------------------------------------------------------------------ */

/**
 * Inicia sesión. Devuelve `{ ok: true, sesion }` o `{ ok: false, mensaje }`.
 *
 * Se distingue "no eres tú" de "no tienes acceso a esta puerta": el cliente
 * que se equivoca de pantalla merece que se lo digan, no un "contraseña
 * incorrecta" que lo deje dando vueltas.
 */
export async function iniciarSesionAdmin(correo, password) {
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
  if (!ROLES_PANEL.includes(rol)) {
    // Credenciales buenas, puerta equivocada. Se cierra la sesión para no
    // dejarla a medias en el navegador.
    await supabase.auth.signOut();
    return {
      ok: false,
      mensaje:
        rol === "cliente"
          ? "Esta cuenta es de cliente. Entra por el Portal de Clientes."
          : "Esta cuenta todavía no tiene acceso al panel.",
    };
  }

  return {
    ok: true,
    sesion: {
      correo: data.user.email,
      nombre: data.user.user_metadata?.nombre || data.user.email,
      rol: NOMBRE_ROL[rol] || rol,
      rolId: rol,
    },
  };
}

/** Sesión activa del panel, o null. */
export async function obtenerSesionAdmin() {
  if (!haySupabaseNavegador()) return leerDemo();

  const supabase = supabaseNavegador();

  // Siempre getUser(), nunca getSession(): el segundo cree lo que diga la
  // cookie; el primero lo comprueba contra el servidor. Para decidir
  // permisos, solo sirve el primero.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const rol = user.app_metadata?.rol;
  if (!ROLES_PANEL.includes(rol)) return null;

  return {
    correo: user.email,
    nombre: user.user_metadata?.nombre || user.email,
    rol: NOMBRE_ROL[rol] || rol,
    rolId: rol,
  };
}

/** Cierra la sesión. */
export async function cerrarSesionAdmin() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(LLAVE_DEMO);
  }
  if (haySupabaseNavegador()) {
    await supabaseNavegador().auth.signOut();
  }
}
