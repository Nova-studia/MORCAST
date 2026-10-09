// COPIA de Web/lib/puntos-cliente.mjs (apps al 100%, 9-oct-2026). NO se edita aquí: se cambia en la web
// y se vuelve a copiar; Web/tests/apps-copias.test.mjs avisa si se queda atrás.
/**
 * LOS PUNTOS DONDE UN CLIENTE PUEDE AGENDAR (Entrega 3, 9-oct-2026).
 *
 * Antes la solicitud caía SIEMPRE en el primer punto del cliente (43 clientes
 * con 70 puntos: recolecciones en la planta equivocada). Ahora el portal le
 * pregunta en cuál, y la solicitud lleva ese punto y la ruta de SU servicio.
 * Recibe las suscripciones como salen de la base (con domicilios y rutas).
 */
export function puntosAgendables(suscripciones = []) {
  return (suscripciones || [])
    .filter((s) => s.estado === "activa" && s.domicilio_id)
    .map((s) => ({
      domicilioId: s.domicilio_id,
      texto: [s.domicilios?.alias, s.domicilios?.colonia].filter(Boolean).join(" · ") || "Punto sin nombre",
      ruta: s.rutas
        ? { id: s.rutas.id, clave: s.rutas.clave, nombre: s.rutas.nombre, tipo: s.rutas.tipo, dias: s.rutas.dias || [] }
        : null,
    }))
    // Un punto con dos servicios activos sale una sola vez.
    .filter((p, i, todos) => todos.findIndex((x) => x.domicilioId === p.domicilioId) === i)
    .sort((a, b) => a.texto.localeCompare(b.texto, "es"));
}

/** Con un solo punto se escoge solo (el flujo de siempre); con varios, que elija. */
export function puntoInicial(puntos = []) {
  return puntos.length === 1 ? puntos[0].domicilioId : "";
}

/**
 * Sectores y puntos del panel (Entrega 3): los puntos de un cliente dado de
 * baja ya no salen, y un servicio cancelado no pinta ruta (antes un punto
 * de baja seguía "en" su ruta y el filtro "Sin ruta" no lo encontraba).
 */
export function puntoVisibleEnMapa(fila) {
  return fila?.clientes?.estado !== "baja";
}

/** La suscripción que cuenta de un punto (activa o pausada), o null. */
export function suscripcionVigente(subs) {
  const lista = Array.isArray(subs) ? subs : subs ? [subs] : [];
  return lista.find((s) => s.estado === "activa") || lista.find((s) => s.estado === "pausada") || null;
}
