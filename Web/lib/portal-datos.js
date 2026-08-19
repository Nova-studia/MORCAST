/**
 * PORTAL DE CLIENTES — Fase 2 (PROTOTIPO)
 * =========================================================================
 * Datos de EJEMPLO para el portal del cliente. Todo es ficticio y sirve
 * para demostrar el flujo completo (login, saldo, historial, reportes,
 * manifiestos y constancia fiscal en PDF).
 *
 * Cuando exista la base de datos real, estas estructuras se reemplazan por
 * consultas a Supabase manteniendo la misma forma → los componentes no cambian.
 * =========================================================================
 */

/** Credenciales del acceso de demostración (se muestran en la pantalla de login). */
export const CREDENCIALES_DEMO = {
  correo: "cliente@demo.com",
  password: "morcast",
};

/** Empresa cliente de ejemplo (los datos fiscales alimentan la constancia). */
export const CLIENTE = {
  id: "MOR-2024-0187",
  empresa: "Industrias del Golfo, S.A. de C.V.",
  rfc: "IGO180514QP3",
  regimen: "601 — General de Ley Personas Morales",
  usoCfdi: "G03 — Gastos en general",
  contacto: "Lic. Verónica Salazar",
  correo: "cliente@demo.com",
  telefono: "868 812 4590",
  domicilio: "Parque Industrial del Norte, Nave 14, C.P. 87340, Matamoros, Tamaulipas",
  codigoPostal: "87340",
  cuenta: "Contrato anual · Servicio industrial",
  desde: "2024-03-01",
  ejecutivo: "Ing. Ramón Cázares",
};

/** Estado de cuenta / saldo. Montos en MXN. */
export const CUENTA = {
  saldoActual: 18450.0,          // a favor del cliente (crédito disponible)
  limiteCredito: 60000.0,
  porPagar: 24680.0,             // facturas pendientes
  proximoCorte: "2026-07-31",
  diasCredito: 30,
};

/** Movimientos recientes de la cuenta (cargos y abonos). */
export const MOVIMIENTOS = [
  { fecha: "2026-07-14", concepto: "Pago recibido — transferencia SPEI", tipo: "abono", monto: 30000.0, folio: "PAG-2026-0442" },
  { fecha: "2026-07-10", concepto: "Servicio de recolección RSU — 4 eventos", tipo: "cargo", monto: 9800.0, folio: "FAC-2026-1187" },
  { fecha: "2026-07-08", concepto: "Renta mensual tolva 30 m³", tipo: "cargo", monto: 6200.0, folio: "FAC-2026-1174" },
  { fecha: "2026-06-30", concepto: "Manejo especial — retiro de residuos industriales", tipo: "cargo", monto: 8680.0, folio: "FAC-2026-1090" },
  { fecha: "2026-06-15", concepto: "Pago recibido — transferencia SPEI", tipo: "abono", monto: 28000.0, folio: "PAG-2026-0388" },
  { fecha: "2026-06-12", concepto: "Aguas oleosas — 2 pipas (20 m³)", tipo: "cargo", monto: 11400.0, folio: "FAC-2026-0995" },
];

/**
 * Historial de servicios (últimos ~12 meses). Cada uno genera un manifiesto.
 * `estatus`: completado | programado | en-ruta
 */
export const SERVICIOS_CLIENTE = [
  { folio: "SRV-2026-0714", fecha: "2026-07-14", tipo: "Residuos Sólidos Urbanos", residuo: "RSU mezclado", contenedor: "Tolva 30 m³", volumen: "28.4 m³", peso: "6.9 ton", unidad: "Roll off 04", operador: "J. Medina", estatus: "completado", manifiesto: "MAN-2026-0714", evidencia: { contenedor: "Tolva 30 m³ · QR MOR-C-0421", gps: "25.8693, -97.5023 (Matamoros, Tamps.)", antes: { hora: "08:14", etiqueta: "Contenedor lleno" }, despues: { hora: "08:47", etiqueta: "Contenedor vacío", peso: "6.9 ton", firma: "J. Medina" } } },
  { folio: "SRV-2026-0709", fecha: "2026-07-09", tipo: "Manejo Especial", residuo: "Residuo industrial no peligroso", contenedor: "Caja 20 m³", volumen: "18.0 m³", peso: "4.2 ton", unidad: "Volteo 12", operador: "A. Cruz", estatus: "completado", manifiesto: "MAN-2026-0709", evidencia: { contenedor: "Caja 20 m³ · QR MOR-C-0388", gps: "25.8701, -97.5044 (Matamoros, Tamps.)", antes: { hora: "10:02", etiqueta: "Caja llena" }, despues: { hora: "10:39", etiqueta: "Caja vacía", peso: "4.2 ton", firma: "A. Cruz" } } },
  { folio: "SRV-2026-0703", fecha: "2026-07-03", tipo: "Aguas Oleosas", residuo: "Agua con hidrocarburos", contenedor: "Pipa 10 m³", volumen: "10.0 m³", peso: "9.8 ton", unidad: "Pipa 02", operador: "R. Salinas", estatus: "completado", manifiesto: "MAN-2026-0703" },
  { folio: "SRV-2026-0628", fecha: "2026-06-28", tipo: "Residuos Sólidos Urbanos", residuo: "RSU mezclado", contenedor: "Tolva 30 m³", volumen: "29.1 m³", peso: "7.1 ton", unidad: "Roll off 04", operador: "J. Medina", estatus: "completado", manifiesto: "MAN-2026-0628" },
  { folio: "SRV-2026-0620", fecha: "2026-06-20", tipo: "Reciclaje", residuo: "Cartón y metal", contenedor: "Jaula 6 m³", volumen: "6.0 m³", peso: "1.4 ton", unidad: "Estacas 05", operador: "L. Ponce", estatus: "completado", manifiesto: "MAN-2026-0620" },
  { folio: "SRV-2026-0612", fecha: "2026-06-12", tipo: "Aguas Oleosas", residuo: "Agua con aceite de taller", contenedor: "Pipa 10 m³", volumen: "20.0 m³", peso: "19.6 ton", unidad: "Pipa 02", operador: "R. Salinas", estatus: "completado", manifiesto: "MAN-2026-0612" },
  { folio: "SRV-2026-0605", fecha: "2026-06-05", tipo: "Manejo Especial", residuo: "Lodos industriales", contenedor: "Caja 20 m³", volumen: "16.5 m³", peso: "5.0 ton", unidad: "Volteo 14", operador: "A. Cruz", estatus: "completado", manifiesto: "MAN-2026-0605" },
  { folio: "SRV-2026-0531", fecha: "2026-05-31", tipo: "Residuos Sólidos Urbanos", residuo: "RSU mezclado", contenedor: "Tolva 30 m³", volumen: "27.8 m³", peso: "6.7 ton", unidad: "Roll off 04", operador: "J. Medina", estatus: "completado", manifiesto: "MAN-2026-0531" },
  { folio: "SRV-2026-0722", fecha: "2026-07-22", tipo: "Residuos Sólidos Urbanos", residuo: "RSU mezclado", contenedor: "Tolva 30 m³", volumen: "—", peso: "—", unidad: "Roll off 04", operador: "Por asignar", estatus: "programado", manifiesto: null },
  { folio: "SRV-2026-0718", fecha: "2026-07-18", tipo: "Manejo Especial", residuo: "Residuo industrial no peligroso", contenedor: "Caja 20 m³", volumen: "—", peso: "—", unidad: "Volteo 12", operador: "A. Cruz", estatus: "en-ruta", manifiesto: null },
];

/**
 * Serie de datos para reportes. Volumen (m³) y monto (MXN) por periodo.
 * DIARIO: últimos 14 días. MENSUAL: 12 meses. ANUAL: 4 años.
 */
export const REPORTE_DIARIO = [
  { periodo: "01 Jul", volumen: 12.4, monto: 4100 },
  { periodo: "02 Jul", volumen: 0, monto: 0 },
  { periodo: "03 Jul", volumen: 10.0, monto: 5700 },
  { periodo: "04 Jul", volumen: 18.2, monto: 6300 },
  { periodo: "05 Jul", volumen: 6.0, monto: 2200 },
  { periodo: "06 Jul", volumen: 0, monto: 0 },
  { periodo: "07 Jul", volumen: 22.5, monto: 7800 },
  { periodo: "08 Jul", volumen: 14.1, monto: 6200 },
  { periodo: "09 Jul", volumen: 18.0, monto: 5400 },
  { periodo: "10 Jul", volumen: 9.8, monto: 3600 },
  { periodo: "11 Jul", volumen: 0, monto: 0 },
  { periodo: "12 Jul", volumen: 24.0, monto: 8100 },
  { periodo: "13 Jul", volumen: 16.6, monto: 5900 },
  { periodo: "14 Jul", volumen: 28.4, monto: 9800 },
];

export const REPORTE_MENSUAL = [
  { periodo: "Ago", volumen: 340, monto: 118000 },
  { periodo: "Sep", volumen: 388, monto: 131000 },
  { periodo: "Oct", volumen: 412, monto: 142000 },
  { periodo: "Nov", volumen: 366, monto: 124500 },
  { periodo: "Dic", volumen: 298, monto: 102000 },
  { periodo: "Ene", volumen: 356, monto: 121000 },
  { periodo: "Feb", volumen: 402, monto: 138000 },
  { periodo: "Mar", volumen: 448, monto: 152000 },
  { periodo: "Abr", volumen: 421, monto: 144500 },
  { periodo: "May", volumen: 468, monto: 159000 },
  { periodo: "Jun", volumen: 452, monto: 154200 },
  { periodo: "Jul", volumen: 431, monto: 148900 },
];

export const REPORTE_ANUAL = [
  { periodo: "2023", volumen: 3980, monto: 1288000 },
  { periodo: "2024", volumen: 4520, monto: 1512000 },
  { periodo: "2025", volumen: 4870, monto: 1664000 },
  { periodo: "2026", volumen: 2610, monto: 902000 },
];

/** Reparto de volumen por tipo de residuo (para gráfica de composición). */
export const COMPOSICION_RESIDUOS = [
  { tipo: "Residuos Sólidos Urbanos", porcentaje: 46, color: "#4eb34a" },
  { tipo: "Manejo Especial", porcentaje: 24, color: "#db652d" },
  { tipo: "Aguas Oleosas", porcentaje: 18, color: "#2d8a8f" },
  { tipo: "Reciclaje", porcentaje: 12, color: "#7cc576" },
];

/** Documentos fiscales disponibles para descargar. */
export const DOCUMENTOS_FISCALES = [
  { id: "csf", nombre: "Constancia de Situación Fiscal", detalle: "Datos fiscales de Morcast del Norte, S.A. de C.V.", tipo: "constancia" },
];

/**
 * Catálogo de precios de referencia para el cotizador (MXN, sin IVA).
 * Precios de ejemplo.
 */
/**
 * Catálogo del cotizador. El EQUIPO refleja lo que el cliente confirmó el
 * 6-ago-2026 (ver `cotizacion-datos.js`): contenedores 1.5/3/6 m³,
 * tolvas 21 y 30, compactadores 21 y 30.
 *
 * ⚠️ Los PRECIOS siguen siendo de referencia (demo). El cliente todavía no
 * entrega su lista de precios; al recibirla, sustituir estos montos.
 */
export const CATALOGO_COTIZADOR = [
  { id: "rsu", servicio: "Recolección de Residuos Sólidos Urbanos", unidad: "por evento", precio: 2450 },
  { id: "esp", servicio: "Manejo de Residuos de Manejo Especial", unidad: "por evento", precio: 4300 },
  { id: "oleosas", servicio: "Recolección de Aguas Oleosas", unidad: "por pipa (10 m³)", precio: 5700 },
  { id: "residuales", servicio: "Recolección de Aguas Residuales", unidad: "por pipa (10 m³)", precio: 4800 },
  { id: "cont15", servicio: "Renta de Contenedor 1.5 m³", unidad: "mensual", precio: 1900 },
  { id: "cont3", servicio: "Renta de Contenedor 3 m³", unidad: "mensual", precio: 2600 },
  { id: "cont6", servicio: "Renta de Contenedor 6 m³", unidad: "mensual", precio: 3400 },
  { id: "tolva21", servicio: "Renta de Tolva 21", unidad: "mensual", precio: 4200 },
  { id: "tolva30", servicio: "Renta de Tolva 30", unidad: "mensual", precio: 6200 },
  { id: "comp21", servicio: "Renta de Compactador 21", unidad: "mensual", precio: 8600 },
  { id: "comp30", servicio: "Renta de Compactador 30", unidad: "mensual", precio: 9800 },
  { id: "reciclaje", servicio: "Recolección de Reciclables", unidad: "por evento", precio: 1500 },
];

export const IVA = 0.16;

/** Formatea un número como moneda MXN. */
export function pesos(n) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(n || 0);
}

/** Formatea una fecha ISO (YYYY-MM-DD) a "14 jul 2026". */
export function fechaLarga(iso) {
  if (!iso) return "—";
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const [a, m, d] = iso.split("-").map(Number);
  return `${d} ${meses[m - 1]} ${a}`;
}

/** Etiqueta y color para el estatus de un servicio. */
export function estatusInfo(estatus) {
  switch (estatus) {
    case "completado": return { texto: "Completado", clase: "ok" };
    case "programado": return { texto: "Programado", clase: "prog" };
    case "en-ruta": return { texto: "En ruta", clase: "ruta" };
    // Los estados tal como los guarda la base. Sin estos, una solicitud
    // recién pedida se pintaba con la palabra cruda y sin color.
    case "solicitada": return { texto: "Solicitada", clase: "prog" };
    case "confirmada": return { texto: "Confirmada", clase: "ok" };
    case "completada": return { texto: "Completada", clase: "ok" };
    case "rechazada": return { texto: "Rechazada", clase: "mal" };
    default: return { texto: estatus, clase: "" };
  }
}
