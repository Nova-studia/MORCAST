import { supabase, haySupabase } from "./supabase";
import { postApp } from "./api-web";
import { almacenSecreto } from "./almacen-seguro";
import { limpiarCodigo, paseUtil, mensajeSegundoPaso } from "./pase-admin.js";

/**
 * SEGUNDO PASO DEL PANEL EN LA APP: el código que llega por correo.
 *
 * Igual que la web (`/admin/verificacion`, `Web/lib/mfa.mjs`): tras la
 * contraseña, el dueño y los administradores escriben un código de 6
 * dígitos. La web deja una cookie firmada; la app recibe un PASE firmado
 * (`/api/app/segundo-paso/verificar`) y lo guarda CIFRADO en SecureStore.
 * Cada vez que se abre la administración se comprueba con
 * `/api/app/segundo-paso/estado`: sin pase válido NO se enseña el panel.
 *
 * Ojo, lo mismo que dice la web: esto cuida la PANTALLA de administración,
 * no la base. Supabase no conoce este código como segundo factor; los datos
 * los sigue cuidando el RLS.
 */

const LLAVE_PASE = "morcast_pase_admin";

async function uidDeSesion() {
  if (!haySupabase()) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.user?.id || null;
  } catch {
    return null;
  }
}

async function leerPase() {
  try {
    const crudo = await almacenSecreto.getItem(LLAVE_PASE);
    return crudo ? JSON.parse(crudo) : null;
  } catch {
    // Un pase ilegible es igual a no tenerlo: se pide código otra vez.
    return null;
  }
}

/** El pase vigente (texto) para mandarlo con las acciones de administración, o null. */
export async function paseActual() {
  const g = await leerPase();
  return g?.pase || null;
}

/** Borra el pase guardado. Se llama al cerrar sesión y cuando el servidor lo rechaza. */
export async function olvidarPase() {
  try {
    await almacenSecreto.removeItem(LLAVE_PASE);
  } catch {
    /* no había nada que borrar */
  }
}

/**
 * ¿Puede pasar directo a la administración?
 * @returns {Promise<{valido: boolean, red?: boolean, motivo?: string}>}
 *   `red: true` = no se pudo preguntar (sin señal). NO es "válido": la
 *   pantalla ofrece reintentar, pero no abre el panel.
 */
export async function comprobarPase() {
  // Modo demostración (sin base): no hay servidor que mande códigos.
  if (!haySupabase()) return { valido: true };

  const [guardado, uid] = await Promise.all([leerPase(), uidDeSesion()]);
  if (!paseUtil(guardado, uid)) {
    if (guardado) await olvidarPase();
    return { valido: false };
  }

  const r = await postApp("segundo-paso/estado", { pase: guardado.pase });
  if (r.red) return { valido: false, red: true, motivo: r.motivo };
  if (r.ok && r.valido === true) return { valido: true };
  // Solo se tira el pase cuando el servidor dice que NO es válido. Un 429,
  // un 5xx o un token que no se pudo renovar con mala señal no dicen nada
  // del pase: se trata como falta de red y se ofrece reintentar.
  if (r.ok !== true) return { valido: false, red: true, motivo: r.motivo };

  await olvidarPase();
  return { valido: false };
}

/**
 * Pide que se mande el código al correo de la cuenta.
 * @returns {Promise<{ok: true, correo: string, espera: number} | {ok: false, motivo: string}>}
 */
export async function mandarCodigo() {
  const r = await postApp("segundo-paso/mandar", {});
  if (!r.ok) {
    return {
      ok: false,
      motivo: mensajeSegundoPaso(r.motivo, "No se pudo mandar el código. Inténtalo de nuevo."),
      espera: Number(r.espera) || 0,
    };
  }
  return {
    ok: true,
    correo: r.correo || "",
    espera: Number.isFinite(Number(r.espera)) ? Math.max(0, Number(r.espera)) : 60,
    yaEnviado: Boolean(r.yaEnviado),
  };
}

/**
 * Manda el código escrito. Si es correcto, guarda el pase y responde ok.
 * @returns {Promise<{ok: true} | {ok: false, motivo: string}>}
 */
export async function verificarCodigo(texto) {
  const codigo = limpiarCodigo(texto);
  if (codigo.length !== 6) return { ok: false, motivo: "Escribe los 6 dígitos del código." };

  const r = await postApp("segundo-paso/verificar", { codigo });
  if (!r.ok || !r.pase) {
    return { ok: false, motivo: mensajeSegundoPaso(r.motivo, "Ese código no es. Revisa el último correo que te llegó.") };
  }

  const uid = await uidDeSesion();
  try {
    await almacenSecreto.setItem(LLAVE_PASE, JSON.stringify({ pase: r.pase, vence: r.vence ?? null, uid }));
  } catch {
    // Sin dónde guardarlo se deja pasar ESTA vez; la próxima pedirá código.
  }
  return { ok: true };
}
