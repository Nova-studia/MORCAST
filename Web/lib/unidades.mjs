/**
 * INVENTARIO DE UNIDADES (camiones) — la lógica pura.
 *
 * Pedido de los dueños (4-oct-2026). Lo que más importa de aquí son los
 * avisos de vencimiento: un camión que sale con el seguro vencido es una
 * multa, o algo peor si choca, y la verificación vencida lo deja parado en
 * un retén. Nadie se acuerda de esas fechas hasta que ya pasaron, así que el
 * panel las grita 30 días antes.
 *
 * En .mjs y sin dependencias para que `node --test` lo importe directo
 * (tests/unidades.test.mjs).
 */

export const TIPOS_UNIDAD = [
  { id: "manual", nombre: "Manual" },
  { id: "roll-off", nombre: "Roll Off" },
  { id: "compactador", nombre: "Compactador" },
  { id: "camioneta", nombre: "Camioneta" },
  { id: "otro", nombre: "Otro" },
];

export const ESTADOS_UNIDAD = [
  { id: "activa", texto: "Activa", clase: "ok" },
  { id: "taller", texto: "En taller", clase: "alerta" },
  { id: "baja", texto: "Baja", clase: "" },
];

/** Días antes del vencimiento en que empieza el aviso. */
export const DIAS_AVISO = 30;

export function nombreTipoUnidad(id) {
  return TIPOS_UNIDAD.find((t) => t.id === id)?.nombre || id || "—";
}

export function etiquetaEstadoUnidad(id) {
  return ESTADOS_UNIDAD.find((e) => e.id === id) || { id, texto: id || "—", clase: "" };
}

/** Hoy en AAAA-MM-DD con la fecha LOCAL (en UTC, de noche ya sería mañana). */
export function hoyLocal(ahora = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${ahora.getFullYear()}-${p(ahora.getMonth() + 1)}-${p(ahora.getDate())}`;
}

/** ¿Es una fecha de calendario real en AAAA-MM-DD? (2026-02-30 no.) */
export function esFechaValida(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ""));
  if (!m) return false;
  const [a, me, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const f = new Date(Date.UTC(a, me - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === me - 1 && f.getUTCDate() === d;
}

/**
 * Días de calendario de `desdeISO` a `hastaISO` (negativo si ya pasó).
 * Con UTC a mediodía para que un cambio de horario no reste un día.
 */
export function diasHasta(hastaISO, desdeISO) {
  const aUTC = (iso) => {
    const [a, m, d] = iso.split("-").map(Number);
    return Date.UTC(a, m - 1, d, 12);
  };
  return Math.round((aUTC(hastaISO) - aUTC(desdeISO)) / 86400000);
}

/**
 * Cómo está una fecha de vencimiento respecto a hoy.
 *
 *   vencido    ya pasó (el día del vencimiento todavía cuenta como vigente)
 *   pronto     vence en DIAS_AVISO días o menos
 *   ok         falta más
 *   sin-fecha  nadie la ha capturado — también se avisa, más suave: una
 *              fecha que no está es una fecha que nadie está vigilando
 */
export function estadoVencimiento(fechaISO, hoyISO = hoyLocal(), aviso = DIAS_AVISO) {
  if (!fechaISO || !esFechaValida(fechaISO)) return { nivel: "sin-fecha", dias: null };
  const dias = diasHasta(fechaISO, hoyISO);
  if (dias < 0) return { nivel: "vencido", dias };
  if (dias <= aviso) return { nivel: "pronto", dias };
  return { nivel: "ok", dias };
}

/** El aviso en palabras: "Venció hace 3 días", "Vence mañana", "Vence en 12 días". */
export function textoVencimiento({ nivel, dias }) {
  if (nivel === "sin-fecha") return "Sin fecha";
  if (nivel === "vencido") {
    const n = -dias;
    return n === 1 ? "Venció ayer" : `Venció hace ${n} días`;
  }
  if (dias === 0) return "Vence hoy";
  if (dias === 1) return "Vence mañana";
  return `Vence en ${dias} días`;
}

/**
 * Las alertas de vencimiento de toda la flota, la más urgente primero.
 * Las unidades dadas de BAJA no avisan: ya no salen a la calle. Las que
 * están en taller sí, porque van a volver a salir.
 */
export function alertasDeFlota(unidades = [], hoyISO = hoyLocal(), aviso = DIAS_AVISO) {
  const alertas = [];
  for (const u of unidades) {
    if (u.estado === "baja") continue;
    for (const [campo, nombre] of [["vence_seguro", "Seguro"], ["vence_verificacion", "Verificación"]]) {
      const e = estadoVencimiento(u[campo], hoyISO, aviso);
      if (e.nivel === "vencido" || e.nivel === "pronto") {
        alertas.push({ unidadId: u.id, numero: u.numero_economico, que: nombre, fecha: u[campo], ...e });
      }
    }
  }
  return alertas.sort((a, b) => a.dias - b.dias);
}

const LIMITES = { numero: 20, placas: 12, marca: 80, notas: 500 };

/**
 * Revisa y limpia una unidad antes de guardarla. Devuelve `{ ok, datos }`
 * con lo que va a la base, o `{ ok:false, errores }` con un texto por campo.
 */
export function validarUnidad(entrada = {}, hoyISO = hoyLocal()) {
  const errores = {};
  const numero = String(entrada.numero_economico ?? "").trim().toUpperCase();
  if (!numero) errores.numero_economico = "Falta el número económico (el pintado en la puerta).";
  else if (numero.length > LIMITES.numero) errores.numero_economico = `Máximo ${LIMITES.numero} caracteres.`;

  // Las placas se guardan sin espacios ni guiones: "XY-12-345" y "XY 12345"
  // son la misma placa, y la base tiene `unique` sobre esta columna.
  const placas = String(entrada.placas ?? "").toUpperCase().replace(/[\s-]/g, "");
  if (placas.length > LIMITES.placas) errores.placas = `Máximo ${LIMITES.placas} caracteres.`;
  else if (placas && !/^[A-Z0-9]+$/.test(placas)) errores.placas = "Solo letras y números.";

  const tipo = entrada.tipo || "otro";
  if (!TIPOS_UNIDAD.some((t) => t.id === tipo)) errores.tipo = "Tipo desconocido.";

  const estado = entrada.estado || "activa";
  if (!ESTADOS_UNIDAD.some((e) => e.id === estado)) errores.estado = "Estado desconocido.";

  let anio = null;
  if (String(entrada.anio ?? "").trim() !== "") {
    anio = Number(entrada.anio);
    const tope = Number(hoyISO.slice(0, 4)) + 1; // el modelo del año que viene ya se vende
    if (!Number.isInteger(anio) || anio < 1980 || anio > tope) errores.anio = `Un año entre 1980 y ${tope}.`;
  }

  for (const campo of ["vence_seguro", "vence_verificacion"]) {
    const v = entrada[campo];
    if (v && !esFechaValida(v)) errores[campo] = "Fecha no válida.";
  }

  const marca = String(entrada.marca_modelo ?? "").trim();
  if (marca.length > LIMITES.marca) errores.marca_modelo = `Máximo ${LIMITES.marca} caracteres.`;
  const notas = String(entrada.notas ?? "").trim();
  if (notas.length > LIMITES.notas) errores.notas = `Máximo ${LIMITES.notas} caracteres.`;

  if (Object.keys(errores).length) return { ok: false, errores };
  return {
    ok: true,
    datos: {
      numero_economico: numero,
      placas: placas || null,
      tipo,
      marca_modelo: marca || null,
      anio,
      estado,
      vence_seguro: entrada.vence_seguro || null,
      vence_verificacion: entrada.vence_verificacion || null,
      notas: notas || null,
    },
  };
}

/**
 * Cómo se nombra una unidad en un menú o en el texto viejo de la ruta:
 * "U-04 · Roll Off International". El número va primero porque es lo que
 * el chofer ve pintado en la puerta.
 */
export function etiquetaUnidad(u) {
  if (!u) return "";
  return [u.numero_economico, u.marca_modelo || nombreTipoUnidad(u.tipo)].filter(Boolean).join(" · ");
}

/**
 * Para una ruta que solo trae el texto viejo (`rutas.unidad`, p. ej.
 * "Roll Off International"), la unidad que probablemente es — solo si hay
 * UNA que case. Con dos candidatas no se sugiere nada: vincular la ruta al
 * camión equivocado es peor que dejarla "sin vincular".
 */
export function sugerirUnidad(textoViejo, unidades = []) {
  const n = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const t = n(textoViejo);
  if (!t) return null;
  const casan = unidades.filter((u) => {
    if (u.estado === "baja") return false;
    const num = n(u.numero_economico);
    const marca = n(u.marca_modelo);
    // El número económico como palabra completa: "Roll off 04" casa con la
    // "04", pero "Ruta 104" no casa con la "04".
    const porNumero = num && ` ${t} `.includes(` ${num} `);
    const porMarca = marca && (marca.includes(t) || t.includes(marca));
    // "Compactador" a secas: el tipo, si es el único camión de ese tipo.
    const porTipo = n(nombreTipoUnidad(u.tipo)) === t;
    return porNumero || porMarca || porTipo;
  });
  return casan.length === 1 ? casan[0] : null;
}
