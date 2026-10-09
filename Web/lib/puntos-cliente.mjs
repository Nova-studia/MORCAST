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
    .sort((a, b) => a.texto.localeCompare(b.texto, "es"));
}

/** Con un solo punto se escoge solo (el flujo de siempre); con varios, que elija. */
export function puntoInicial(puntos = []) {
  return puntos.length === 1 ? puntos[0].domicilioId : "";
}
