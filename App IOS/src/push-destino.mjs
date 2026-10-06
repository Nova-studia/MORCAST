/**
 * ¿A DÓNDE LLEVA EL TOQUE DE UNA NOTIFICACIÓN? — lógica pura.
 *
 * El servidor manda `data: { tipo: 'aviso' | 'incidente' | 'recoleccion' | 'solicitud' | 'parada', id }`
 * (contrato de la 1.1). Aquí se decide qué pantalla abrir según quién tiene
 * la sesión, sin tocar React Navigation, para poder probarlo con `node --test`.
 *
 *   · aviso       → el cliente va a Inicio, donde está la tarjeta del aviso.
 *   · recoleccion → un cambio de SU recolección (en camino, realizada, no
 *                   procedió, reagendada, retraso; 6-oct-2026). Trae además
 *                   `folio` y `evento`. El cliente va al Historial, donde ve
 *                   el estado y el detalle; `recoleccion` y `evento` le dicen
 *                   a esa pantalla que vuelva a leer la lista.
 *   · incidente   → lo reciben los de la oficina: van a la bandeja de
 *                   Incidentes, abierta en ese incidente (6-oct-2026; antes
 *                   caían en el Panel porque la app no tenía bandeja).
 *   · solicitud   → un cliente pidió una recolección: la oficina va a
 *                   Recolecciones, abierta en esa solicitud (6-oct-2026).
 *   · parada      → al CHOFER le pusieron, cambiaron o quitaron una parada:
 *                   va a su ruta y la vuelve a leer (`recargar`, un número
 *                   distinto en cada toque para que la pantalla lo note).
 *
 * Si la notificación no es para el modo con el que está abierta la app (por
 * ejemplo, un aviso de cliente en un teléfono con sesión de chofer), se
 * ignora: llevar a alguien a una pantalla que no existe en su modo rompería
 * la navegación.
 */

export function destinoDeNotificacion(data, modo, ahora = Date.now()) {
  const tipo = data && typeof data === "object" ? String(data.tipo || "") : "";
  if (tipo === "aviso" && modo === "cliente") {
    return { pantalla: "TabsCliente", params: { screen: "Inicio" } };
  }
  if (tipo === "recoleccion" && modo === "cliente") {
    return {
      pantalla: "TabsCliente",
      params: { screen: "Historial", params: { recoleccion: data.id ?? null, evento: data.evento ?? null } },
    };
  }
  // equipo 1 (6-oct-2026): bandejas de la oficina y la ruta del chofer.
  if (tipo === "incidente" && modo === "admin") {
    return { pantalla: "Incidentes", params: { id: data.id ?? null } };
  }
  if (tipo === "solicitud" && modo === "admin") {
    return { pantalla: "Recolecciones", params: { id: data.id ?? null } };
  }
  if (tipo === "parada" && modo === "chofer") {
    return { pantalla: "Ruta", params: { recargar: ahora, parada: data.id ?? null } };
  }
  return null;
}
