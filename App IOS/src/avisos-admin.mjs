/**
 * AVISOS A CLIENTES DESDE LA APP DE ADMINISTRACIÓN — lógica pura.
 *
 * ESPEJO de `Web/lib/avisos.mjs` (las partes que usa el formulario): qué se
 * acepta, la frase de "a cuántos les llega", cómo se lee el historial. Así
 * la app rechaza lo mismo que el servidor ANTES de gastar señal, y dice las
 * cosas con las mismas palabras que el panel web. El que manda de verdad
 * sigue siendo el servidor (/api/app/avisos/mandar), que vuelve a validar.
 *
 * Las pruebas comparan esta copia con la web. Al cambiar allá, copiar aquí
 * (y en la otra app).
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * La fecha de HOY en Matamoros ("2026-10-06"). Si el motor no trae zonas
 * horarias, la fecha local del teléfono: quien usa la app está en Matamoros.
 * Nunca `toISOString()`, que a las 7 de la tarde ya dice "mañana".
 */
export function hoyMatamoros(ahora = new Date()) {
  try {
    const f = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Matamoros", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(ahora);
    // Un motor sin el formato de en-CA devuelve "10/6/2026": no sirve.
    if (FECHA_RE.test(f)) return f;
  } catch {
    /* sin zonas horarias: abajo */
  }
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`;
}

export const textoMotivo = (id) => MOTIVOS_AVISO.find((m) => m.id === id)?.texto || "Aviso";

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


/* ------------------------------------------------------------------ */
/* Solo de la app                                                      */
/* ------------------------------------------------------------------ */

/**
 * El "id de envío" del aviso: un UUID v4 que se genera al CONFIRMAR y viaja
 * con la petición. Si la señal se cae a media espera (mandar tarda ~24 s) y
 * se reintenta, el servidor reconoce el mismo id y contesta que ya salió en
 * vez de mandarlo otra vez (lib/avisos-envio.mjs). No es un secreto: basta
 * con que no se repita, y Math.random alcanza para eso.
 */
export function nuevoIdEnvio(azar = Math.random) {
  const h = [];
  for (let i = 0; i < 32; i++) h.push(Math.floor(azar() * 16));
  h[12] = 4;
  h[16] = (h[16] & 0x3) | 0x8;
  const x = h.map((n) => n.toString(16)).join("");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

/**
 * Cuánto se tarda en mandar, en segundos, para la barra de avance: un correo
 * cada ~0.55 s en el servidor (PAUSA_ENTRE_CORREOS_MS) más unos segundos de
 * guardar y avisar a los teléfonos. Es una estimación para que la espera no
 * parezca colgada, no una promesa.
 */
export function segundosEstimados(correos) {
  const n = Math.max(0, Number(correos) || 0);
  return Math.max(4, Math.ceil(n * 0.6) + 3);
}

/** Lo que se le dice al admin cuando el aviso terminó, en un solo párrafo. */
export function textoResultado(r) {
  const pl = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
  if (r?.yaEnviado) {
    return "Este aviso ya se había mandado (la señal se cortó antes de recibir la respuesta). No se volvió a mandar.";
  }
  const clientes = pl(r?.resumen?.clientes ?? 0, "cliente", "clientes");
  let t;
  if (r?.sinResend) {
    t = `Ya aparece en el portal de ${clientes}, pero NO salió ningún correo: falta configurar el envío de correos.`;
  } else {
    t = `Ya aparece en el portal de ${clientes}. Correos enviados: ${r?.enviados ?? 0}.`;
    if (r?.resumen?.sinCorreo) t += ` Sin correo (solo portal): ${r.resumen.sinCorreo}.`;
  }
  t += ` ${textoNotificaciones(r?.notificaciones)} ${(r?.notificaciones ?? 0) === 1 ? "enviada" : "enviadas"} a la app.`;
  if (r?.fallidos?.length) {
    t += ` No salió el correo a: ${r.fallidos.join(", ")} (sí lo ven en su portal).`;
  }
  return t;
}
