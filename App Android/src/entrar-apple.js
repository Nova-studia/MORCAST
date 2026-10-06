/**
 * "CONTINUAR CON APPLE" — EN ANDROID NO EXISTE.
 *
 * Apple sólo lo exige en el iPhone (guía 4.8 de la App Store) y en Android
 * nadie lo espera. Este archivo es el "de mentiras" del de `App IOS/src/
 * entrar-apple.js`: tiene los mismos nombres para que `BotonesSociales.js`
 * sea idéntico en las dos apps, pero no carga ningún módulo de Apple (no está
 * instalado aquí, a propósito).
 */

/** En Android nunca hay botón de Apple. */
export function useAppleDisponible() {
  return false;
}

export function BotonApple() {
  return null;
}

export async function entrarConApple() {
  return { ok: false, mensaje: "Entrar con Apple sólo está disponible en el iPhone." };
}
