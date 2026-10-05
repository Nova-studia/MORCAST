/**
 * AVISOS A CLIENTES, sin base de datos (lógica pura, con pruebas en
 * tests/avisos.test.mjs).
 *
 * Pedido de los dueños (4-oct-2026): mandar notificaciones por sector, ruta o
 * a un cliente en específico cuando hay un retraso o se reagenda. SIN
 * WhatsApp: llegan por correo y se ven dentro del portal. Las del teléfono
 * vendrán con la app.
 *
 * Aquí viven las decisiones —qué se acepta, a quién le llega, cuándo deja de
 * verse— para que el panel, la acción del servidor y el portal digan lo
 * mismo. La acción (app/acciones-avisos.js) solo junta los datos y llama.
 * Sin imports de React ni de Supabase a propósito: así lo pueden importar las
 * pruebas de `node --test` y el servidor sin pasar por el empaquetador.
 */

/** Los tres motivos que acepta la base (db/023, avisos.motivo). */
export const MOTIVOS_AVISO = [
  { id: "retraso", texto: "Retraso" },
  { id: "reagenda", texto: "Reagenda" },
  { id: "general", texto: "Aviso general" },
];

/** A quién va dirigido. El orden es el del formulario. */
export const ALCANCES_AVISO = [
  { id: "todos", texto: "Todos" },
  { id: "sector", texto: "Sector" },
  { id: "ruta", texto: "Ruta" },
  { id: "cliente", texto: "Un cliente" },
];

export const MAX_TITULO = 120;
export const MAX_MENSAJE = 2000;

/** Días que un aviso sigue en el portal aunque no tenga fecha de vigencia. */
export const DIAS_EN_PORTAL = 30;

/**
 * Estados de cliente que reciben un aviso masivo (todos / sector / ruta).
 *
 * 'pendiente-info' SÍ: son clientes reales cargados del cuaderno de la
 * empresa (db/019) a los que solo les falta papeleo, y el camión sí les pasa.
 * 'suspendido' y 'baja' NO: no tienen servicio, así que un "la ruta va
 * tarde" les llega a quien no espera ningún camión. Si a uno de ellos hay
 * que decirle algo, se le manda con alcance "un cliente", que no filtra.
 */
export const ESTADOS_QUE_RECIBEN = ["activo", "pendiente-info"];

const CORREO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

export const textoMotivo = (id) => MOTIVOS_AVISO.find((m) => m.id === id)?.texto || "Aviso";

/** ¿Es un correo al que vale la pena intentar mandar? */
export function correoValido(correo) {
  return CORREO_RE.test(String(correo || "").trim());
}

/**
 * La fecha de HOY en Matamoros, como "2026-10-05".
 *
 * El servidor de Vercel corre en UTC: a las 7 de la tarde de Matamoros allá
 * ya es mañana, y un aviso "vigente hasta hoy" se rechazaría por "fecha del
 * pasado" justo en la tarde, que es cuando se avisan los retrasos.
 */
export function hoyMatamoros(ahora = new Date()) {
  return fechaEnMatamoros(ahora);
}

/** Fecha de calendario de un instante, vista desde Matamoros. */
export function fechaEnMatamoros(instante) {
  const d = instante instanceof Date ? instante : new Date(instante);
  if (Number.isNaN(d.getTime())) return "";
  // en-CA formatea como AAAA-MM-DD, que es justo lo que se compara.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Matamoros",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Limpia y valida lo que llega del formulario.
 *
 * Devuelve `{ ok: true, limpio }` o `{ ok: false, motivo }`. `exigirUuid` lo
 * pone el servidor cuando va contra la base: un id que no es UUID haría que
 * Postgres respondiera con un error en inglés que no le dice nada a nadie.
 * El modo prototipo usa claves de ejemplo ("RT-NORTE") y por eso no lo pide.
 */
export function validarAviso(datos = {}, { hoy = hoyMatamoros(), exigirUuid = false } = {}) {
  const motivo = String(datos.motivo || "general").trim();
  // El título va en el asunto del correo: un salto de línea ahí rompe la
  // cabecera, así que se aplana a un solo renglón.
  const titulo = String(datos.titulo || "").replace(/\s+/g, " ").trim();
  const mensaje = String(datos.mensaje || "").replace(/\r\n/g, "\n").trim();
  const vigenteHasta = String(datos.vigenteHasta || "").trim() || null;

  const a = validarAlcance(datos, { exigirUuid });
  if (!a.ok) return a;
  if (!MOTIVOS_AVISO.some((m) => m.id === motivo)) return { ok: false, motivo: "Elige el motivo del aviso." };

  if (titulo.length < 3) return { ok: false, motivo: "Escribe un título (al menos 3 letras)." };
  if (titulo.length > MAX_TITULO) return { ok: false, motivo: `El título es muy largo (máximo ${MAX_TITULO} caracteres).` };
  if (mensaje.length < 5) return { ok: false, motivo: "Escribe el mensaje para los clientes." };
  if (mensaje.length > MAX_MENSAJE) return { ok: false, motivo: `El mensaje es muy largo (máximo ${MAX_MENSAJE} caracteres).` };

  if (vigenteHasta) {
    if (!FECHA_RE.test(vigenteHasta) || Number.isNaN(new Date(`${vigenteHasta}T12:00:00`).getTime())) {
      return { ok: false, motivo: "La fecha de vigencia no es válida." };
    }
    // Un aviso que vence antes de mandarse nunca se vería en el portal.
    if (vigenteHasta < hoy) return { ok: false, motivo: "La vigencia no puede ser una fecha que ya pasó." };
  }

  return { ok: true, limpio: { ...a.limpio, motivo, titulo, mensaje, vigenteHasta } };
}

/**
 * Solo el "a quién": alcance y el id que le corresponde. Lo usa también la
 * vista previa ("¿a cuántos les llega?"), que se pide antes de escribir el
 * mensaje.
 */
export function validarAlcance(datos = {}, { exigirUuid = false } = {}) {
  const alcance = String(datos.alcance || "").trim();
  if (!ALCANCES_AVISO.some((a) => a.id === alcance)) return { ok: false, motivo: "Elige a quién va dirigido el aviso." };

  // Solo se conserva el id que corresponde al alcance. La base exige que
  // "todos" no traiga ninguno (db/023), y un sector que se quedó puesto de
  // antes de cambiar a "ruta" no tiene por qué viajar.
  const id = { sector: datos.sectorId, ruta: datos.rutaId, cliente: datos.clienteId }[alcance];
  const idLimpio = id == null ? "" : String(id).trim();
  if (alcance !== "todos") {
    if (!idLimpio) {
      const falta = { sector: "el sector", ruta: "la ruta", cliente: "el cliente" }[alcance];
      return { ok: false, motivo: `Elige ${falta} al que va el aviso.` };
    }
    if (exigirUuid && !UUID_RE.test(idLimpio)) return { ok: false, motivo: "Ese destino no existe. Recarga la página y vuelve a elegirlo." };
  }

  return {
    ok: true,
    limpio: {
      alcance,
      sectorId: alcance === "sector" ? idLimpio : null,
      rutaId: alcance === "ruta" ? idLimpio : null,
      clienteId: alcance === "cliente" ? idLimpio : null,
    },
  };
}

/** Lo validado → la fila de `avisos` tal como la pide la base. */
export function filaAviso(limpio) {
  return {
    titulo: limpio.titulo,
    mensaje: limpio.mensaje,
    motivo: limpio.motivo,
    alcance: limpio.alcance,
    sector_id: limpio.sectorId,
    ruta_id: limpio.rutaId,
    cliente_id: limpio.clienteId,
    vigente_hasta: limpio.vigenteHasta,
  };
}

/**
 * A quién le llega un aviso.
 *
 * Recibe las filas tal como salen de la base:
 *   clientes      [{ id, empresa, correo, estado }]
 *   domicilios    [{ cliente_id, sector_id }]
 *   suscripciones [{ cliente_id, ruta_id, estado }]
 *
 * Es el MISMO criterio que usa el portal para enseñarlo (db/023:
 * mis_sectores, mis_rutas), con una diferencia a propósito: por ruta solo
 * cuentan las suscripciones ACTIVAS. Un servicio pausado o cancelado no
 * espera camión, y mandarle "la ruta va tarde" sería ruido. En su portal sí
 * lo verá, porque la base no distingue; es un aviso de más, no de menos.
 *
 * Devuelve:
 *   clientes  → las empresas a las que va (sin repetir)
 *   correos   → un envío por correo distinto, con la empresa para el saludo.
 *               Si dos empresas comparten correo (pasa: el mismo encargado
 *               de compras en dos razones sociales), se manda UNA vez.
 *   sinCorreo → las que solo lo verán en el portal
 */
export function calcularDestinatarios(limpio, { clientes = [], domicilios = [], suscripciones = [] } = {}) {
  let elegidos;
  if (limpio.alcance === "cliente") {
    // Elegido a mano: no se filtra por estado. Si el admin escogió a un
    // suspendido es porque le quiere decir algo justo a él.
    elegidos = clientes.filter((c) => c.id === limpio.clienteId);
  } else {
    let ids = null; // null = todos
    if (limpio.alcance === "sector") {
      ids = new Set(domicilios.filter((d) => d.sector_id === limpio.sectorId).map((d) => d.cliente_id));
    } else if (limpio.alcance === "ruta") {
      ids = new Set(
        suscripciones
          .filter((s) => s.ruta_id === limpio.rutaId && (s.estado ?? "activa") === "activa")
          .map((s) => s.cliente_id)
      );
    }
    elegidos = clientes.filter(
      (c) => ESTADOS_QUE_RECIBEN.includes(c.estado ?? "activo") && (ids === null || ids.has(c.id))
    );
  }

  const vistos = new Set();
  const unicos = elegidos.filter((c) => (vistos.has(c.id) ? false : vistos.add(c.id)));

  const correos = [];
  const sinCorreo = [];
  const correosVistos = new Set();
  for (const c of unicos) {
    const correo = String(c.correo || "").trim().toLowerCase();
    if (!correoValido(correo)) {
      sinCorreo.push(c);
      continue;
    }
    if (correosVistos.has(correo)) continue;
    correosVistos.add(correo);
    correos.push({ correo, empresa: c.empresa || "", clienteId: c.id });
  }

  return { clientes: unicos, correos, sinCorreo };
}

/** Las tres cifras que se enseñan antes de mandar. */
export function resumenDestinatarios(d) {
  return { clientes: d.clientes.length, correos: d.correos.length, sinCorreo: d.sinCorreo.length };
}

/**
 * La frase de la vista previa: "Le llegará a 12 clientes: 10 correos…".
 * En la pantalla y no en el servidor, pero aquí para poder probarla: con
 * plurales a mano es facilísimo dejar un "1 clientes".
 */
export function fraseResumen({ clientes, correos, sinCorreo }) {
  const pl = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
  if (!clientes) return "Ningún cliente cae en este alcance: el aviso no le llegaría a nadie.";
  let frase = `Le llegará a ${pl(clientes, "cliente", "clientes")}: ${pl(correos, "correo", "correos")}`;
  if (sinCorreo) {
    frase += ` y ${pl(sinCorreo, "cliente sin correo", "clientes sin correo")}, que solo ${sinCorreo === 1 ? "lo verá" : "lo verán"} en su portal`;
  }
  return `${frase}.`;
}

/**
 * ¿Se enseña en el portal?
 *
 * Vigente = sin fecha de vigencia o con una de hoy en adelante, Y mandado en
 * los últimos 30 días. El tope de 30 días es para los que se mandaron sin
 * fecha: sin él, "Hoy la ruta va tarde" se quedaría arriba del portal para
 * siempre.
 */
export function avisoVigente(aviso, { hoy = hoyMatamoros(), ahora = new Date() } = {}) {
  if (!aviso) return false;
  if (aviso.vigente_hasta && aviso.vigente_hasta < hoy) return false;
  const creado = new Date(aviso.creado);
  if (Number.isNaN(creado.getTime())) return false;
  const limite = ahora.getTime() - DIAS_EN_PORTAL * 24 * 60 * 60 * 1000;
  return creado.getTime() >= limite;
}

/** Los que el cliente no ha cerrado en esta sesión del navegador. */
export function sinOcultos(avisos, ocultos) {
  const set = new Set(ocultos || []);
  return (avisos || []).filter((a) => !set.has(a.id));
}

/**
 * Cómo se lee el alcance en el historial: "Ruta Norte", "Sector A",
 * "Industrias del Golfo"… Recibe la fila con sus relaciones ya traídas.
 */
export function textoAlcance(aviso) {
  switch (aviso?.alcance) {
    case "todos": return "Todos los clientes";
    case "sector": return aviso.sectores?.nombre || "Un sector";
    case "ruta": return aviso.rutas?.nombre || "Una ruta";
    case "cliente": return aviso.clientes?.empresa || "Un cliente";
    default: return "—";
  }
}

/**
 * Minutos → como lo diría una persona: "40 minutos", "hora y media",
 * "3 horas". Desde 90 minutos se redondea a la media hora: "un retraso de
 * 137 minutos" suena a cronómetro, no a aviso.
 */
export function duracionEnLetra(minutos) {
  const min = Math.round(Number(minutos));
  if (!Number.isFinite(min) || min <= 0) return "";
  if (min < 90) return `${min} ${min === 1 ? "minuto" : "minutos"}`;
  const medias = Math.round(min / 30);
  const horas = Math.floor(medias / 2);
  const yMedia = medias % 2 === 1;
  if (horas === 1) return yMedia ? "hora y media" : "1 hora";
  return yMedia ? `${horas} horas y media` : `${horas} horas`;
}

/**
 * El borrador que se arma al pulsar "Avisar a los clientes de esta ruta"
 * desde un incidente de retraso. Es un punto de partida: el admin lo corrige
 * antes de mandarlo, por eso no promete una hora exacta.
 */
export function borradorRetraso({ rutaNombre, minutos } = {}) {
  const ruta = String(rutaNombre || "").trim() || "tu ruta";
  const min = Number(minutos);
  const cuanto = Number.isFinite(min) && min > 0 ? ` de aproximadamente ${duracionEnLetra(min)}` : "";
  return {
    titulo: `Retraso en ${ruta}`,
    mensaje:
      `Hoy ${ruta} trae un retraso${cuanto}. Tu recolección sigue en pie: ` +
      `el camión pasará en cuanto se libere. Gracias por tu paciencia.\n\n` +
      `Si necesitas algo, llámanos al 868 384 9478.`,
  };
}

/**
 * "Leído por 3 de 12": cuántas cuentas de cliente tocaron "Enterado" en la
 * app (`avisos_lecturas`, db/026) contra cuántas le tocaba recibirlo.
 *
 * `usuariosDestino` se guarda AL MANDAR (las cuentas de cliente activas de
 * esas empresas en ese momento): null en los avisos de antes de la app 1.1,
 * y ahí solo se dice cuántos lo leyeron. `leidos` null = no se pudo saber
 * (la migración 026 sin correr): se enseña una raya, no un cero que mienta.
 */
export function fraseLecturas({ leidos, usuariosDestino } = {}) {
  if (leidos == null) return "—";
  const x = Number(leidos) || 0;
  if (usuariosDestino == null) return x ? `Leído por ${x}` : "Sin lecturas";
  const y = Number(usuariosDestino) || 0;
  if (!y && !x) return "Nadie con cuenta";
  // Una empresa pudo dar de alta a alguien después de mandarse el aviso: si
  // lee, cuenta, aunque pase del total que había al mandar.
  return `Leído por ${x} de ${Math.max(x, y)}`;
}

/** "3 notificaciones" / "1 notificación": con plurales a mano es fácil un "1 notificaciones". */
export function textoNotificaciones(n) {
  const k = Number(n) || 0;
  return `${k} ${k === 1 ? "notificación" : "notificaciones"}`;
}
