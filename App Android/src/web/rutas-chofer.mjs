// COPIA de Web/lib/rutas-chofer.mjs (apps al 100%, 9-oct-2026). NO se edita aquí: se cambia en la web
// y se vuelve a copiar; Web/tests/apps-copias.test.mjs avisa si se queda atrás.
/**
 * EL CHOFER DE CADA RUTA (Entrega 3, 9-oct-2026).
 *
 * Hasta hoy era un nombre escrito a mano (`rutas.chofer`) y `rutas.chofer_id`
 * nunca se llenaba. De ese id dependen las paradas que ve cada chofer
 * (`mis_paradas`, db/013) y sus avisos: una recolección confirmada con "El de
 * la ruta" en una ruta sin chofer no le aparecía a NADIE. Ahora se escoge de
 * la lista de choferes y el texto queda solo como el nombre que se enseña.
 */

/** Lo que se guarda en `rutas` al escoger un chofer de la lista. */
export function elegirChoferRuta(choferId, choferes = []) {
  const c = choferes.find((x) => x.id === choferId);
  return c ? { chofer_id: c.id, chofer: c.nombre || "" } : { chofer_id: null, chofer: "" };
}

/** El texto de la opción vacía ("El de la ruta") en Recolecciones. */
export function textoChoferPorOmision(ruta) {
  if (!ruta?.choferId) return "La ruta no tiene chofer asignado";
  return ruta.chofer ? `El de la ruta: ${ruta.chofer}` : "El de la ruta";
}

/** Advertencia al programar: sin chofer elegido y sin chofer en la ruta, nadie la verá. */
export function avisoRutaSinChofer({ choferElegido, ruta }) {
  if (choferElegido || ruta?.choferId) return null;
  return "Esta ruta no tiene chofer asignado: si no eliges uno, ningún chofer verá esta recolección.";
}
