/**
 * LA OFICINA PROGRAMA RECOLECCIONES DESDE LA APP — las decisiones, sin base
 * de datos (6-oct-2026, paridad de la app con /admin/recolecciones).
 *
 * En la web, el NOMBRE de la acción para la bitácora (confirmar, reagendar
 * una vencida, cambiar una confirmada) lo decide la pantalla. Desde la app
 * no se le cree al teléfono: lo decide el servidor con la recolección como
 * está en la base, con estas mismas reglas. Así la bitácora sigue pudiendo
 * contestar "¿cuántas se reagendaron porque se nos pasaron?" aunque el
 * cambio venga del teléfono.
 *
 * También vive aquí lo que dice la notificación al CHOFER cuando le ponen,
 * le cambian o le quitan una parada: antes solo le llegaba un correo, y
 * Luis tuvo que recargar la ruta a mano para ver la parada nueva.
 *
 * Lógica pura (tests/oficina-recolecciones.test.mjs). Lo que toca la base y
 * manda está en lib/recolecciones-oficina.js.
 */
import { estadoVencimiento } from "./vencimiento.js";
import { fechaCorta } from "./aviso-cliente.mjs";

export const ESTADOS_FINALES = ["completada", "rechazada", "no-procedio"];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const HORA_RE = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

export const MAX_MOTIVO_RECHAZO = 300;
export const MOTIVO_RECHAZO_POR_OMISION = "Sin cupo en la ruta.";

/** La fila de la base (snake_case) en la forma que entiende lib/vencimiento.js. */
const aVencimiento = (fila) => ({
  estado: fila?.estado,
  fechaConfirmada: fila?.fecha_confirmada ?? fila?.fechaConfirmada ?? null,
  fechaPedida: fila?.fecha_pedida ?? fila?.fechaPedida ?? null,
});

/** ¿Es una fecha de calendario real? ("2026-02-30" no lo es.) */
export function esFechaValida(iso) {
  const m = FECHA_RE.exec(String(iso || ""));
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

/** "2026-10-06" + n días, sin pasar por la zona horaria. */
export function sumarDias(iso, n) {
  const m = FECHA_RE.exec(String(iso || ""));
  if (!m) return "";
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + n));
  return d.toISOString().slice(0, 10);
}

/**
 * ¿Qué acción es programar ESTA recolección, como está en la base?
 *
 *   · vencida (sigue abierta y su día ya pasó) → reagendar_recoleccion_vencida
 *   · solicitada                               → confirmar_recoleccion
 *   · confirmada                               → cambiar_recoleccion_confirmada
 *   · en ruta, sin vencer                      → NO: el chofer ya la tomó y
 *     moverla le cambiaría la parada en la mano (igual que la web, que solo
 *     ofrece "Cambiar" mientras está confirmada).
 *   · completada, rechazada, no procedió       → NO: ya está cerrada.
 *
 * @returns {{ ok: true, accion: string } | { ok: false, status: number, motivo: string }}
 */
export function accionDeProgramacion(fila, hoy) {
  if (!fila) return { ok: false, status: 404, motivo: "Esa recolección no existe." };
  if (ESTADOS_FINALES.includes(fila.estado)) {
    return { ok: false, status: 409, motivo: "Esa recolección ya está cerrada: no se puede programar otra vez." };
  }
  if (estadoVencimiento(aVencimiento(fila), hoy).vencida) return { ok: true, accion: "reagendar_recoleccion_vencida" };
  if (fila.estado === "solicitada") return { ok: true, accion: "confirmar_recoleccion" };
  if (fila.estado === "confirmada") return { ok: true, accion: "cambiar_recoleccion_confirmada" };
  if (fila.estado === "en-ruta") {
    return { ok: false, status: 409, motivo: "El chofer ya la tomó (va en ruta): ya no se le cambia el día ni el chofer." };
  }
  return { ok: false, status: 409, motivo: "Esa recolección no se puede programar en su estado actual." };
}

/**
 * ¿Se puede rechazar? Lo mismo que ofrece la web: una solicitud sin
 * confirmar, o una vencida que no se va a reagendar. Una confirmada al día
 * no se rechaza: se cambia.
 */
export function puedeRechazar(fila, hoy) {
  if (!fila || ESTADOS_FINALES.includes(fila.estado)) return false;
  return fila.estado === "solicitada" || estadoVencimiento(aVencimiento(fila), hoy).vencida;
}

/**
 * Lo que manda la app al programar → los cambios para la base.
 *
 * El día es obligatorio y de hoy en adelante (hoy en Matamoros): reagendar
 * una vencida para un día que ya pasó la dejaría vencida otra vez y el
 * correo al cliente saldría con esa fecha. Hasta un año adelante; más es un
 * dedazo. Hora y chofer son opcionales: "sin hora" y "el de la ruta" son
 * respuestas válidas, igual que en la web (van null, no a medio llenar).
 *
 * @returns {{ ok: true, cambios: object } | { ok: false, motivo: string }}
 */
export function validarProgramacion({ fecha, hora, chofer_id } = {}, hoy) {
  const f = String(fecha || "").trim();
  if (!esFechaValida(f)) return { ok: false, motivo: "Elige el día de la recolección." };
  if (hoy && f < hoy) return { ok: false, motivo: "Ese día ya pasó: elige de hoy en adelante." };
  if (hoy && f > sumarDias(hoy, 366)) return { ok: false, motivo: "Esa fecha está a más de un año." };

  const h = String(hora || "").trim();
  if (h && !HORA_RE.test(h)) return { ok: false, motivo: "La hora debe ir como 09:30 (24 horas)." };

  const c = String(chofer_id || "").trim().toLowerCase();
  if (c && !UUID_RE.test(c)) return { ok: false, motivo: "Ese chofer no es válido." };

  return {
    ok: true,
    cambios: {
      estado: "confirmada",
      fecha_confirmada: f,
      hora_confirmada: h ? h.slice(0, 5) : null,
      chofer_id: c || null,
    },
  };
}

/** El motivo del rechazo, limpio. Vacío → el de siempre de la web. */
export function motivoDeRechazo(texto) {
  const limpio = String(texto ?? "").replace(/\s+/g, " ").trim();
  if (!limpio) return { ok: true, motivo: MOTIVO_RECHAZO_POR_OMISION };
  if (limpio.length > MAX_MOTIVO_RECHAZO) {
    return { ok: false, motivo: `El motivo es muy largo (máximo ${MAX_MOTIVO_RECHAZO} caracteres).` };
  }
  return { ok: true, motivo: limpio };
}

/* ------------------------------------------------------------------ */
/* El chofer                                                           */
/* ------------------------------------------------------------------ */

/** El chofer que hace la parada: el asignado a ella o, si no hay, el de su ruta. */
export function choferDeParada(fila) {
  return fila?.chofer_id || fila?.rutas?.chofer_id || null;
}

/**
 * A qué choferes avisar después de confirmar o cambiar una parada.
 *
 *   · al que la tiene ahora: "asignada" si es nueva para él (primera
 *     confirmación o se la pasaron de otro), "cambiada" si ya era suya y
 *     cambió el día o la hora;
 *   · al que la tenía antes, si era otro y la parada ya estaba en su ruta
 *     (confirmada o en ruta): "quitada", para que no vaya por ella. También
 *     cuando la oficina RECHAZA una vencida que ya estaba en su ruta.
 *
 * `antes` es la fila ANTES del cambio (o null si no se pudo leer).
 * @returns {Array<{ uid: string, evento: "asignada"|"cambiada"|"quitada" }>}
 */
export function choferesPorAvisar(antes, despues) {
  // Una rechazada ya no es de nadie: solo se le avisa al que la tenía.
  const nuevo = despues?.estado === "confirmada" ? choferDeParada(despues) : null;
  const yaEstaba = Boolean(antes && ["confirmada", "en-ruta"].includes(antes.estado));
  const anterior = yaEstaba ? choferDeParada(antes) : null;
  const lista = [];
  if (nuevo) lista.push({ uid: nuevo, evento: yaEstaba && anterior === nuevo ? "cambiada" : "asignada" });
  if (anterior && anterior !== nuevo) lista.push({ uid: anterior, evento: "quitada" });
  return lista;
}

/**
 * La notificación al teléfono del chofer. Al tocarla, la app abre su ruta
 * y la vuelve a leer (`datos.tipo = "parada"`).
 */
export function mensajePushParada(evento, { id, folio, cliente, fecha, hora } = {}) {
  const cuando = [fechaCorta(fecha), hora ? `a las ${String(hora).slice(0, 5)}` : ""].filter(Boolean).join(" ");
  const quien = cliente || "un cliente";
  const datos = { tipo: "parada", id: id ?? null, folio: folio ?? null, evento };
  if (evento === "quitada") {
    return {
      titulo: "Te quitaron una parada",
      cuerpo: `${quien}${cuando ? ` (${cuando})` : ""} ya no va en tu ruta. Folio ${folio || "—"}.`,
      datos,
    };
  }
  if (evento === "cambiada") {
    return {
      titulo: "Cambió una de tus paradas",
      cuerpo: `${quien}: ahora ${cuando || "con otro horario"}. Folio ${folio || "—"}.`,
      datos,
    };
  }
  return {
    titulo: "Parada nueva",
    cuerpo: `${quien}${cuando ? `, el ${cuando}` : ""}. Folio ${folio || "—"}.`,
    datos,
  };
}
