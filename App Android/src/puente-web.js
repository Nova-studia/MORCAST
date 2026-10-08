import { postApp } from "./api-web";
import { abrirEnNavegador } from "./enlaces-web";
import { resultadoPuente } from "./puente-logica.js";

/**
 * "COMPLETAR MI ALTA" SIN CONTRASEÑA (8-oct-2026, Apple guía 4).
 *
 * La app le pide a la web un enlace de UN SOLO USO para el correo de su
 * propia sesión (/api/app/puente-web) y lo abre: morcast.mx entra con la
 * misma cuenta y enseña el alta con nombre y correo ya puestos. Así quien
 * entró con Apple (o Google) nunca escribe nombre, correo ni contraseña.
 *
 * Si el enlace no sale (sin señal, servidor caído) NO se abre nada: se
 * devuelve el motivo para enseñarlo y que vuelva a tocar el botón
 * (puente-logica). El login de la web pediría contraseña.
 */
export async function abrirAltaEnWeb() {
  const r = resultadoPuente(await postApp("puente-web", { a: "registro" }));
  if (!r.abrir) return { ok: false, motivo: r.motivo };
  await abrirEnNavegador(r.abrir);
  return { ok: true };
}
