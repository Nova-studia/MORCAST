/**
 * Datos de DEMOSTRACIÓN de la app (mismos que el portal web).
 * En la Fase 4 se reemplazan por consultas a Supabase manteniendo la forma.
 */

// La identidad fiscal y el domicilio NO se escriben aquí: viven en
// `cotizacion-datos.js`, que es la fuente única (ver la nota de más abajo).
import { EMPRESA_COTIZACION } from "./cotizacion-datos";
import { COLOR_TIPO } from "./tema";

export const CREDENCIALES_DEMO = { correo: "cliente@demo.com", password: "morcast" };

export const CLIENTE = {
  id: "MOR-2024-0187",
  empresa: "Industrias del Golfo, S.A. de C.V.",
  rfc: "IGO180514QP3",
  contacto: "Lic. Verónica Salazar",
  correo: "cliente@demo.com",
  telefono: "868 812 4590",
  cuenta: "Contrato anual · Servicio industrial",
};

export const CUENTA = {
  saldoActual: 18450.0,
  limiteCredito: 60000.0,
  porPagar: 24680.0,
  proximoCorte: "2026-07-31",
  diasCredito: 30,
};

export const MOVIMIENTOS = [
  { fecha: "2026-07-14", concepto: "Pago recibido — transferencia SPEI", tipo: "abono", monto: 30000.0, folio: "PAG-2026-0442" },
  { fecha: "2026-07-10", concepto: "Servicio de recolección RSU — 4 eventos", tipo: "cargo", monto: 9800.0, folio: "FAC-2026-1187" },
  { fecha: "2026-07-08", concepto: "Renta mensual tolva 30 m³", tipo: "cargo", monto: 6200.0, folio: "FAC-2026-1174" },
  { fecha: "2026-06-30", concepto: "Manejo especial — retiro de residuos", tipo: "cargo", monto: 8680.0, folio: "FAC-2026-1090" },
  { fecha: "2026-06-15", concepto: "Pago recibido — transferencia SPEI", tipo: "abono", monto: 28000.0, folio: "PAG-2026-0388" },
];

export const SERVICIOS_CLIENTE = [
  { folio: "SRV-2026-0714", fecha: "2026-07-14", tipo: "Residuos Sólidos Urbanos", residuo: "RSU mezclado", contenedor: "Tolva 30 m³", volumen: "28.4 m³", peso: "6.9 ton", operador: "J. Medina", estatus: "completado", manifiesto: "MAN-2026-0714" },
  { folio: "SRV-2026-0709", fecha: "2026-07-09", tipo: "Manejo Especial", residuo: "Residuo industrial no peligroso", contenedor: "Caja 20 m³", volumen: "18.0 m³", peso: "4.2 ton", operador: "A. Cruz", estatus: "completado", manifiesto: "MAN-2026-0709" },
  { folio: "SRV-2026-0703", fecha: "2026-07-03", tipo: "Aguas Oleosas", residuo: "Agua con hidrocarburos", contenedor: "Pipa 10 m³", volumen: "10.0 m³", peso: "9.8 ton", operador: "R. Salinas", estatus: "completado", manifiesto: "MAN-2026-0703" },
  { folio: "SRV-2026-0628", fecha: "2026-06-28", tipo: "Residuos Sólidos Urbanos", residuo: "RSU mezclado", contenedor: "Tolva 30 m³", volumen: "29.1 m³", peso: "7.1 ton", operador: "J. Medina", estatus: "completado", manifiesto: "MAN-2026-0628" },
  { folio: "SRV-2026-0620", fecha: "2026-06-20", tipo: "Reciclaje", residuo: "Cartón y metal", contenedor: "Jaula 6 m³", volumen: "6.0 m³", peso: "1.4 ton", operador: "L. Ponce", estatus: "completado", manifiesto: "MAN-2026-0620" },
  { folio: "SRV-2026-0722", fecha: "2026-07-22", tipo: "Residuos Sólidos Urbanos", residuo: "RSU mezclado", contenedor: "Tolva 30 m³", volumen: "—", peso: "—", operador: "Por asignar", estatus: "programado", manifiesto: null },
  { folio: "SRV-2026-0718", fecha: "2026-07-18", tipo: "Manejo Especial", residuo: "Residuo industrial no peligroso", contenedor: "Caja 20 m³", volumen: "—", peso: "—", operador: "A. Cruz", estatus: "en-ruta", manifiesto: null },
];

export const REPORTE_ANUAL = [
  { periodo: "2023", volumen: 3980, monto: 1288000 },
  { periodo: "2024", volumen: 4520, monto: 1512000 },
  { periodo: "2025", volumen: 4870, monto: 1664000 },
  { periodo: "2026", volumen: 2610, monto: 902000 },
];

export const COMPOSICION_RESIDUOS = [
  { tipo: "Residuos Sólidos Urbanos", porcentaje: 46, color: COLOR_TIPO["Residuos Sólidos Urbanos"] },
  { tipo: "Manejo Especial", porcentaje: 24, color: COLOR_TIPO["Manejo Especial"] },
  { tipo: "Aguas Oleosas", porcentaje: 18, color: COLOR_TIPO["Aguas Oleosas"] },
  { tipo: "Reciclaje", porcentaje: 12, color: COLOR_TIPO["Reciclaje"] },
];

export const REPORTE_DIARIO = [
  { periodo: "08 Jul", volumen: 14.1, monto: 6200 },
  { periodo: "09 Jul", volumen: 18.0, monto: 5400 },
  { periodo: "10 Jul", volumen: 9.8, monto: 3600 },
  { periodo: "11 Jul", volumen: 0, monto: 0 },
  { periodo: "12 Jul", volumen: 24.0, monto: 8100 },
  { periodo: "13 Jul", volumen: 16.6, monto: 5900 },
  { periodo: "14 Jul", volumen: 28.4, monto: 9800 },
];

// Reporte mensual (para la mini-gráfica de Inicio)
export const REPORTE_MENSUAL = [
  { periodo: "Feb", volumen: 402, monto: 138000 },
  { periodo: "Mar", volumen: 448, monto: 152000 },
  { periodo: "Abr", volumen: 421, monto: 144500 },
  { periodo: "May", volumen: 468, monto: 159000 },
  { periodo: "Jun", volumen: 452, monto: 154200 },
  { periodo: "Jul", volumen: 431, monto: 148900 },
];

// ---- Agregar saldo ----
export const DATOS_DEPOSITO = {
  banco: "BBVA México",
  titular: "Morcast del Norte, S.A. de C.V.",
  clabe: "012 000 00000000000 0",
  cuenta: "0000000000",
  referencia: "RFC o número de contrato",
  demo: true,
};

export const BANCOS = ["BBVA", "Banorte", "Santander", "Banamex", "HSBC", "Scotiabank", "Otro / Efectivo"];

export const RECARGAS = [
  { id: "REC-2026-0042", fecha: "2026-07-17", monto: 25000, banco: "BBVA", estado: "por-verificar" },
  { id: "REC-2026-0038", fecha: "2026-07-11", monto: 30000, banco: "BBVA", estado: "aplicada" },
];

// ---- Cotizador ----
export const CATALOGO_COTIZADOR = [
  { id: "rsu", servicio: "Recolección de RSU", unidad: "por evento", precio: 2450, icono: "residuos-solidos-urbanos" },
  { id: "esp", servicio: "Residuos de Manejo Especial", unidad: "por evento", precio: 4300, icono: "manejo-especial" },
  { id: "oleosas", servicio: "Recolección de Aguas Oleosas", unidad: "por pipa (10 m³)", precio: 5700, icono: "aguas-oleosas" },
  { id: "residuales", servicio: "Recolección de Aguas Residuales", unidad: "por pipa (10 m³)", precio: 4800, icono: "aguas-residuales" },
  { id: "cont15", servicio: "Renta de Contenedor 1.5 m³", unidad: "mensual", precio: 1900, icono: "contenedores" },
  { id: "cont3", servicio: "Renta de Contenedor 3 m³", unidad: "mensual", precio: 2600, icono: "contenedores" },
  { id: "cont6", servicio: "Renta de Contenedor 6 m³", unidad: "mensual", precio: 3400, icono: "contenedores" },
  { id: "tolva21", servicio: "Renta de Tolva 21", unidad: "mensual", precio: 4200, icono: "contenedores" },
  { id: "tolva30", servicio: "Renta de Tolva 30", unidad: "mensual", precio: 6200, icono: "contenedores" },
  { id: "comp21", servicio: "Renta de Compactador 21", unidad: "mensual", precio: 8600, icono: "contenedores" },
  { id: "comp30", servicio: "Renta de Compactador 30", unidad: "mensual", precio: 9800, icono: "contenedores" },
  { id: "reciclaje", servicio: "Recolección de Reciclables", unidad: "por evento", precio: 1500, icono: "reciclaje" },
];

export const IVA = 0.16;

// ---- Documentos ----
/**
 * 🔴 EL RFC Y EL DOMICILIO DE AQUÍ ERAN INVENTADOS (corregido 7-sep-2026).
 *
 * Este objeto traía un RFC inventado y un domicilio en "Av. Lauro Villar
 * S/N, Col. Industrial". Ninguno de los dos es real:
 *
 * (El RFC no se transcribe aquí a propósito: este repositorio es PÚBLICO y
 * una cadena con forma de RFC no tiene por qué quedar publicada, aunque sea
 * falsa. Si hace falta rastrearlo, está en el historial de git.)
 *
 *   · La empresa NO ha entregado su constancia de situación fiscal. La web
 *     ya lo reconocía — `EMPRESA_COTIZACION.rfc` vale `null` y lleva escrito
 *     "PENDIENTE" desde agosto — pero las apps se quedaron con el inventado
 *     y lo IMPRIMÍAN: en la Constancia de Situación Fiscal y, peor, en el
 *     MANIFIESTO, que es el papel que el cliente archiva como comprobante
 *     de disposición final de sus residuos.
 *   · El domicilio contradecía a la fuente única (`cotizacion-datos.js`),
 *     que trae el que sí dio el cliente el 6-ago: Calle 16 y González #1601.
 *
 * Ahora se apoya en esa fuente única y el RFC queda en `null`. Cuando llegue
 * la constancia real, el RFC se pone en `EMPRESA_COTIZACION.rfc` — aquí no.
 */
export const CONSTANCIA_FISCAL = {
  razonSocial: EMPRESA_COTIZACION.razonSocial.toUpperCase(),
  rfc: EMPRESA_COTIZACION.rfc, // null mientras no llegue la constancia
  regimen: "601 — General de Ley Personas Morales",
  domicilio: EMPRESA_COTIZACION.domicilioLinea,
};

/** ¿Se puede emitir un papel con datos fiscales? Sin RFC, no. */
export const HAY_DATOS_FISCALES = Boolean(CONSTANCIA_FISCAL.rfc);

// ---- Helpers ----
export function pesos(n) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }).format(n || 0);
}

export function fechaLarga(iso) {
  if (!iso) return "—";
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const [a, m, d] = iso.split("-").map(Number);
  return `${d} ${meses[m - 1]} ${a}`;
}

export function estatusInfo(estatus) {
  switch (estatus) {
    case "completado": return { texto: "Completado", clase: "ok" };
    case "programado": return { texto: "Programado", clase: "prog" };
    case "en-ruta": return { texto: "En ruta", clase: "ruta" };
    case "aplicada": return { texto: "Aplicada", clase: "ok" };
    case "por-verificar": return { texto: "Por verificar", clase: "prog" };
    default: return { texto: estatus, clase: "none" };
  }
}
