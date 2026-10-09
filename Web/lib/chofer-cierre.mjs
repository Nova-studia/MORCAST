/**
 * REGLAS DEL CIERRE DE UNA PARADA EN LA WEB DEL CHOFER (Entrega 3, 9-oct-2026).
 *
 * Sin dependencias, con pruebas (tests/chofer-cierre.test.mjs). Arreglan tres
 * cosas de la auditoría:
 *   · las horas de las fotos eran la hora de "Finalizar" (las dos iguales);
 *   · una parada que cerró otro chofer se veía pendiente (no puede leer su
 *     evidencia) y se podía volver a cerrar;
 *   · "el cliente ya fue avisado" salía aunque no se hubiera avisado.
 */

/** El sello de una foto, tomado en el momento de la foto. */
export function selloFoto(ahora = new Date()) {
  const hh = String(ahora.getHours()).padStart(2, "0");
  const mm = String(ahora.getMinutes()).padStart(2, "0");
  return { hora: `${hh}:${mm}`, en: ahora.toISOString() };
}

/** Las horas que viajan al cerrar: las de cada foto. Sin hora real, null (nunca inventada). */
export function horasDeCierre({ antes, despues } = {}) {
  return { horaAntes: antes?.en || null, horaDespues: despues?.en || null };
}

/** Lo que el chofer tiene por hacer, según el estado de la base. */
export function estatusDeParada(estado) {
  if (estado === "no-procedio") return "no-procedio";
  if (estado === "completada") return "completado";
  return "pendiente";
}

/** ¿El aviso al cliente salió de verdad (o ya había salido antes)? */
export function avisoEnviado(aviso) {
  return Boolean(aviso && (aviso.correo || aviso.notificaciones > 0 || aviso.yaAvisado));
}

/** El renglón bajo una parada en camino. `avisado` undefined = no se sabe (se cargó así). */
export function textoEnCamino(avisado) {
  if (avisado === true) return "En camino · el cliente ya fue avisado";
  if (avisado === false) return "En camino · no se pudo avisar al cliente (no tiene correo ni la app)";
  return "En camino";
}
