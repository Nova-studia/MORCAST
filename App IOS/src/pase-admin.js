import { supabase, haySupabase } from "./supabase";
import { llaveroApp } from "./almacen-seguro";
import { postWeb } from "./api-web";
import { empacarPase, desempacarPase, paseLocalVigente, mensajeSegundoPaso } from "./segundo-paso.mjs";

/**
 * SEGUNDO PASO DE LA ADMINISTRACIÓN: código por correo (pedido de los
 * dueños, 4-oct-2026). Con la contraseña sola ya no se abre el panel.
 *
 * El servidor (`/api/app/segundo-paso/*`) manda el código, lo revisa y
 * entrega un `pase` firmado. El pase se guarda en el LLAVERO del iPhone, no
 * en AsyncStorage: con él en la mano se salta el segundo paso, así que vale
 * lo mismo que la sesión. Y cada vez que se abre la app se le pregunta al
 * servidor si sigue valiendo (`/estado`): él puede invalidarlo antes de su
 * vencimiento (sesión cerrada, cuenta dada de baja).
 *
 * La lógica sin red (formato, de quién es, vencido o no) vive en
 * `segundo-paso.mjs`, con pruebas.
 */

const LLAVE = "morcast_pase_admin";

async function usuarioId() {
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
    return desempacarPase(await llaveroApp.getItem(LLAVE), await usuarioId());
  } catch {
    return null;
  }
}

export async function olvidarPase() {
  try { await llaveroApp.removeItem(LLAVE); } catch { /* nada que borrar */ }
}

/**
 * ¿Hay un pase válido para quien tiene la sesión?
 *
 * Devuelve `{ valido: true }`, `{ valido: false }` (hay que pedir código) o
 * `{ valido: false, sinRed: true }` (no se pudo preguntar: la pantalla
 * ofrece reintentar, pero NO abre el panel — sin comprobar no se entra).
 */
export async function comprobarPase() {
  // Sin base (modo demostración) no hay servidor que mande códigos.
  if (!haySupabase()) return { valido: true, demo: true };

  const guardado = await leerPase();
  if (!paseLocalVigente(guardado)) {
    if (guardado) await olvidarPase();
    return { valido: false };
  }

  const r = await postWeb("/api/app/segundo-paso/estado", { pase: guardado.pase }, { espera: 12000 });
  if (r.sinRed) return { valido: false, sinRed: true };
  if (r.ok && r.valido === true) return { valido: true };

  await olvidarPase();
  return { valido: false };
}

/** Pide que se mande el código al correo de la cuenta. */
export async function mandarCodigo() {
  if (!haySupabase()) return { ok: true, correo: "", espera: 60 };
  const r = await postWeb("/api/app/segundo-paso/mandar", {});
  if (r.ok) return { ok: true, correo: r.correo || "", espera: Number(r.espera) || 60 };
  return { ok: false, motivo: mensajeSegundoPaso(r.motivo, "No se pudo mandar el código. Inténtalo de nuevo."), espera: Number(r.espera) || 0 };
}

/** Revisa el código. Si es correcto, guarda el pase en el llavero. */
export async function verificarCodigo(codigo) {
  if (!haySupabase()) return { ok: true };
  const r = await postWeb("/api/app/segundo-paso/verificar", { codigo });
  if (!r.ok || !r.pase) {
    return { ok: false, motivo: mensajeSegundoPaso(r.motivo, "No se pudo revisar el código. Inténtalo de nuevo.") };
  }
  try {
    await llaveroApp.setItem(LLAVE, empacarPase({ pase: r.pase, vence: r.vence }, await usuarioId()));
  } catch {
    // Sin poder guardarlo, igual se entra esta vez; la próxima se pide otro
    // código. Mejor eso que dejar al dueño afuera por un fallo del llavero.
  }
  return { ok: true };
}
