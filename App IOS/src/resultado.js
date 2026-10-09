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

/** El texto de un `Fallo`, sin "Sin conexión. Sin conexión con…" (revisión 9-oct). */
export function textoFallo(fallo) {
  const motivo = fallo?.motivo || "";
  return fallo?.sinRed && !/^sin conexi[oó]n/i.test(motivo) ? `Sin conexión. ${motivo}` : motivo;
}

/**
 * Qué hacer cuando `mis-permisos` falla (revisión 9-oct). Antes solo la falta
 * de señal se reintentaba: un 500, un 429 o un token que no se renovó dejaban
 * al dueño sin secciones hasta reiniciar. Ahora todo se reintenta, salvo el
 * segundo paso (la pantalla del código ya está encima y al pasarla se piden).
 */
export function falloDePermisos(r) {
  const x = resultado(r || { ok: false, sinRed: true }, "No se pudieron leer tus permisos.");
  return {
    fallo: { sinRed: Boolean(x.sinRed), motivo: x.sinRed ? "No se pudieron leer tus permisos." : x.motivo },
    reintentar: !x.segundoPaso,
  };
}
