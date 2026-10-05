/**
 * AVISAR A LA OFICINA DE UN INCIDENTE — las decisiones, sin base de datos.
 *
 * Un incidente (accidente, retraso, falla, contenedor…) se avisa por correo
 * al buzón de la oficina y con una notificación al teléfono del dueño y de
 * los administradores. Lo reporta el chofer desde la web (/chofer) o desde
 * la app; en los dos casos el aviso sale del servidor y dice lo mismo,
 * porque se arma aquí.
 *
 * Lógica pura (tests/incidente-aviso.test.mjs). La parte que toca la base y
 * manda está en lib/avisar-incidente.js.
 */
import { tipoIncidente, asuntoIncidente, textoMinutos } from "./chofer-reportes.mjs";

/**
 * Cuánto tiempo después de guardarse se puede pedir el aviso desde la app.
 * La app lo pide en cuanto el incidente se guardó; una hora cubre una señal
 * que va y viene. Más tarde ya no es "avisar", es repetir algo que la
 * oficina tiene en el panel.
 */
export const MINUTOS_PARA_AVISAR = 60;

export const ENLACE_INCIDENTES = "https://morcast.mx/admin/incidentes";

/**
 * ¿Se puede avisar de este incidente a nombre de este chofer?
 *
 * Un incidente ajeno responde igual que uno que no existe (404): no hay por
 * qué confirmarle a nadie qué ids existen.
 *
 * @returns {{ ok: true, yaAvisado?: true } | { ok: false, status: number, motivo: string }}
 */
export function decidirAvisoIncidente(incidente, { uid, ahora = Date.now() } = {}) {
  if (!incidente || !uid || incidente.operador_id !== uid) {
    return { ok: false, status: 404, motivo: "Ese reporte no existe o no es tuyo." };
  }
  if (incidente.avisado_en) return { ok: true, yaAvisado: true };
  const creado = new Date(incidente.creado).getTime();
  if (!Number.isFinite(creado) || ahora - creado > MINUTOS_PARA_AVISAR * 60 * 1000) {
    return { ok: false, status: 400, motivo: "Ese reporte ya es de hace rato: la oficina lo ve en el panel." };
  }
  return { ok: true };
}

/** Fecha y hora de Matamoros, como se lee en un correo. */
export function cuandoEnMatamoros(instante = new Date()) {
  const d = new Date(instante);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-MX", {
    timeZone: "America/Matamoros",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "MOR-…-0001 · Vidriera Matamoros · Bodega norte", o null sin parada. */
function textoParada(sol) {
  if (!sol) return null;
  return [sol.folio, sol.clientes?.empresa, sol.domicilios?.alias].filter(Boolean).join(" · ") || null;
}

/** Enlace al mapa solo si de verdad hay coordenadas (si no, iría al océano). */
function enlaceMapa(ubicacion) {
  const lat = Number(ubicacion?.lat);
  const lng = Number(ubicacion?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

/**
 * La fila del incidente (con sus relaciones) → lo que pide `correoIncidente`
 * (lib/correo.js, que escapa todo el HTML).
 *
 * `inc` trae: tipo, descripcion, retraso_min, ubicacion, creado,
 *   rutas { nombre, unidad }, unidades { numero_economico },
 *   solicitudes_recoleccion { folio, clientes { empresa }, domicilios { alias } },
 *   contenedores { codigo }
 */
export function datosCorreoIncidente(inc, { chofer }) {
  const tipo = tipoIncidente(inc.tipo);
  return {
    asunto: asuntoIncidente({ tipo: inc.tipo, chofer, retrasoMin: inc.retraso_min }),
    tipoTexto: tipo?.texto || "Incidente",
    urgente: Boolean(tipo?.urgente),
    chofer: chofer || "Sin nombre",
    unidad: inc.unidades?.numero_economico || inc.rutas?.unidad || null,
    ruta: inc.rutas?.nombre || null,
    parada: textoParada(inc.solicitudes_recoleccion),
    contenedor: inc.contenedores?.codigo || null,
    retraso: inc.retraso_min ? textoMinutos(inc.retraso_min) : null,
    descripcion: inc.descripcion || null,
    mapa: enlaceMapa(inc.ubicacion),
    cuando: cuandoEnMatamoros(inc.creado || new Date()),
    enlace: ENLACE_INCIDENTES,
  };
}

/**
 * La notificación al teléfono de la oficina: corta, que se entienda en la
 * pantalla bloqueada. Al tocarla, la app abre ese incidente (`datos`).
 */
export function mensajePushIncidente(inc, { chofer }) {
  const tipo = tipoIncidente(inc.tipo);
  const nombre = tipo?.texto || "Incidente";
  const titulo = `${tipo?.urgente ? "URGENTE · " : ""}${nombre}${
    inc.tipo === "retraso" && inc.retraso_min ? ` (${textoMinutos(inc.retraso_min)})` : ""
  }`;
  const partes = [chofer || "Un chofer", inc.rutas?.nombre, textoParada(inc.solicitudes_recoleccion)].filter(Boolean);
  const cuerpo = [partes.join(" · "), inc.descripcion].filter(Boolean).join(": ");
  return { titulo, cuerpo, datos: { tipo: "incidente", id: inc.id } };
}
