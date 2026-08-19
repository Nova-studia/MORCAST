/**
 * Datos de DEMOSTRACIÓN del panel de administración (mismos que la web admin).
 */
import { pesos, fechaLarga } from "./datos";

export const ADMIN_DEMO = { correo: "admin@morcast.mx", password: "admin" };

export const ADMIN_PERFIL = {
  nombre: "Ing. Ramón Cázares",
  puesto: "Administrador general",
  correo: "admin@morcast.mx",
  rol: "Administrador",
};

export const ESTADOS_SOLICITUD = [
  { id: "nueva", texto: "Nueva", clase: "prog" },
  { id: "contactada", texto: "Contactada", clase: "ruta" },
  { id: "cotizada", texto: "Cotizada", clase: "prog" },
  { id: "ganada", texto: "Ganada", clase: "ok" },
  { id: "perdida", texto: "Perdida", clase: "none" },
];

export const SOLICITUDES = [
  { id: "COT-1201", fecha: "2026-07-16", nombre: "María Elena Ríos", empresa: "Plásticos del Bravo", correo: "compras@plasticosbravo.mx", telefono: "868 110 2245", servicio: "Renta de contenedores / tolvas", frecuencia: "Semanal", estado: "nueva", mensaje: "Necesitamos una tolva de 30 m³ con recolección semanal." },
  { id: "COT-1200", fecha: "2026-07-16", nombre: "Jorge Villarreal", empresa: "Maquilas TechNorte", correo: "jvillarreal@technorte.com", telefono: "868 233 8890", servicio: "Residuos de Manejo Especial", frecuencia: "3 veces por semana", estado: "nueva", mensaje: "Generamos residuos industriales no peligrosos, requerimos manifiesto." },
  { id: "COT-1198", fecha: "2026-07-15", nombre: "Sandra Gómez", empresa: "Restaurante La Parrilla", correo: "laparrilla.mtm@gmail.com", telefono: "868 455 1120", servicio: "Residuos Sólidos Urbanos (RSU)", frecuencia: "Diaria", estado: "contactada", mensaje: "Restaurante con alta generación de RSU, queremos contenedor de 3 m³." },
  { id: "COT-1195", fecha: "2026-07-14", nombre: "Luis Fernando Cano", empresa: "Talleres Cano", correo: "lfcano@tallerescano.mx", telefono: "868 778 3341", servicio: "Aguas oleosas", frecuencia: "Quincenal", estado: "cotizada", mensaje: "Trampa de grasa y agua con aceite de taller, 10 m³ aprox." },
  { id: "COT-1190", fecha: "2026-07-12", nombre: "Patricia Anaya", empresa: "Centro Comercial Puerta Norte", correo: "mantenimiento@puertanorte.mx", telefono: "868 902 5567", servicio: "Renta de contenedores / tolvas", frecuencia: "3 veces por semana", estado: "ganada", mensaje: "Dos tolvas de 15 m³ para el centro comercial." },
  { id: "COT-1187", fecha: "2026-07-10", nombre: "Roberto Múzquiz", empresa: "Ferretera del Golfo", correo: "rmuzquiz@ferregolfo.com", telefono: "868 341 7789", servicio: "Reciclaje (compra-venta)", frecuencia: "Semanal", estado: "cotizada", mensaje: "Cartón y metal para compra-venta, volumen alto." },
  { id: "COT-1183", fecha: "2026-07-08", nombre: "Alejandra Sáenz", empresa: "Clínica Santa Fe", correo: "compras@clinicasantafe.mx", telefono: "868 220 4498", servicio: "Residuos de Manejo Especial", frecuencia: "Semanal", estado: "perdida", mensaje: "Cotizamos pero eligieron a otro proveedor por precio." },
  { id: "COT-1180", fecha: "2026-07-05", nombre: "Héctor Lozano", empresa: "Vidriera Matamoros", correo: "hlozano@vidrieramtm.com", telefono: "868 655 3312", servicio: "Residuos Sólidos Urbanos (RSU)", frecuencia: "2 veces por semana", estado: "ganada", mensaje: "Contenedor de 6 m³ con recolección dos veces por semana." },
];

export const CLIENTES_ADMIN = [
  { id: "MOR-2024-0187", empresa: "Industrias del Golfo, S.A. de C.V.", contacto: "Lic. Verónica Salazar", correo: "cliente@demo.com", telefono: "868 812 4590", plan: "Contrato anual", saldo: 18450, porPagar: 24680, estatus: "activo" },
  { id: "MOR-2025-0233", empresa: "Centro Comercial Puerta Norte", contacto: "Patricia Anaya", correo: "mantenimiento@puertanorte.mx", telefono: "868 902 5567", plan: "Contrato anual", saldo: 0, porPagar: 12200, estatus: "activo" },
  { id: "MOR-2025-0301", empresa: "Vidriera Matamoros", contacto: "Héctor Lozano", correo: "hlozano@vidrieramtm.com", telefono: "868 655 3312", plan: "Por evento", saldo: 3400, porPagar: 0, estatus: "activo" },
  { id: "MOR-2026-0044", empresa: "Maquilas TechNorte", contacto: "Jorge Villarreal", correo: "jvillarreal@technorte.com", telefono: "868 233 8890", plan: "Contrato mensual", saldo: 0, porPagar: 8900, estatus: "moroso" },
  { id: "MOR-2026-0071", empresa: "Ferretera del Golfo", contacto: "Roberto Múzquiz", correo: "rmuzquiz@ferregolfo.com", telefono: "868 341 7789", plan: "Por evento", saldo: 1200, porPagar: 0, estatus: "activo" },
];

export const USUARIOS_ADMIN = [
  { id: "U-001", nombre: "Ing. Ramón Cázares", correo: "admin@morcast.mx", rol: "Administrador", estatus: "activo", ultimo: "2026-07-17" },
  { id: "U-002", nombre: "Lucía Herrera", correo: "lherrera@morcast.mx", rol: "Auxiliar de administrador", estatus: "activo", ultimo: "2026-07-16" },
  { id: "U-003", nombre: "Diego Fuentes", correo: "dfuentes@morcast.mx", rol: "Auxiliar de administrador", estatus: "activo", ultimo: "2026-07-15" },
  { id: "U-004", nombre: "Karla Montes", correo: "kmontes@morcast.mx", rol: "Facturación", estatus: "invitado", ultimo: "—" },
  { id: "U-005", nombre: "José Medina", correo: "jmedina@morcast.mx", rol: "Chofer / Operador", estatus: "activo", ultimo: "2026-07-18" },
  { id: "U-006", nombre: "Alberto Cruz", correo: "acruz@morcast.mx", rol: "Chofer / Operador", estatus: "activo", ultimo: "2026-07-18" },
];

export const ROLES = [
  { id: "Administrador", detalle: "Acceso total: solicitudes, clientes, servicios, reportes, facturación y usuarios." },
  { id: "Auxiliar de administrador", detalle: "Gestiona solicitudes, clientes y servicios. No administra usuarios ni facturación." },
  { id: "Facturación", detalle: "Acceso a clientes, saldos, reportes y documentos fiscales." },
  { id: "Operaciones", detalle: "Ve y actualiza la agenda de servicios y manifiestos." },
  { id: "Chofer / Operador", detalle: "App móvil: escanea el QR del contenedor y registra la recolección (foto antes/después, peso, firma)." },
];

export const AGENDA_SERVICIOS = [
  { folio: "SRV-2026-0722", fecha: "2026-07-18", cliente: "Industrias del Golfo", tipo: "Residuos Sólidos Urbanos", unidad: "Roll off 04", operador: "J. Medina", estatus: "en-ruta" },
  { folio: "SRV-2026-0724", fecha: "2026-07-18", cliente: "Centro Comercial Puerta Norte", tipo: "Renta tolva 15 m³", unidad: "Roll off 02", operador: "A. Cruz", estatus: "programado" },
  { folio: "SRV-2026-0726", fecha: "2026-07-19", cliente: "Vidriera Matamoros", tipo: "Residuos Sólidos Urbanos", unidad: "Volteo 12", operador: "L. Ponce", estatus: "programado" },
  {
    folio: "SRV-2026-0714", fecha: "2026-07-14", cliente: "Industrias del Golfo", tipo: "Residuos Sólidos Urbanos", unidad: "Roll off 04", operador: "J. Medina", estatus: "completado",
    evidencia: { contenedor: "Contenedor 6 m³ · QR MOR-C-0421", gps: "25.8693, -97.5023", antes: { hora: "08:14", etiqueta: "Contenedor lleno" }, despues: { hora: "08:47", etiqueta: "Contenedor vacío", peso: "1,240 kg", firma: "J. Medina" } },
  },
  {
    folio: "SRV-2026-0709", fecha: "2026-07-09", cliente: "Industrias del Golfo", tipo: "Manejo Especial", unidad: "Volteo 12", operador: "A. Cruz", estatus: "completado",
    evidencia: { contenedor: "Tolva 30 m³ · QR MOR-C-0388", gps: "25.8701, -97.5044", antes: { hora: "10:02", etiqueta: "Tolva llena" }, despues: { hora: "10:39", etiqueta: "Tolva vacía", peso: "3,860 kg", firma: "A. Cruz" } },
  },
];

export const ADMIN_KPIS = { ingresosMes: 148900, ingresosMesAnterior: 154200, solicitudesNuevas: 2, clientesActivos: 4, serviciosMes: 27, porCobrar: 45780 };

export const ADMIN_INGRESOS = [
  { periodo: "Feb", monto: 138000 }, { periodo: "Mar", monto: 152000 }, { periodo: "Abr", monto: 144500 },
  { periodo: "May", monto: 159000 }, { periodo: "Jun", monto: 154200 }, { periodo: "Jul", monto: 148900 },
];

// ---- Recargas de saldo (para la pantalla Saldos del admin) ----
export const RESPONSABLE_RECARGAS = { id: "U-004", nombre: "Karla Montes", rol: "Facturación", correo: "kmontes@morcast.mx" };

export const RECARGAS_SEED = [
  { id: "REC-2026-0042", fecha: "2026-07-17", clienteId: "MOR-2024-0187", cliente: "Industrias del Golfo, S.A. de C.V.", monto: 25000, banco: "BBVA", referencia: "IGO180514QP3", comprobanteNombre: "spei_25000.jpg", comprobante: require("../assets/comprobante-1.png"), estado: "por-verificar" },
  { id: "REC-2026-0041", fecha: "2026-07-16", clienteId: "MOR-2025-0233", cliente: "Centro Comercial Puerta Norte", monto: 12200, banco: "Santander", referencia: "Contrato MOR-2025-0233", comprobanteNombre: "transferencia_12200.jpg", comprobante: require("../assets/comprobante-2.png"), estado: "por-verificar" },
  { id: "REC-2026-0038", fecha: "2026-07-11", clienteId: "MOR-2024-0187", cliente: "Industrias del Golfo, S.A. de C.V.", monto: 30000, banco: "BBVA", referencia: "IGO180514QP3", comprobanteNombre: "spei_30000.jpg", comprobante: require("../assets/comprobante-1.png"), estado: "aplicada", verificadaPor: "Karla Montes" },
];

export function embudoSolicitudes(solicitudes) {
  return ESTADOS_SOLICITUD.map((e) => ({ ...e, total: solicitudes.filter((s) => s.estado === e.id).length }));
}
export function infoEstado(id) {
  return ESTADOS_SOLICITUD.find((e) => e.id === id) || { texto: id, clase: "none" };
}
export function estadoRecarga(id) {
  switch (id) {
    case "por-verificar": return { texto: "Por verificar", clase: "prog" };
    case "aplicada": return { texto: "Aplicada", clase: "ok" };
    case "rechazada": return { texto: "Rechazada", clase: "none" };
    default: return { texto: id, clase: "none" };
  }
}

export { pesos, fechaLarga };
