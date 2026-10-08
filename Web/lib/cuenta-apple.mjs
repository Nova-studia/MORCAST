/**
 * ¿La cuenta entra con "Continuar con Apple"? (8-oct-2026, Apple guía 4.)
 * A esas cuentas NO se les pone contraseña al activarlas: Apple exige que
 * quien entra con Apple no tenga que crear ni recibir una.
 */
export function esCuentaApple(usuario) {
  if (!usuario) return false;
  const meta = usuario.app_metadata || {};
  if (meta.provider === "apple") return true;
  if (Array.isArray(meta.providers) && meta.providers.includes("apple")) return true;
  return Array.isArray(usuario.identities) && usuario.identities.some((i) => i?.provider === "apple");
}

/**
 * Lo que `activarCuentaRegistradaCon` le manda a `updateUserById`.
 *   · Apple: rol y empresa, SIN contraseña (y sin contraseña nueva no se
 *     cierran sus sesiones: "Ya me activaron — revisar" entra directo).
 *   · Google o correo: como siempre, contraseña de 8+ caracteres.
 */
export function selloDeActivacion({ apple, password, clienteId }) {
  const app_metadata = { rol: "cliente", cliente_id: clienteId };
  if (apple) return { ok: true, cambios: { app_metadata } };
  if (!password || String(password).length < 8) {
    return { ok: false, motivo: "La contraseña debe tener al menos 8 caracteres." };
  }
  return { ok: true, cambios: { password: String(password), app_metadata } };
}

/**
 * El nombre de la cuenta, venga de donde venga: Google lo guarda en
 * `full_name`/`name`; la app guarda el que da Apple en `full_name` y `nombre`.
 * Así el alta lo trae puesto y nadie que entró con Apple lo vuelve a escribir.
 */
export function nombreDeCuenta(meta) {
  const m = meta || {};
  return String(m.full_name || m.name || m.nombre || "").trim();
}
