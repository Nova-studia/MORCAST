/**
 * PANEL DE ADMINISTRADOR — Fase 2 (PROTOTIPO)
 * =========================================================================
 * Datos de EJEMPLO para el panel del dueño/administrador de Morcast.
 * Permite ver las solicitudes de cotización (del formulario público),
 * gestionar clientes y servicios, ver reportes del negocio y administrar
 * usuarios (administradores y auxiliares).
 *
 * Cuando exista el backend real, `SOLICITUDES` se alimenta de la tabla
 * `cotizaciones` de Supabase; el resto, de sus tablas correspondientes.
 * =========================================================================
 */

import { rutaPorId } from "./rutas-datos";

/** Acceso de demostración del administrador. */
export const ADMIN_DEMO = {
  correo: "admin@morcast.mx",
  password: "admin",
};

export const ADMIN_PERFIL = {
  nombre: "Ing. Ramón Cázares",
  puesto: "Administrador general",
  correo: "admin@morcast.mx",
  rol: "Administrador",
};

/** Estados posibles de una solicitud (embudo comercial). */
export const ESTADOS_SOLICITUD = [
  { id: "nueva", texto: "Nueva", clase: "prog" },
  { id: "contactada", texto: "Contactada", clase: "ruta" },
  { id: "cotizada", texto: "Cotizada", clase: "prog" },
  { id: "ganada", texto: "Ganada", clase: "ok" },
  { id: "perdida", texto: "Perdida", clase: "" },
];

/**
 * Solicitudes de cotización (del formulario público → tabla `cotizaciones`).
 */
export const SOLICITUDES = [
  { id: "COT-1201", fecha: "2026-07-16", nombre: "María Elena Ríos", empresa: "Plásticos del Bravo", correo: "compras@plasticosbravo.mx", telefono: "868 110 2245", servicio: "Renta de contenedores / tolvas", frecuencia: "Semanal", estado: "nueva", mensaje: "Necesitamos una tolva de 30 m³ para nuestra nave, con recolección semanal." },
  { id: "COT-1200", fecha: "2026-07-16", nombre: "Jorge Villarreal", empresa: "Maquilas TechNorte", correo: "jvillarreal@technorte.com", telefono: "868 233 8890", servicio: "Residuos de Manejo Especial", frecuencia: "3 veces por semana", estado: "nueva", mensaje: "Generamos residuos industriales no peligrosos, requerimos manifiesto." },
  { id: "COT-1198", fecha: "2026-07-15", nombre: "Sandra Gómez", empresa: "Restaurante La Parrilla", correo: "laparrilla.mtm@gmail.com", telefono: "868 455 1120", servicio: "Residuos Sólidos Urbanos (RSU)", frecuencia: "Diaria", estado: "contactada", mensaje: "Restaurante con alta generación de RSU, queremos contenedor de 3 m³." },
  { id: "COT-1195", fecha: "2026-07-14", nombre: "Luis Fernando Cano", empresa: "Talleres Cano", correo: "lfcano@tallerescano.mx", telefono: "868 778 3341", servicio: "Aguas oleosas", frecuencia: "Quincenal", estado: "cotizada", mensaje: "Trampa de grasa y agua con aceite de taller, 10 m³ aprox." },
  { id: "COT-1190", fecha: "2026-07-12", nombre: "Patricia Anaya", empresa: "Centro Comercial Puerta Norte", correo: "mantenimiento@puertanorte.mx", telefono: "868 902 5567", servicio: "Renta de contenedores / tolvas", frecuencia: "3 veces por semana", estado: "ganada", mensaje: "Dos tolvas de 15 m³ para el centro comercial." },
  { id: "COT-1187", fecha: "2026-07-10", nombre: "Roberto Múzquiz", empresa: "Ferretera del Golfo", correo: "rmuzquiz@ferregolfo.com", telefono: "868 341 7789", servicio: "Reciclaje (compra-venta)", frecuencia: "Semanal", estado: "cotizada", mensaje: "Cartón y metal para compra-venta, volumen alto." },
  { id: "COT-1183", fecha: "2026-07-08", nombre: "Alejandra Sáenz", empresa: "Clínica Santa Fe", correo: "compras@clinicasantafe.mx", telefono: "868 220 4498", servicio: "Residuos de Manejo Especial", frecuencia: "Semanal", estado: "perdida", mensaje: "Cotizamos pero eligieron a otro proveedor por precio." },
  { id: "COT-1180", fecha: "2026-07-05", nombre: "Héctor Lozano", empresa: "Vidriera Matamoros", correo: "hlozano@vidrieramtm.com", telefono: "868 655 3312", servicio: "Residuos Sólidos Urbanos (RSU)", frecuencia: "2 veces por semana", estado: "ganada", mensaje: "Contenedor de 6 m³ con recolección dos veces por semana." },
];

/** Clientes activos con cuenta en el portal. */
export const CLIENTES_ADMIN = [
  { id: "MOR-2024-0187", empresa: "Industrias del Golfo, S.A. de C.V.", contacto: "Lic. Verónica Salazar", correo: "cliente@demo.com", telefono: "868 812 4590", plan: "Contrato anual", saldo: 18450, porPagar: 24680, estatus: "activo", desde: "2024-03-01" },
  { id: "MOR-2025-0233", empresa: "Centro Comercial Puerta Norte", contacto: "Patricia Anaya", correo: "mantenimiento@puertanorte.mx", telefono: "868 902 5567", plan: "Contrato anual", saldo: 0, porPagar: 12200, estatus: "activo", desde: "2025-08-15" },
  { id: "MOR-2025-0301", empresa: "Vidriera Matamoros", contacto: "Héctor Lozano", correo: "hlozano@vidrieramtm.com", telefono: "868 655 3312", plan: "Por evento", saldo: 3400, porPagar: 0, estatus: "activo", desde: "2025-11-02" },
  { id: "MOR-2026-0044", empresa: "Maquilas TechNorte", contacto: "Jorge Villarreal", correo: "jvillarreal@technorte.com", telefono: "868 233 8890", plan: "Contrato mensual", saldo: 0, porPagar: 8900, estatus: "moroso", desde: "2026-02-20" },
  { id: "MOR-2026-0071", empresa: "Ferretera del Golfo", contacto: "Roberto Múzquiz", correo: "rmuzquiz@ferregolfo.com", telefono: "868 341 7789", plan: "Por evento", saldo: 1200, porPagar: 0, estatus: "activo", desde: "2026-05-11" },
];

/** Usuarios del panel de administración (roles y permisos). */
export const USUARIOS_ADMIN = [
  { id: "U-001", nombre: "Ing. Ramón Cázares", correo: "admin@morcast.mx", rol: "Administrador", estatus: "activo", ultimo: "2026-07-17" },
  { id: "U-002", nombre: "Lucía Herrera", correo: "lherrera@morcast.mx", rol: "Auxiliar de administrador", estatus: "activo", ultimo: "2026-07-16" },
  { id: "U-003", nombre: "Diego Fuentes", correo: "dfuentes@morcast.mx", rol: "Auxiliar de administrador", estatus: "activo", ultimo: "2026-07-15" },
  { id: "U-004", nombre: "Karla Montes", correo: "kmontes@morcast.mx", rol: "Facturación", estatus: "invitado", ultimo: "—" },
  { id: "U-005", nombre: "José Medina", correo: "jmedina@morcast.mx", rol: "Chofer / Operador", estatus: "activo", ultimo: "2026-07-18" },
  { id: "U-006", nombre: "Alberto Cruz", correo: "acruz@morcast.mx", rol: "Chofer / Operador", estatus: "activo", ultimo: "2026-07-18" },
];

/** Roles disponibles y lo que puede hacer cada uno (para el alta de usuarios). */
export const ROLES = [
  { id: "Administrador", detalle: "Acceso total: solicitudes, clientes, servicios, reportes, facturación y usuarios." },
  { id: "Auxiliar de administrador", detalle: "Gestiona solicitudes, clientes y servicios. No administra usuarios ni facturación." },
  { id: "Facturación", detalle: "Acceso a clientes, saldos, reportes y emisión de documentos fiscales." },
  { id: "Operaciones", detalle: "Ve y actualiza la agenda de servicios y manifiestos. Sin acceso comercial." },
  { id: "Chofer / Operador", detalle: "App móvil: escanea el QR del contenedor, registra la recolección (peso, foto y firma) y actualiza el estatus del servicio en ruta. Solo ve su agenda del día." },
];

/** Agenda de servicios (todos los clientes) para el admin. */
export const AGENDA_SERVICIOS = [
  { folio: "SRV-2026-0722", fecha: "2026-07-18", cliente: "Industrias del Golfo", tipo: "Residuos Sólidos Urbanos", unidad: "Roll off 04", operador: "J. Medina", estatus: "en-ruta" },
  { folio: "SRV-2026-0724", fecha: "2026-07-18", cliente: "Centro Comercial Puerta Norte", tipo: "Renta tolva 15 m³", unidad: "Roll off 02", operador: "A. Cruz", estatus: "programado" },
  { folio: "SRV-2026-0726", fecha: "2026-07-19", cliente: "Vidriera Matamoros", tipo: "Residuos Sólidos Urbanos", unidad: "Volteo 12", operador: "L. Ponce", estatus: "programado" },
  { folio: "SRV-2026-0728", fecha: "2026-07-19", cliente: "Ferretera del Golfo", tipo: "Reciclaje", unidad: "Estacas 05", operador: "R. Salinas", estatus: "programado" },
  {
    folio: "SRV-2026-0714", fecha: "2026-07-14", cliente: "Industrias del Golfo", tipo: "Residuos Sólidos Urbanos", unidad: "Roll off 04", operador: "J. Medina", estatus: "completado",
    evidencia: {
      contenedor: "Contenedor 6 m³ · QR MOR-C-0421",
      gps: "25.8693, -97.5023 (Matamoros, Tamps.)",
      antes: { hora: "08:14", etiqueta: "Contenedor lleno" },
      despues: { hora: "08:47", etiqueta: "Contenedor vacío", peso: "1,240 kg", firma: "J. Medina" },
    },
  },
  {
    folio: "SRV-2026-0709", fecha: "2026-07-09", cliente: "Industrias del Golfo", tipo: "Manejo Especial", unidad: "Volteo 12", operador: "A. Cruz", estatus: "completado",
    evidencia: {
      contenedor: "Tolva 30 m³ · QR MOR-C-0388",
      gps: "25.8701, -97.5044 (Matamoros, Tamps.)",
      antes: { hora: "10:02", etiqueta: "Tolva llena" },
      despues: { hora: "10:39", etiqueta: "Tolva vacía", peso: "3,860 kg", firma: "A. Cruz" },
    },
  },
];

/** KPIs del negocio para el dashboard admin. */
export const ADMIN_KPIS = {
  ingresosMes: 148900,
  ingresosMesAnterior: 154200,
  solicitudesNuevas: 2,
  clientesActivos: 4,
  // Mismo campo que ahora devuelve `kpisAdmin()` contra Supabase (Task 3): se
  // agrega aqui tambien para que el modo demo no entregue una forma de datos
  // distinta a la real.
  clientesPendientes: 0,
  serviciosMes: 27,
  porCobrar: 45780,
};

/** Ingresos por mes (para gráfica del panel admin) — MXN. */
export const ADMIN_INGRESOS = [
  { periodo: "Ago", monto: 118000 },
  { periodo: "Sep", monto: 131000 },
  { periodo: "Oct", monto: 142000 },
  { periodo: "Nov", monto: 124500 },
  { periodo: "Dic", monto: 102000 },
  { periodo: "Ene", monto: 121000 },
  { periodo: "Feb", monto: 138000 },
  { periodo: "Mar", monto: 152000 },
  { periodo: "Abr", monto: 144500 },
  { periodo: "May", monto: 159000 },
  { periodo: "Jun", monto: 154200 },
  { periodo: "Jul", monto: 148900 },
];

/** Embudo de solicitudes por estado (para la gráfica). */
export function embudoSolicitudes(solicitudes) {
  return ESTADOS_SOLICITUD.map((e) => ({
    ...e,
    total: solicitudes.filter((s) => s.estado === e.id).length,
  }));
}

export function infoEstado(id) {
  return ESTADOS_SOLICITUD.find((e) => e.id === id) || { texto: id, clase: "" };
}


/**
 * Traduce el estado de una solicitud de recolección al que ya usa la agenda.
 * OJO con el género: la agenda dice "completado" y las solicitudes
 * "completada". Sin esta traducción, el filtro "Completados" de la pantalla
 * las dejaba fuera y el badge salía sin color.
 */
const ESTATUS_AGENDA = {
  confirmada: "programado",
  "en-ruta": "en-ruta",
  completada: "completado",
};

/**
 * Convierte solicitudes de recolección al formato que ya usa la agenda del
 * admin (AGENDA_SERVICIOS), para que las dos vistas hablen el mismo idioma.
 * Solo entran las confirmadas, en ruta o completadas: una solicitud sin
 * confirmar no ocupa unidad.
 */
/**
 * Agenda a partir de las solicitudes que YA vienen de la base de datos, con
 * su ruta resuelta (`listarSolicitudes` de lib/datos-solicitudes.js).
 *
 * Existe aparte de `agendaDesdeSolicitudes` porque aquella recibe los datos de
 * ejemplo, donde la ruta viene por clave y hay que ir a buscarla. Aquí ya vino
 * la unidad y el chofer en la misma consulta.
 */
export function agendaDesdeBase(solicitudes) {
  return solicitudes
    .filter((s) => ESTATUS_AGENDA[s.estado])
    .map((s) => ({
      folio: s.folio,
      fecha: s.fechaConfirmada || s.fechaPedida,
      cliente: s.cliente,
      tipo: s.origen === "extra" ? "Recolección extra" : "Recolección de ruta",
      unidad: s.unidad || "Sin asignar",
      operador: s.chofer || "Sin asignar",
      estatus: ESTATUS_AGENDA[s.estado],
    }))
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
}

export function agendaDesdeSolicitudes(solicitudes, rutas) {
  return solicitudes
    .filter((s) => ESTATUS_AGENDA[s.estado])
    .map((s) => {
      const r = rutaPorId(rutas, s.rutaId);
      return {
        folio: s.folio,
        fecha: s.fechaConfirmada || s.fechaPedida,
        cliente: s.cliente,
        tipo: s.origen === "extra" ? "Recolección extra" : "Recolección de ruta",
        unidad: r?.unidad || "Sin asignar",
        operador: r?.chofer || "Sin asignar",
        estatus: ESTATUS_AGENDA[s.estado],
      };
    })
    // Se compara con </> y se devuelve 0 en el empate. Nunca restar fechas ni
    // usar un comparador que jamás devuelva 0: da un orden inestable.
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
}
