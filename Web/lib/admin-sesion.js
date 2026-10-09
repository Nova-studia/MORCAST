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
import { leerPermisos, puede } from "@/lib/permisos.mjs";

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
      rolId: rol,
      uid: data.user.id,
      ...(await datosDeRol(supabase, data.user.id, rol)),
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
    rolId: rol,
    uid: user.id,
    ...(await datosDeRol(supabase, user.id, rol)),
  };
}

/**
 * Rol y permisos efectivos de la cuenta: los de su rol (db/029) más los
 * sueltos (db/027). Solo sirven para PINTAR el menú y los botones: quien
 * decide de verdad es la base y las acciones del servidor.
 */
async function datosDeRol(supabase, id, rol) {
  const p = await leerPermisos(supabase, id);
  return {
    // Un admin con rol personalizado se presenta con él ("Caja").
    rol: (rol === "admin" && p.rolNombre) || NOMBRE_ROL[rol] || rol,
    permisos: p.permisos,
  };
}

/** ¿Esta sesión puede ver/usar algo que pide el permiso `p`? (el dueño, todo) */
export function sesionPuede(sesion, p) {
  if (!sesion) return false;
  if (sesion.demo) return true;
  return puede({ rol: sesion.rolId, permisos: sesion.permisos }, p);
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
