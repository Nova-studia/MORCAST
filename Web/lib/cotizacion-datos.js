/**
 * Datos oficiales de MORCAST DEL NORTE que aparecen en las COTIZACIONES.
 *
 * Fuente: información entregada por el cliente el 6-ago-2026.
 *
 * ⚠️ FUENTE ÚNICA. Antes esta información estaba repartida entre `datos.js`,
 * el `MORCAST_FISCAL` inventado de `portal-pdf.js` y el banco demo de
 * `recargas-datos.js`. Si hay que corregir un dato, se corrige AQUÍ.
 *
 * ⚠️ La app móvil (Expo) NO comparte código con la web: existe un archivo
 * espejo en `App IOS/src/cotizacion-datos.js` y `App Android/src/...`.
 * Al tocar este archivo, actualizar también el espejo.
 */

/** Identidad fiscal y domicilio. */
export const EMPRESA_COTIZACION = {
  razonSocial: "Morcast del Norte, S.A. de C.V.",
  nombreComercial: "MORCAST DEL NORTE",
  representanteLegal: "Guillermo Cortez Martínez",
  domicilio: {
    calle: "Calle 16 y González #1601",
    colonia: "Zona Centro",
    cp: "87300",
    ciudad: "Heroica Matamoros",
    estado: "Tamaulipas",
    pais: "México",
  },
  /** Domicilio en una sola línea, para encabezados de PDF. */
  domicilioLinea:
    "Calle 16 y González #1601, Zona Centro, C.P. 87300, Heroica Matamoros, Tamps.",
  telefonos: ["868 384 9478", "868 907 6020"],
  // ⚠️ TEMPORALES: son los correos personales del cliente. Se cambian por los
  // buzones @morcast.mx (contacto@morcast.mx ya existe) cuando se los entreguemos.
  correos: ["gutmartmexico@gmail.com", "morcastdelnorte.sa.de.cv@gmail.com"],
  correosTemporales: true,
  sitio: "https://morcast.mx",
  // PENDIENTE: el cliente aún no entrega la constancia de situación fiscal.
  rfc: null,
};

/** Unidades con las que se presta el servicio. */
export const UNIDADES = [
  "Compactador",
  "Roll Off International",
  "Roll Off Mack",
  "Camión de carga Chevrolet",
];

/** Equipo disponible para renta, agrupado por tipo. */
export const EQUIPO_RENTA = [
  { tipo: "Contenedores", medidas: ["1.5 m³", "3 m³", "6 m³"] },
  { tipo: "Tolvas", medidas: ["21", "30"] },
  { tipo: "Compactadores", medidas: ["21", "30"] },
];

/** Zona donde se presta el servicio. */
export const COBERTURA = "Matamoros, Tamaulipas";

/** Horarios de atención y de operación. */
export const HORARIOS = {
  oficina: "8:00 a.m. a 5:00 p.m., lunes a viernes",
  recolecciones: "Lunes a sábado",
  emergencias: "24 horas, los 7 días de la semana",
  /** Resumen de una línea para el sitio público y el pie de los PDF. */
  resumen:
    "Oficina 8:00 a.m. – 5:00 p.m. L–V · Recolecciones L–S · Emergencias 24/7",
};

/** Condiciones comerciales que se imprimen en toda cotización. */
export const CONDICIONES_COMERCIALES = {
  iva: 0.16,
  ivaTexto: "IVA 16%",
  diasCredito: 45,
  diasVigencia: 30,
  lista: [
    "Los precios no incluyen IVA. Se aplica el 16% sobre el subtotal.",
    "45 días de crédito.",
    "Esta cotización tiene una vigencia de 30 días naturales.",
    "Maniobras: se solicita un área específica para la instalación de lo solicitado.",
  ],
};

/**
 * Datos para pago por transferencia.
 *
 * ⚠️ EN BLANCO A PROPÓSITO. El cliente aún no entrega la CLABE ni el número
 * de cuenta (6-ago-2026). NO inventar valores: esta información se imprime en
 * cotizaciones reales que van a terceros. Al llenarlos, poner `pendiente: false`.
 */
export const DATOS_TRANSFERENCIA = {
  pendiente: true,
  beneficiario: "Morcast del Norte, S.A. de C.V.",
  banco: "",
  clabe: "",
  cuenta: "",
  leyendaPendiente: "Pendiente de confirmar",
};
