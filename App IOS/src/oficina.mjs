/**
 * LA OFICINA EN EL TELÉFONO — lógica pura (6-oct-2026, paridad de la app de
 * administración con /admin/recolecciones y /admin/incidentes).
 *
 * 1. VENCIMIENTO: copia de `Web/lib/vencimiento.js` (cuál recolección se
 *    pasó de fecha, de quién fue la falla, el orden por urgencia y los días
 *    que se le ofrecen para reagendar). Las pruebas la comparan contra la
 *    web: si allá cambia una regla, aquí truena. Al tocar una, tocar la otra.
 * 2. QUÉ SE PUEDE HACER con cada recolección (confirmar, reagendar, cambiar,
 *    rechazar). El servidor lo vuelve a decidir con la base
 *    (Web/lib/oficina-recolecciones.mjs); aquí solo es para enseñar los
 *    botones correctos.
 * 3. LA BANDEJA DE INCIDENTES: orden, filtros y la nota obligatoria, igual
 *    que `Web/app/(admin)/admin/incidentes/bandeja.mjs`.
 *
 * ⚠️ ESTE ARCHIVO ESTÁ DUPLICADO en la otra app (`App Android/src/oficina.js`,
 * misma lógica; solo cambia la extensión de los imports). Sin React ni
 * Supabase, para probarlo con `node --test`.
 */
import { TIPOS_INCIDENTE } from "./chofer-reportes.mjs";

/* ==================================================================== */
/* 1. VENCIMIENTO (espejo de Web/lib/vencimiento.js)                    */
/* ==================================================================== */

/** Hoy en AAAA-MM-DD, armado con la fecha LOCAL (no UTC, que corre el día). */
export function hoyISO(ahora = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${ahora.getFullYear()}-${p(ahora.getMonth() + 1)}-${p(ahora.getDate())}`;
}

/** Días de diferencia entre dos fechas de calendario (b − a). */
export function diasEntre(aISO, bISO) {
  const [a1, a2, a3] = String(aISO).split("-").map(Number);
  const [b1, b2, b3] = String(bISO).split("-").map(Number);
  if (!a1 || !b1) return 0;
  // Mediodía en las dos: así ningún cambio de horario de verano convierte
  // una diferencia de 1 día en 0.96 y la redondea mal.
  const a = new Date(a1, a2 - 1, a3, 12);
  const b = new Date(b1, b2 - 1, b3, 12);
  return Math.round((b - a) / 86400000);
}

const FINALES = new Set(["completada", "rechazada", "no-procedio"]);

const POR_ESTADO = {
  solicitada: {
    tipo: "sin-atender",
    texto: "Sin atender",
    detalle: "Se pidió para este día y nadie la atendió.",
  },
  confirmada: {
    tipo: "incumplida",
    texto: "No se cumplió",
    detalle: "Ya estaba confirmada para este día y no se registró el servicio.",
  },
  "en-ruta": {
    tipo: "sin-cerrar",
    texto: "Sin cerrar",
    detalle: "El chofer la tomó y no la cerró. Revisa si el servicio se hizo.",
  },
};

/** La fecha que vale: la acordada si ya hay una; si no, la que pidió el cliente. */
export function fechaEfectiva(s) {
  return s?.fechaConfirmada || s?.fechaPedida || null;
}

/** ¿Se pasó? `{ vencida, tipo?, texto?, detalle?, dias?, fecha? }` como la web. */
export function estadoVencimiento(s, hoy = hoyISO()) {
  const fecha = fechaEfectiva(s);
  if (!fecha || FINALES.has(s?.estado)) return { vencida: false };

  const dias = diasEntre(fecha, hoy);
  if (dias <= 0) return { vencida: false, dias, fecha };

  const info = POR_ESTADO[s.estado];
  if (!info) return { vencida: false, dias, fecha };

  return { vencida: true, dias, fecha, ...info };
}

/** "1 día", "3 días". */
export function textoAtraso(dias) {
  return dias === 1 ? "1 día" : `${dias} días`;
}

/**
 * Orden por urgencia: vencidas (la más atrasada primero), luego las que
 * vienen (la más próxima primero) y al final las cerradas (lo más reciente).
 */
export function ordenarPorUrgencia(lista, hoy = hoyISO()) {
  const rango = (s) => {
    if (FINALES.has(s.estado)) return 2;
    return estadoVencimiento(s, hoy).vencida ? 0 : 1;
  };
  return [...lista].sort((a, b) => {
    const ra = rango(a);
    const rb = rango(b);
    if (ra !== rb) return ra - rb;
    const fa = fechaEfectiva(a) || "";
    const fb = fechaEfectiva(b) || "";
    if (ra === 2) return fa < fb ? 1 : fa > fb ? -1 : 0;
    return fa < fb ? -1 : fa > fb ? 1 : 0;
  });
}

// La base guarda los días CON acento ("miércoles", "sábado"). Sin quitarlo,
// una ruta de miércoles nunca ofrecía "Próximo día de su ruta" (pasaba en la
// web hasta el 6-oct-2026). Sin \p{M}: Hermes no lo garantiza.
const SIN_ACENTO = { á: "a", é: "e", í: "i", ó: "o", ú: "u", ü: "u" };
const pelar = (t) => String(t || "").toLowerCase().trim().replace(/[áéíóúü]/g, (c) => SIN_ACENTO[c]);

/**
 * Atajos de fecha para confirmar o reagendar: HOY y MAÑANA (recolección
 * extra) y EL PRÓXIMO DÍA DE SU RUTA (cuando el camión ya va a pasar). El
 * sistema no sabe cuántas paradas caben en un camión: propone, no decide.
 */
export function opcionesReagenda(diasDeRuta, hoy = hoyISO(), cuantas = 3) {
  const nombres = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
  const dias = Array.isArray(diasDeRuta) ? diasDeRuta.map(pelar) : [];
  const [a, m, d] = hoy.split("-").map(Number);
  const p = (n) => String(n).padStart(2, "0");
  const aISO = (f) => `${f.getFullYear()}-${p(f.getMonth() + 1)}-${p(f.getDate())}`;

  const opciones = [
    { id: "hoy", texto: "Hoy", fecha: hoy, extra: true },
    { id: "manana", texto: "Mañana", fecha: aISO(new Date(a, m - 1, d + 1, 12)), extra: true },
  ];
  if (dias.length) {
    for (let i = 1; i <= 21; i++) {
      const f = new Date(a, m - 1, d + i, 12);
      if (dias.includes(nombres[f.getDay()])) {
        const iso = aISO(f);
        if (!opciones.some((o) => o.fecha === iso)) {
          opciones.push({ id: "ruta", texto: "Próximo día de su ruta", fecha: iso, extra: false });
        }
        break;
      }
    }
  }
  return opciones.slice(0, cuantas);
}

/* ==================================================================== */
/* 2. RECOLECCIONES: qué se puede hacer y con qué datos                 */
/* ==================================================================== */

/**
 * Qué botones lleva una recolección (las mismas reglas que el servidor):
 *   · `programar`: "confirmar" (solicitada), "reagendar" (vencida) o
 *     "cambiar" (confirmada al día). En ruta sin vencer no se toca: el
 *     chofer ya la tomó.
 *   · `rechazar`: solo una solicitada o una vencida.
 */
export function queSePuede(s, hoy = hoyISO()) {
  if (!s || FINALES.has(s.estado)) return { programar: null, rechazar: false };
  const vencida = estadoVencimiento(s, hoy).vencida;
  const programar = vencida
    ? "reagendar"
    : s.estado === "solicitada"
      ? "confirmar"
      : s.estado === "confirmada"
        ? "cambiar"
        : null;
  return { programar, rechazar: vencida || s.estado === "solicitada" };
}

/** El texto del botón principal. */
export const TEXTO_PROGRAMAR = {
  confirmar: "Confirmar",
  reagendar: "Reagendar y confirmar",
  cambiar: "Guardar cambios",
};

/**
 * Con qué arranca el formulario. Si se VENCIÓ, el día por omisión es HOY y
 * no el que se pasó (si no, "Reagendar" sin tocar nada la volvería a poner
 * en un día que ya pasó). Al cambiar una confirmada se parte de lo acordado.
 */
export function planPorOmision(s, hoy = hoyISO()) {
  const vencida = estadoVencimiento(s, hoy).vencida;
  const fecha = vencida ? hoy : s?.fechaConfirmada || s?.fechaPedida || hoy;
  return {
    // Una fecha pedida que ya pasó (pero sin vencer, p. ej. hoy) se respeta;
    // una anterior a hoy nunca se propone.
    fecha: fecha < hoy ? hoy : fecha,
    hora: s?.horaConfirmada ? String(s.horaConfirmada).slice(0, 5) : "",
    choferId: s?.choferId || "",
  };
}

/** "9:30", "0930", "09:30:00" → "09:30". Vacío = sin hora. */
export function normalizarHora(texto) {
  const t = String(texto ?? "").trim();
  if (!t) return { ok: true, hora: "" };
  const m = /^(\d{1,2}):?(\d{2})(?::\d{2})?$/.exec(t);
  if (!m) return { ok: false, motivo: "Escribe la hora como 09:30 (24 horas)." };
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return { ok: false, motivo: "Esa hora no existe. Usa 24 horas: 00:00 a 23:59." };
  return { ok: true, hora: `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}` };
}

/** Atajos de hora (la operación arranca temprano). */
export const HORAS_RAPIDAS = ["08:00", "10:00", "12:00", "14:00", "16:00"];

/**
 * Filtros de la lista, como la web: Todas, Vencidas y uno por estado.
 * `estados` = ESTADOS_SOLICITUD_REC (rutas-datos.js).
 */
export function filtrarRecolecciones(lista, filtro, hoy = hoyISO()) {
  const l = lista || [];
  if (filtro === "todas") return l;
  if (filtro === "vencidas") return l.filter((s) => estadoVencimiento(s, hoy).vencida);
  return l.filter((s) => s.estado === filtro);
}

/**
 * Quién va (o fue) por ella. En una COMPLETADA manda quien la cerró
 * (`recolecciones.operador_id`): Luis vio el 6-oct-2026 una completada que
 * decía "Marco Antonio", el de la ruta, y la había hecho José Medina. Si no,
 * el asignado a la parada y al final el de la ruta.
 */
export function choferQueVa(s) {
  if (s?.estado === "completada" && s?.operadorReal) return { nombre: s.operadorReal, de: "lo hizo" };
  if (s?.choferAsignado) return { nombre: s.choferAsignado, de: "asignado" };
  if (s?.choferRuta) return { nombre: s.choferRuta, de: "de la ruta" };
  return { nombre: "", de: "sin chofer" };
}

/* --- Calendario del mes, sin dependencias nativas ------------------- */

export const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
  "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

/**
 * Las semanas de un mes para pintar el calendario: filas de 7 casillas
 * (lunes a domingo), con `null` en los huecos. `mes0` va de 0 a 11.
 */
export function semanasDelMes(año, mes0) {
  const p = (n) => String(n).padStart(2, "0");
  const primero = new Date(año, mes0, 1, 12);
  const total = new Date(año, mes0 + 1, 0, 12).getDate();
  // getDay(): 0 = domingo. La semana mexicana del calendario empieza en lunes.
  const hueco = (primero.getDay() + 6) % 7;
  const casillas = [];
  for (let i = 0; i < hueco; i++) casillas.push(null);
  for (let d = 1; d <= total; d++) casillas.push(`${año}-${p(mes0 + 1)}-${p(d)}`);
  while (casillas.length % 7) casillas.push(null);
  const semanas = [];
  for (let i = 0; i < casillas.length; i += 7) semanas.push(casillas.slice(i, i + 7));
  return semanas;
}

/** "2026-10-08" → "jue 8 oct". */
export function fechaCortaDia(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  if (!m) return "—";
  const f = new Date(+m[1], +m[2] - 1, +m[3], 12);
  return `${DIAS_CORTOS[f.getDay()]} ${+m[3]} ${MESES_LARGOS[+m[2] - 1].slice(0, 3)}`;
}

/* ==================================================================== */
/* 3. BANDEJA DE INCIDENTES (espejo de admin/incidentes/bandeja.mjs)     */
/* ==================================================================== */

const TONO = { accidente: "urgente", retraso: "alerta", "falla-mecanica": "alerta" };
const TEXTO_CORTO = {
  "contenedor-movido": "Contenedor movido",
  "contenedor-no-esta": "Contenedor no está",
  otro: "Otro",
};
export const TIPOS_BANDEJA = TIPOS_INCIDENTE.map((t) => ({
  id: t.id,
  texto: TEXTO_CORTO[t.id] || t.texto,
  tono: TONO[t.id] || "neutro",
}));

export const MAX_NOTA_ATENCION = 1000;

export function infoTipoIncidente(id) {
  return TIPOS_BANDEJA.find((t) => t.id === id) || { id, texto: id || "—", tono: "neutro" };
}

/** Abiertos / atendidos / todos. */
export function filtrarIncidentes(lista, estado = "abiertos") {
  return (lista || []).filter((i) => {
    if (estado === "abiertos") return i.estado === "abierto";
    if (estado === "atendidos") return i.estado === "atendido";
    return true;
  });
}

/** Lo abierto arriba y, de eso, los accidentes primero; luego lo más nuevo. */
export function ordenarBandeja(lista) {
  const peso = (i) => (i.estado === "abierto" ? (i.tipo === "accidente" ? 0 : 1) : 2);
  return [...(lista || [])].sort((a, b) => {
    const p = peso(a) - peso(b);
    if (p) return p;
    return new Date(b.creado).getTime() - new Date(a.creado).getTime();
  });
}

export function contarIncidentes(lista) {
  const l = lista || [];
  return {
    todos: l.length,
    abiertos: l.filter((i) => i.estado === "abierto").length,
    atendidos: l.filter((i) => i.estado === "atendido").length,
    urgentes: l.filter((i) => i.estado === "abierto" && i.tipo === "accidente").length,
  };
}

/** La nota al marcar atendido es OBLIGATORIA: es lo único que dice qué se hizo. */
export function validarAtencion(nota) {
  const limpia = String(nota || "").trim();
  if (limpia.length < 3) return { ok: false, motivo: "Escribe qué se hizo (al menos unas palabras)." };
  if (limpia.length > MAX_NOTA_ATENCION) {
    return { ok: false, motivo: `La nota es muy larga (máximo ${MAX_NOTA_ATENCION} caracteres).` };
  }
  return { ok: true, nota: limpia };
}

/** "5 oct 2026 · 14:32", en hora de Matamoros. */
export function fechaHoraMatamoros(iso) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return "—";
  try {
    const partes = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Matamoros",
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hour12: false,
      }).formatToParts(d).map((x) => [x.type, x.value])
    );
    const hora = `${partes.hour === "24" ? "00" : partes.hour}:${partes.minute}`;
    return `${+partes.day} ${MESES_LARGOS[+partes.month - 1].slice(0, 3)} ${partes.year} · ${hora}`;
  } catch {
    // Sin zonas horarias en el motor: la hora del teléfono, que en
    // Matamoros es la misma.
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getDate()} ${MESES_LARGOS[d.getMonth()].slice(0, 3)} ${d.getFullYear()} · ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
}

/** Enlace a Google Maps solo si hay coordenadas de verdad (si no, iría al océano). */
export function enlaceMapaIncidente(ubicacion) {
  const lat = Number(ubicacion?.lat);
  const lng = Number(ubicacion?.lng);
  if (ubicacion?.lat == null || ubicacion?.lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}
