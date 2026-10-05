/**
 * VERIFICACIÓN EN DOS PASOS DEL PANEL (dueño y administradores).
 *
 * Por qué
 * -------
 * Los dueños pidieron (4-oct-2026) que la información delicada no se filtre.
 * Con solo correo y contraseña, una contraseña adivinada, reusada o robada
 * abre el panel completo: saldos, datos fiscales y el padrón de clientes.
 * Con el segundo paso hace falta además el teléfono de la persona (un código
 * de 6 dígitos que cambia cada 30 s en Google Authenticator, Authy, etc.).
 *
 * Cómo
 * ----
 * Supabase marca la sesión con `aal1` (solo contraseña) o `aal2` (contraseña
 * + código). El panel exige `aal2`:
 *   · proxy.js manda a /admin/verificacion a quien llegue con aal1;
 *   · usuarioActual() no le reconoce el rol de personal a una sesión aal1,
 *     así que las acciones del servidor tampoco se pueden llamar a mano.
 *
 * Válvula de emergencia: si algo saliera mal con Supabase y nadie pudiera
 * entrar, `MFA_PANEL=apagado` en las variables de Vercel lo desactiva sin
 * tocar código. No es para dejarlo así.
 */

export const RUTA_VERIFICACION = "/admin/verificacion";

/** ¿Está encendida la exigencia? Encendida salvo que se apague a propósito. */
export function mfaPanelActivo(entorno = process.env) {
  return String(entorno.MFA_PANEL || "").trim().toLowerCase() !== "apagado";
}

/** ¿Esta sesión tiene que pasar por el segundo paso antes de entrar? */
export function necesitaVerificar({ rol, aal, activo = true }) {
  if (!activo) return false;
  if (rol !== "dueno" && rol !== "admin") return false;
  return aal !== "aal2";
}
