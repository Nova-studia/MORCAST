/**
 * ¿A DÓNDE LLEVA UNA NOTIFICACIÓN AL TOCARLA? — regla pura.
 *
 * Contrato con el servidor (db/026 y los envíos de la web): cada push trae
 * `data: { tipo: "aviso" | "incidente" | "recoleccion" | "solicitud" | "parada", id }`.
 *   · aviso       → al cliente: Inicio, donde está la tarjeta del aviso.
 *   · recoleccion → al cliente: un cambio de SU recolección (en camino,
 *                   realizada, no procedió, reagendada, retraso; 6-oct-2026).
 *                   Trae además `folio` y `evento`. Va al Historial, donde ve
 *                   el estado y el detalle; `recoleccion` y `evento` le dicen
 *                   a esa pantalla que vuelva a leer la lista.
 *   · incidente   → al personal: la bandeja de Incidentes, abierta en ese
 *                   incidente (6-oct-2026; antes caía en el Panel).
 *   · solicitud   → un cliente pidió una recolección: la oficina va a
 *                   Recolecciones, abierta en esa solicitud (6-oct-2026).
 *   · parada      → al CHOFER le pusieron, cambiaron o quitaron una parada:
 *                   va a su Ruta y la vuelve a leer (`recargar`, distinto en
 *                   cada toque para que la pantalla lo note).
 * Sin `pestana`, el destino es una pantalla de la pila, no una pestaña.
 * Si la notificación no es para el modo con sesión abierta (un aviso tocado
 * en un teléfono donde ahora entró el admin) no se navega a ningún lado: la
 * app solo se abre.
 *
 * @param {object|null} data  lo que trae `notification.request.content.data`
 * @param {"cliente"|"admin"|"chofer"|null} modo  la sesión abierta
 * @param {number} [ahora]  para `recargar` (las pruebas lo fijan)
 * @returns {{pila: string, pestana?: string, params?: object} | null}
 */
export function destinoDeNotificacion(data, modo, ahora = Date.now()) {
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
  // equipo 1 (6-oct-2026): bandejas de la oficina y la ruta del chofer.
  if (tipo === "incidente" && modo === "admin") {
    return { pila: "Incidentes", params: { id: data.id ?? null } };
  }
  if (tipo === "solicitud" && modo === "admin") {
    return { pila: "Recolecciones", params: { id: data.id ?? null } };
  }
  if (tipo === "parada" && modo === "chofer") {
    return { pila: "Ruta", params: { recargar: ahora, parada: data.id ?? null } };
  }
  return null;
}
