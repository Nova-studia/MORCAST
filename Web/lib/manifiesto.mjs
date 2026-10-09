/**
 * LOS DATOS REALES DEL MANIFIESTO (Entrega 3, 9-oct-2026).
 *
 * Decía "Manifiesto de demostración", con "Residuos de ruta" como residuo y el
 * nombre escrito a mano de la ruta como chofer. Ahora lleva lo que declaró el
 * cliente, el peso real (o el del chofer, marcado como estimado), la hora de
 * la recolección y el chofer que la hizo. Lo que solo puede dar Morcast
 * (permiso y destino final) sale como "Pendiente" en vez de inventarlo.
 */
export const PENDIENTE_EMPRESA = "Pendiente";

export function residuoDeclarado({ tipo_residuo, origen } = {}) {
  if (tipo_residuo) return tipo_residuo;
  return origen === "extra" ? "Recolección extra (sin tipo declarado)" : "Residuos de ruta (sin tipo declarado)";
}

/** `ev` = la fila de `recolecciones`. */
export function pesoManifiesto(ev) {
  if (ev?.peso_real_kg) return `${ev.peso_real_kg} kg`;
  if (ev?.peso_kg) return `${ev.peso_kg} kg (estimado por el chofer)`;
  return PENDIENTE_EMPRESA;
}

/** HH:MM en Matamoros de cuando se recogió (la foto de "después"). */
export function horaManifiesto(ev) {
  const t = ev?.hora_despues || ev?.hora_antes;
  if (!t) return "";
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Matamoros", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(t));
}
