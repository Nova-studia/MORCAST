/**
 * MI CUENTA EN LA APP (apps al 100%, 9-oct-2026): lo de cada quien —nombre,
 * teléfono y contraseña— para el cliente, el personal y el chofer. Puro, con
 * pruebas en tests/cuenta-y-equipo.test.mjs.
 */

/**
 * ¿Tiene contraseña que cambiar? Quien entra SOLO con Google o Apple no:
 * el formulario le pediría "tu contraseña actual" y no tiene ninguna. Misma
 * regla que `miCuentaAccion` de la web: sin datos del proveedor, se ofrece.
 */
export function tieneContrasena(usuario) {
  const meta = usuario?.app_metadata || {};
  const proveedores = Array.isArray(meta.providers) ? meta.providers : [meta.provider].filter(Boolean);
  return proveedores.length === 0 || proveedores.includes("email");
}

/**
 * Nombre y teléfono propios. Igual que `validarEdicionUsuario` de la web
 * (Web/lib/equipo.mjs), que es lo que vuelve a revisar la web en sus
 * pantallas: los teléfonos viejos traen +52 y se quedan los últimos 10.
 */
export function validarMisDatos({ nombre, telefono, rolId } = {}) {
  const limpio = {
    nombre: String(nombre ?? "").trim().replace(/\s+/g, " "),
    telefono: String(telefono ?? "").replace(/\D/g, "").slice(-10) || null,
    rolId: rolId ? String(rolId) : null,
  };
  if (!limpio.nombre) return { ok: false, motivo: "Escribe el nombre." };
  if (limpio.nombre.length > 120) return { ok: false, motivo: "El nombre es muy largo." };
  if (limpio.telefono && limpio.telefono.length !== 10) return { ok: false, motivo: "El teléfono debe tener 10 dígitos." };
  return { ok: true, limpio };
}
