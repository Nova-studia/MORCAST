import { postWeb } from "./api-web";
import { abrirEnNavegador, URL_PORTAL_LOGIN } from "./enlaces-web";

/**
 * "COMPLETAR MI ALTA" SIN CONTRASEÑA (8-oct-2026, Apple guía 4).
 *
 * La app le pide a la web un enlace de UN SOLO USO para el correo de su
 * propia sesión (/api/app/puente-web) y lo abre: morcast.mx entra con la
 * misma cuenta y enseña el alta con nombre y correo ya puestos. Así quien
 * entró con Apple (o Google) nunca escribe nombre, correo ni contraseña.
 *
 * Si el enlace no sale (sin señal, servidor caído), se abre el login de la
 * web como antes y se devuelve el motivo para enseñarlo.
 */
export async function abrirAltaEnWeb() {
  const r = await postWeb("/api/app/puente-web", { a: "registro" });
  if (r?.ok && typeof r.url === "string" && r.url.startsWith("https://")) {
    await abrirEnNavegador(r.url);
    return { ok: true };
  }
  await abrirEnNavegador(URL_PORTAL_LOGIN);
  return { ok: false, motivo: r?.motivo || "No se pudo abrir tu alta. Inténtalo otra vez." };
}
