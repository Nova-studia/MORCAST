/**
 * ¿A DÓNDE LLEVA UNA NOTIFICACIÓN AL TOCARLA? — regla pura.
 *
 * Contrato con el servidor (db/026 y los envíos de la web): cada push trae
 * `data: { tipo: "aviso" | "incidente" | "recoleccion", id }`.
 *   · aviso       → al cliente: Inicio, donde está la tarjeta del aviso.
 *   · recoleccion → al cliente: un cambio de SU recolección (en camino,
 *                   realizada, no procedió, reagendada, retraso; 6-oct-2026).
 *                   Trae además `folio` y `evento`. Va al Historial, donde ve
 *                   el estado y el detalle; `recoleccion` y `evento` le dicen
 *                   a esa pantalla que vuelva a leer la lista.
 *   · incidente   → al personal: el Panel de administración.
 * Si la notificación no es para el modo con sesión abierta (un aviso tocado
 * en un teléfono donde ahora entró el admin) no se navega a ningún lado: la
 * app solo se abre.
 *
 * @param {object|null} data  lo que trae `notification.request.content.data`
 * @param {"cliente"|"admin"|"chofer"|null} modo  la sesión abierta
 * @returns {{pila: string, pestana: string, params?: object} | null}
 */
export function destinoDeNotificacion(data, modo) {
  const tipo = data?.tipo;
  if (tipo === "aviso" && modo === "cliente") {
    return { pila: "TabsCliente", pestana: "Inicio", params: { aviso: data.id ?? null } };
  }
  if (tipo === "recoleccion" && modo === "cliente") {
    return {
      pila: "TabsCliente",
      pestana: "Historial",
      params: { recoleccion: data.id ?? null, evento: data.evento ?? null },
    };
  }
  if (tipo === "incidente" && modo === "admin") {
    return { pila: "TabsAdmin", pestana: "Panel", params: { incidente: data.id ?? null } };
  }
  return null;
}
