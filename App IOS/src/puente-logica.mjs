/**
 * Qué hacer con la respuesta de /api/app/puente-web (8-oct-2026).
 *
 * Si el enlace no sale, NO se abre el login de la web: ahí se pide correo y
 * contraseña, que es justo lo que Apple rechazó (guía 4). Se dice qué pasó y
 * la persona vuelve a tocar el botón.
 */
export function resultadoPuente(r) {
  if (r?.ok && typeof r.url === "string" && r.url.startsWith("https://")) return { abrir: r.url };
  const motivo = r?.motivo ? String(r.motivo).replace(/\.?\s*$/, ".") : "No se pudo abrir tu alta.";
  return { motivo: `${motivo} Toca “Completar mi alta” otra vez.` };
}
