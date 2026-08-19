/**
 * Rutas de recolección, suscripciones y solicitudes.
 *
 * DEMO: todo vive en memoria. Al recargar se reinicia. Cuando se conecte
 * Supabase (Fase 4), estas constantes se sustituyen por consultas y las
 * pantallas no cambian.
 *
 * ⚠️ Espejo en `App IOS/src/rutas-datos.js` y `App Android/src/rutas-datos.js`.
 */

/** Centro de Matamoros, para encuadrar el mapa. */
export const MATAMOROS_CENTRO = [25.869, -97.5027];

/** Los 3 tipos que dio el cliente el 6-ago-2026. */
export const TIPOS_RUTA = [
  { id: "manual", nombre: "Manual", detalle: "Recolección a mano, para comercios y contenedores chicos." },
  { id: "roll-off", nombre: "Industrial (Roll Off)", detalle: "Movimiento de tolvas y compactadores con unidad roll off." },
  { id: "compactador", nombre: "Compactador trasero", detalle: "Carga trasera compactada, para alto volumen de RSU." },
];

/** Se opera de lunes a sábado. Nunca domingo. */
export const DIAS_SEMANA = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export const ESTADOS_SOLICITUD_REC = [
  { id: "solicitada", texto: "Solicitada", clase: "prog" },
  { id: "confirmada", texto: "Confirmada", clase: "ok" },
  { id: "en-ruta", texto: "En ruta", clase: "ruta" },
  { id: "completada", texto: "Completada", clase: "ok" },
  { id: "rechazada", texto: "Rechazada", clase: "mal" },
];

export const USOS_CFDI = [
  "G03 — Gastos en general",
  "G01 — Adquisición de mercancías",
  "P01 — Por definir",
];

export const FORMAS_PAGO = ["Transferencia", "Efectivo", "Cheque"];

/** Cada cuándo pasa la unidad por un cliente suscrito. */
export const FRECUENCIAS_SUSCRIPCION = ["semanal", "quincenal", "mensual"];

/**
 * Rutas de ejemplo con zonas dibujadas a ojo sobre Matamoros.
 * ⚠️ SON DE MUESTRA. Morcast tiene que dibujar las suyas desde el panel.
 */
export const RUTAS_SEED = [
  {
    id: "RT-NORTE",
    nombre: "Ruta Norte",
    tipo: "manual",
    dias: ["martes", "viernes"],
    unidad: "Camión de carga Chevrolet",
    chofer: "José Medina",
    cupo: 14,
    activa: true,
    zona: [
      [25.900, -97.540], [25.900, -97.480], [25.872, -97.470],
      [25.868, -97.520], [25.882, -97.545],
    ],
  },
  {
    id: "RT-INDUSTRIAL",
    nombre: "Ruta Industrial",
    tipo: "roll-off",
    dias: ["lunes", "miércoles", "viernes"],
    unidad: "Roll Off International",
    chofer: "Alberto Cruz",
    cupo: 8,
    activa: true,
    zona: [
      [25.870, -97.480], [25.872, -97.430], [25.840, -97.425],
      [25.836, -97.475],
    ],
  },
  {
    id: "RT-CENTRO",
    nombre: "Ruta Centro",
    tipo: "compactador",
    dias: ["lunes", "jueves", "sábado"],
    unidad: "Compactador",
    chofer: "José Medina",
    cupo: 20,
    activa: true,
    zona: [
      [25.882, -97.545], [25.868, -97.520], [25.845, -97.522],
      [25.844, -97.556], [25.868, -97.560],
    ],
  },
];

export const SUSCRIPCIONES_SEED = [
  {
    id: "SUS-001",
    cliente: "Industrias del Golfo, S.A. de C.V.",
    domicilio: { alias: "Planta 1", calle: "Av. Industrial 220", colonia: "Parque Industrial", cp: "87316", lat: 25.858, lng: -97.452 },
    rutaId: "RT-INDUSTRIAL",
    frecuencia: "semanal",
    equipo: [{ tipo: "Tolvas", medida: "30", cantidad: 1 }],
    estado: "activa",
    desde: "2024-03-01",
  },
];

export const SOLICITUDES_SEED = [
  { folio: "REC-2026-0142", cliente: "Industrias del Golfo, S.A. de C.V.", domicilio: "Planta 1 · Parque Industrial", rutaId: "RT-INDUSTRIAL", origen: "ruta", fechaPedida: "2026-08-10", fechaConfirmada: null, estado: "solicitada", nota: "" },
  { folio: "REC-2026-0141", cliente: "Centro Comercial Puerta Norte", domicilio: "Anexo · Zona Centro", rutaId: "RT-CENTRO", origen: "extra", fechaPedida: "2026-08-08", fechaConfirmada: null, estado: "solicitada", nota: "Se juntó residuo por evento de fin de semana." },
  { folio: "REC-2026-0138", cliente: "Vidriera Matamoros", domicilio: "Matriz · Zona Centro", rutaId: "RT-CENTRO", origen: "ruta", fechaPedida: "2026-08-06", fechaConfirmada: "2026-08-06", estado: "confirmada", nota: "" },
];

export const ZONAS_PEDIDAS_SEED = [
  { id: "ZP-004", nombreContacto: "Ramiro Elizondo", empresa: "Bodegas El Puente", telefono: "868 771 2204", correo: "reliz@bodegaselpuente.mx", colonia: "Lomas del Real", lat: 25.912, lng: -97.442, volumenEstimado: "2 tolvas mensuales", estado: "nueva", fecha: "2026-08-04" },
  { id: "ZP-003", nombreContacto: "Alma Treviño", empresa: "Abarrotes Treviño", telefono: "868 552 9013", correo: "almatrev@gmail.com", colonia: "Buenavista", lat: 25.826, lng: -97.498, volumenEstimado: "1 contenedor de 3 m³", estado: "en-evaluacion", fecha: "2026-07-29" },
];

/** Siguiente folio a partir de los que ya existen. Nunca por longitud del arreglo. */
export function folioRecoleccion(existentes) {
  const numeros = existentes
    .map((s) => Number(String(s.folio).split("-").pop()))
    .filter((n) => Number.isFinite(n));
  const siguiente = (numeros.length ? Math.max(...numeros) : 0) + 1;
  return `REC-${new Date().getFullYear()}-${String(siguiente).padStart(4, "0")}`;
}

/** Siguiente id de zona pedida. Mismo criterio que el folio: por el máximo, no por longitud. */
export function idZonaPedida(existentes) {
  const numeros = existentes
    .map((z) => Number(String(z.id).split("-").pop()))
    .filter((n) => Number.isFinite(n));
  const siguiente = (numeros.length ? Math.max(...numeros) : 0) + 1;
  return `ZP-${String(siguiente).padStart(3, "0")}`;
}

/** Nombre legible de un tipo de ruta. */
export function nombreTipoRuta(id) {
  return TIPOS_RUTA.find((t) => t.id === id)?.nombre || id;
}

/** Busca una ruta por id. */
export function rutaPorId(rutas, id) {
  return rutas.find((r) => r.id === id) || null;
}
