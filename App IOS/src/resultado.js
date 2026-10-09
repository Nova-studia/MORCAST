/**
 * LA RESPUESTA DE UNA ACCIÓN, CON UN MOTIVO PARA PERSONAS (9-oct-2026).
 *
 * `postWeb`/`postAdmin` (y por ellos `accionApp`/`accionAdmin`) nunca lanzan:
 * devuelven `{ ok, motivo?, sinRed?, segundoPaso? }`. Aquí se le da forma
 * para las pantallas nuevas:
 *   · `sinRed` → la pantalla enseña "Sin conexión" con Reintentar;
 *   · `segundoPaso` → ya se puso la pantalla del código encima (candado-admin);
 *   · lo demás → `motivo` tal cual (el servidor ya lo escribe para personas).
 */
export function resultado(r, porOmision = "No se pudo. Inténtalo otra vez.") {
  if (r?.ok) return r;
  if (r?.segundoPaso) return { ...r, ok: false, segundoPaso: true, motivo: r.motivo || "Vuelve a confirmar con el código de tu correo." };
  if (r?.sinRed || r?.red) return { ...r, ok: false, sinRed: true, motivo: SIN_CONEXION };
  if (r?.motivo === "sin_sesion") return { ...r, ok: false, motivo: "Tu sesión se venció. Vuelve a entrar." };
  return { ...r, ok: false, motivo: r?.motivo || porOmision };
}

export const SIN_CONEXION = "Sin conexión con Morcast. Revisa tu señal e inténtalo otra vez.";

/** Respuesta de la demostración (sin base): nada se guarda, nada truena. */
export const DEMO = { ok: true, demo: true };
