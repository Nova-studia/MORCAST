/**
 * MI CUENTA (Entrega 2, 9-oct-2026): el personal y los choferes cambian su
 * nombre, su teléfono y su contraseña sin pedírselo a nadie.
 *
 * Cambiar la contraseña pide la ACTUAL: con una sesión abierta olvidada en
 * una computadora de la oficina, cualquiera podría poner una nueva y dejar
 * fuera al dueño de la cuenta. Las piezas con Supabase llegan inyectadas
 * (`comprobar`, `guardar`, `avisar`) para probar esto sin red.
 */

export function validarCambioContrasena({ actual, nueva, repetir } = {}) {
  if (!actual) return { ok: false, motivo: "Escribe tu contraseña actual." };
  if (String(nueva || "").length < 8) return { ok: false, motivo: "La contraseña nueva debe tener al menos 8 caracteres." };
  if (nueva === actual) return { ok: false, motivo: "La nueva tiene que ser distinta de la actual." };
  if (nueva !== repetir) return { ok: false, motivo: "Las dos contraseñas nuevas no coinciden." };
  return { ok: true };
}

export async function cambiarContrasenaCon({ comprobar, guardar, avisar }, { correo, uid, actual, nueva, repetir } = {}) {
  const v = validarCambioContrasena({ actual, nueva, repetir });
  if (!v.ok) return v;
  if (!(await comprobar(correo, actual))) return { ok: false, motivo: "La contraseña actual no es correcta." };
  try {
    await guardar(uid, nueva);
  } catch (e) {
    return { ok: false, motivo: `No se pudo cambiar: ${e?.message || "error desconocido"}` };
  }
  await avisar();
  return { ok: true };
}
