/**
 * ¿A DÓNDE LLEVA EL TOQUE DE UNA NOTIFICACIÓN? — lógica pura.
 *
 * El servidor manda `data: { tipo: 'aviso' | 'incidente', id }` (contrato de
 * la 1.1). Aquí se decide qué pantalla abrir según quién tiene la sesión,
 * sin tocar React Navigation, para poder probarlo con `node --test`.
 *
 *   · aviso     → el cliente va a Inicio, donde está la tarjeta del aviso.
 *   · incidente → lo reciben los de la oficina: van al Panel. (La app aún no
 *                 tiene bandeja de incidentes; el panel web sí. Se abre el
 *                 Panel para que al menos aterricen en la administración.)
 *
 * Si la notificación no es para el modo con el que está abierta la app (por
 * ejemplo, un aviso de cliente en un teléfono con sesión de chofer), se
 * ignora: llevar a alguien a una pantalla que no existe en su modo rompería
 * la navegación.
 */

export function destinoDeNotificacion(data, modo) {
  const tipo = data && typeof data === "object" ? String(data.tipo || "") : "";
  if (tipo === "aviso" && modo === "cliente") {
    return { pantalla: "TabsCliente", params: { screen: "Inicio" } };
  }
  if (tipo === "incidente" && modo === "admin") {
    return { pantalla: "TabsAdmin", params: { screen: "Panel" } };
  }
  return null;
}
