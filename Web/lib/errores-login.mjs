/**
 * LOS AVISOS DE ERROR DEL LOGIN, ESCRITOS POR NOSOTROS.
 *
 * Antes la URL llevaba la frase completa (`?error=No se pudo…`) y la pantalla
 * la pintaba tal cual. React escapa, asi que no habia XSS, pero el texto lo
 * escogia quien armara el enlace: `morcast.mx/portal/login?error=Tu cuenta fue
 * bloqueada, llama al 555…` es una trampa de phishing creible SOBRE EL DOMINIO
 * REAL de la empresa. Ahora la URL solo lleva un codigo corto y el texto sale
 * de aqui, de modo que lo unico que puede lograr un enlace armado a mano es
 * enseñar uno de estos cuatro mensajes — o el generico.
 *
 * Vive aparte y sin dependencias (igual que `destino-sesion.mjs`) porque lo
 * necesitan los dos lados: quien EMITE el codigo desde el servidor
 * (`/auth/callback`) y desde el navegador (la sala de espera), y quien lo
 * TRADUCE (la pantalla de login). Con el diccionario en un solo sitio no se
 * puede emitir un codigo que nadie sepa traducir.
 */

export const ERRORES_LOGIN = {
  /** La persona le dio "Cancelar" en la pantalla de permisos de Google. */
  googleCancelado: "google_cancelado",
  /** Google devolvio la vuelta sin `?code=`: no hay nada que canjear. */
  faltaCodigo: "falta_codigo",
  /** El codigo llego, pero Supabase no lo pudo cambiar por una sesion. */
  sesionNoCanjeada: "sesion_no_canjeada",
  /** La sesion murio al activarle la cuenta (cambiar la contraseña revoca). */
  sesionCerrada: "sesion_cerrada",
};

const TEXTOS = {
  [ERRORES_LOGIN.googleCancelado]: "No se completó la entrada con Google.",
  [ERRORES_LOGIN.faltaCodigo]: "Falta el código de Google. Vuelve a intentarlo.",
  [ERRORES_LOGIN.sesionNoCanjeada]: "No se pudo iniciar sesión con Google. Inténtalo de nuevo.",
  [ERRORES_LOGIN.sesionCerrada]:
    "Tu sesión se cerró. Vuelve a entrar: si la empresa ya activó tu cuenta, entrarás directo al portal.",
};

const GENERICO = "No se pudo entrar. Inténtalo de nuevo.";

/**
 * El texto de un codigo. Un codigo desconocido —o inventado por quien armo el
 * enlace— cae en el generico: nunca se pinta lo que venga en la URL.
 */
export function mensajeDeError(codigo) {
  if (!codigo) return "";
  return TEXTOS[codigo] || GENERICO;
}
