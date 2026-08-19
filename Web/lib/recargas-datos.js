/**
 * RECARGAS DE SALDO — Fase 2 (PROTOTIPO)
 * =========================================================================
 * Flujo SIN pagos en línea:
 *  1. El cliente deposita/transfiere a la cuenta de Morcast.
 *  2. Sube el comprobante de pago con el monto en el portal ("Agregar saldo").
 *  3. La solicitud cae en el panel de administración → "Saldos de clientes".
 *  4. SOLO el responsable asignado verifica que el dinero llegó y aplica el
 *     saldo, dejando el comprobante adjunto como respaldo.
 *
 * Cuando exista backend, RECARGAS se alimenta de una tabla de Supabase y el
 * comprobante se guarda en Storage. Los datos aquí son de DEMOSTRACIÓN.
 * =========================================================================
 */

/** Cuenta bancaria a la que el cliente deposita. DEMO — reemplazar por la real. */
export const DATOS_DEPOSITO = {
  banco: "BBVA México",
  titular: "Morcast del Norte, S.A. de C.V.",
  clabe: "012 000 00000000000 0", // DEMO
  cuenta: "0000000000",           // DEMO
  referencia: "RFC o número de contrato del cliente",
  demo: true,
};

/** Bancos frecuentes (para el select del comprobante). */
export const BANCOS = [
  "BBVA", "Banorte", "Santander", "Banamex (Citibanamex)", "HSBC",
  "Scotiabank", "Banregio", "Afirme", "Inbursa", "Otro / Efectivo",
];

/**
 * Persona designada para verificar y aplicar recargas.
 * En producción, la acción de "aplicar saldo" se limita a este usuario
 * (o a un rol con ese permiso). Ver [[admin-datos]] USUARIOS_ADMIN.
 */
export const RESPONSABLE_RECARGAS = {
  id: "U-004",
  nombre: "Karla Montes",
  rol: "Facturación",
  correo: "kmontes@morcast.mx",
};

/**
 * Solicitudes de recarga de saldo (demo).
 * estado: por-verificar | aplicada | rechazada
 * comprobante: ruta a la imagen del comprobante (en el demo, SVG de ejemplo).
 */
export const RECARGAS_SEED = [
  {
    id: "REC-2026-0042",
    fecha: "2026-07-17",
    clienteId: "MOR-2024-0187",
    cliente: "Industrias del Golfo, S.A. de C.V.",
    monto: 25000,
    banco: "BBVA",
    referencia: "IGO180514QP3",
    comprobante: "/img/demo/comprobante-1.svg",
    comprobanteNombre: "spei_25000.pdf",
    estado: "por-verificar",
    notas: "",
  },
  {
    id: "REC-2026-0041",
    fecha: "2026-07-16",
    clienteId: "MOR-2025-0233",
    cliente: "Centro Comercial Puerta Norte",
    monto: 12200,
    banco: "Santander",
    referencia: "Contrato MOR-2025-0233",
    comprobante: "/img/demo/comprobante-2.svg",
    comprobanteNombre: "transferencia_12200.jpg",
    estado: "por-verificar",
    notas: "",
  },
  {
    id: "REC-2026-0038",
    fecha: "2026-07-11",
    clienteId: "MOR-2024-0187",
    cliente: "Industrias del Golfo, S.A. de C.V.",
    monto: 30000,
    banco: "BBVA",
    referencia: "IGO180514QP3",
    comprobante: "/img/demo/comprobante-1.svg",
    comprobanteNombre: "spei_30000.pdf",
    estado: "aplicada",
    verificadaPor: "Karla Montes",
    fechaAplicada: "2026-07-11",
    notas: "Depósito confirmado en estado de cuenta.",
  },
];

/** Formatea el estado de una recarga. */
export function estadoRecarga(id) {
  switch (id) {
    case "por-verificar": return { texto: "Por verificar", clase: "prog" };
    case "aplicada": return { texto: "Aplicada", clase: "ok" };
    case "rechazada": return { texto: "Rechazada", clase: "" };
    default: return { texto: id, clase: "" };
  }
}
