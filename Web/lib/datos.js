/**
 * Contenido del sitio MORCAST DEL NORTE.
 * Fuente: folleto oficial "SERVICIO DE RECOLECCIÓN DE RESIDUOS SÓLIDOS
 * URBANOS Y RESIDUOS DE MANEJO ESPECIAL_v3.pdf" + correcciones del cliente.
 *
 * Todo el texto del sitio vive aquí para que se pueda editar sin tocar componentes.
 *
 * Los datos duros de la empresa (domicilio, horarios, condiciones comerciales)
 * viven en `cotizacion-datos.js`, que es la fuente única. Aquí solo se reusan.
 */

import { EMPRESA_COTIZACION, HORARIOS } from "./cotizacion-datos";

export const EMPRESA = {
  nombre: "MORCAST DEL NORTE",
  razonSocial: "Morcast del Norte, S.A. de C.V.",
  descriptor: "Manejo de Residuos",
  ciudad: "Matamoros",
  estado: "Tamaulipas",
  pais: "México",
  telefonos: ["868 384 9478", "868 907 6020"],
  // El primer teléfono se usa para WhatsApp. Formato internacional sin signos.
  whatsapp: "5218683849478",
  // ⚠️ TEMPORALES: son los correos personales del cliente. Se cambian por los
  // buzones @morcast.mx cuando se los entreguemos.
  correos: ["gutmartmexico@gmail.com", "morcastdelnorte.sa.de.cv@gmail.com"],
  // Confirmado por el cliente el 6-ago-2026.
  direccion: EMPRESA_COTIZACION.domicilioLinea,
  horario: HORARIOS.resumen,
  sitio: "https://morcast.mx",
};

/** Los 3 permisos, redactados con precisión según la corrección del cliente. */
export const PERMISOS = [
  {
    tipo: "Residuos Sólidos Urbanos",
    estado: "Permiso municipal activo",
    detalle: "Autorización municipal vigente para recolección de RSU.",
    propio: true,
    logo: "/img/permisos/permiso-municipal.jpg",
    logoAlt:
      "Secretaría de Medio Ambiente y Desarrollo Sostenible · Gobierno Municipal de Matamoros",
  },
  {
    tipo: "Residuos de Manejo Especial",
    estado: "Permiso estatal SEDUMA activo",
    detalle:
      "Registro estatal vigente ante la Secretaría de Desarrollo Urbano y Medio Ambiente de Tamaulipas.",
    propio: true,
    logo: "/img/permisos/permiso-estatal.png",
    logoAlt: "Secretaría de Desarrollo Urbano y Medio Ambiente de Tamaulipas",
  },
  {
    tipo: "Residuos Peligrosos",
    estado: "Permiso vigente mediante tercero autorizado",
    detalle:
      "Operamos bajo convenio de exclusividad con una empresa autorizada. Nuestra autorización propia se encuentra en trámite.",
    propio: false,
    logo: "/img/permisos/semarnat.svg",
    logoAlt: "Secretaría de Medio Ambiente y Recursos Naturales (SEMARNAT)",
  },
];

export const SERVICIOS = [
  {
    slug: "residuos-solidos-urbanos",
    icono: "basura",
    tono: "verde",
    titulo: "Residuos Sólidos Urbanos",
    resumen:
      "Los Residuos Sólidos Urbanos (RSU) son los generados en los domicilios particulares, comercios, oficinas y servicios, así como todos aquellos que no tengan la calificación de peligrosos.",
    etiqueta: "Permiso municipal activo",
  },
  {
    slug: "manejo-especial",
    icono: "rme",
    tono: "naranja",
    titulo: "Residuos de Manejo Especial",
    resumen:
      "Son aquellos residuos que contienen o pueden contener agentes patógenos en concentraciones o cantidades suficientes para causar enfermedad a un huésped susceptible.",
    etiqueta: "Permiso estatal SEDUMA",
  },
  {
    slug: "residuos-peligrosos",
    icono: "peligro",
    tono: "naranja",
    titulo: "Residuos Peligrosos",
    resumen:
      "Manejo integral de residuos peligrosos con trazabilidad documental completa. Operamos mediante convenio de exclusividad con un tercero autorizado, cumpliendo toda la normatividad aplicable.",
    etiqueta: "Vía tercero autorizado",
    etiquetaGris: true,
  },
  {
    slug: "aguas-residuales",
    icono: "agua",
    tono: "azul",
    titulo: "Recolección y transporte de aguas residuales",
    resumen:
      "Recolección de aguas residuales domésticas e industriales, fosas sépticas, drenajes, plantas de tratamiento, pozos y sistemas de bombeo.",
  },
  {
    slug: "aguas-oleosas",
    icono: "aceite",
    tono: "azul",
    titulo: "Manejo de Aguas Oleosas",
    resumen:
      "Recolectamos líquidos con hidrocarburos, agua con aceite de talleres y maquinaria, trampas de grasa y separadores de aceite, residuos de barcos, astilleros y puertos.",
  },
  {
    slug: "aguas-peligrosas",
    icono: "gota",
    tono: "verde",
    titulo: "Recolección y Disposición Final de Aguas Peligrosas",
    resumen:
      "Servicio especializado para el manejo integral de residuos líquidos peligrosos, que incluye recolección, transporte y disposición final, cumpliendo con toda la normatividad ambiental vigente.",
  },
  {
    slug: "contenedores",
    icono: "contenedor",
    tono: "verde",
    titulo: "Contenedores y tolvas",
    resumen:
      "Contamos con contenedores metálicos de 1.5, 3 y 6 metros cúbicos, y tolvas de 15 y 30 metros cúbicos, dependiendo de las necesidades de tu empresa.",
    etiqueta: "Instalación inmediata",
  },
  {
    slug: "reciclaje",
    icono: "reciclar",
    tono: "verde",
    titulo: "Reciclaje",
    resumen:
      "Nos dedicamos a la recolección así como la compra-venta de materiales reciclables como lo son el cartón y papel, metales, plásticos, vidrio y electrónicos.",
    etiqueta: "Compra-venta",
  },
];

export const SERVICIOS_ADICIONALES = [
  {
    titulo: "Limpieza a maquiladoras e industrias",
    resumen:
      "Servicio de limpieza industrial para naves, patios y áreas productivas.",
  },
  {
    titulo: "Despalme y afine perimetral",
    resumen:
      "Preparación y afine de terrenos y perímetros con maquinaria propia.",
  },
];

export const SECTORES = [
  { nombre: "Industrias maquiladoras", icono: "fabrica" },
  { nombre: "Industrias restauranteras", icono: "restaurante" },
  { nombre: "Centros comerciales", icono: "tienda" },
  { nombre: "Escuelas", icono: "escuela" },
  { nombre: "Mercados y tiendas de conveniencia", icono: "mercado" },
  { nombre: "Clínicas, hospitales particulares y públicos", icono: "hospital" },
];

/**
 * Clientes.
 * `logo` queda en null a propósito: los logos son marcas registradas de terceros
 * y deben agregarse SOLO con autorización por escrito de cada empresa.
 * Para activar un logo: coloca el archivo en /public/img/clientes/ y pon la ruta aquí.
 */
// `escala` agranda logos que se ven pequeños en su tarjeta (1 = tamaño normal).
export const CLIENTES = [
  { nombre: "CEMEX", logo: "/img/clientes/cemex.png", escala: 1.4 },
  { nombre: "DEACERO", logo: "/img/clientes/deacero.png", escala: 1.4 },
  { nombre: "VESTAS", logo: "/img/clientes/vestas.png", escala: 1.4 },
  { nombre: "IAI", logo: "/img/clientes/iai.png" },
  { nombre: "Terminal Río Bravo", logo: "/img/clientes/terminal-rio-bravo.png" },
  { nombre: "SPF", logo: "/img/clientes/spf.png", escala: 1.4 },
  { nombre: "McDonald's", logo: "/img/clientes/mcdonalds.png" },
  { nombre: "Coppel", logo: "/img/clientes/coppel.png" },
  { nombre: "Carta Blanca", logo: "/img/clientes/carta-blanca.png", escala: 1.2 },
  // Sin logo aún (se muestran como texto):
  { nombre: "Kansas City", logo: null },
  { nombre: "API", logo: null },
];

export const EQUIPAMIENTO = [
  {
    nombre: "Camiones recolectores de 4 toneladas",
    detalle: "Unidades compactadoras para la recolección de desechos.",
    // `hero-camion.jpg` es un FOLLETO con el texto "…LÍQUIDOS Y DE MANEJO
    // ESPECIAL" impreso encima: en la tarjeta de flota salía cortado a la
    // mitad sobre la foto. `flota-recolector.jpg` es la misma imagen sin esa
    // franja. El original se conserva por si se ocupa completo.
    foto: "/img/flota-recolector.jpg",
  },
  {
    nombre: "Pipas certificadas",
    detalle:
      "Aseguradas para daños ambientales. Para aguas residuales, oleosas y peligrosas.",
    foto: "/img/flota-pipa.jpg",
  },
  {
    nombre: "Jaulas de acero",
    detalle: "Para transporte de diversos materiales sólidos.",
    foto: "/img/flota-jaula.jpg",
  },
  {
    nombre: "Camiones de volteo 12 y 14 m³",
    detalle: "Para movimiento de material a granel y escombro.",
    foto: "/img/flota-volteo.jpg",
  },
  {
    nombre: "Roll off",
    detalle: "Para movimiento de tolvas y compactadores.",
    foto: "/img/flota-rolloff.jpg",
  },
  {
    nombre: "Unidades de estacas 2 y 5 toneladas",
    detalle: "Para cargas medianas y servicio a comercios.",
    foto: "/img/flota-estacas.jpg",
  },
];

export const EQUIPAMIENTO_LISTA = [
  "Camiones con capacidad de 4 toneladas para la recolección de desechos",
  "Pipas certificadas y aseguradas para daños ambientales",
  "Jaulas de acero para transporte de diversos materiales sólidos",
  "Contenedores disponibles para instalación inmediata en su domicilio",
  "Camiones de volteo de 14 m³",
  "Camión de volteo de 12 m³",
  "Unidades de 5 toneladas",
  "Unidades de 2 toneladas",
  "Retroexcavadora",
  "Roll off para movimiento de tolvas y compactadores",
  "Tolvas con compactador",
];

/** Medidas disponibles de contenedores y tolvas (a partir de 15 m³ son tolvas). */
export const CONTENEDORES_MEDIDAS = [
  {
    medida: "1.5 m³",
    tipo: "Contenedor metálico",
    detalle: "Ideal para comercios, restaurantes y oficinas con volumen moderado.",
  },
  {
    medida: "3 m³",
    tipo: "Contenedor metálico",
    detalle: "Un punto intermedio para negocios en crecimiento, talleres y locales con mayor generación.",
  },
  {
    medida: "6 m³",
    tipo: "Contenedor metálico",
    detalle: "Para industrias, escuelas y centros comerciales con generación constante.",
  },
  {
    medida: "15 m³",
    tipo: "Tolva",
    detalle: "Alta capacidad para maquiladoras y proyectos con gran volumen de residuos.",
  },
  {
    medida: "30 m³",
    tipo: "Tolva",
    detalle: "Nuestra máxima capacidad, con opción de compactador de alta eficiencia.",
  },
];

/**
 * Galería de contenedores. Fotos re-recortadas LIMPIAS desde el PDF original
 * en alta resolución (las versiones viejas traían pedazos del diseño de la
 * diapositiva encimados). `ancho`/`alto` = dimensiones reales del archivo;
 * la galería de /contenedores las muestra completas en mosaico.
 * La portada usa solo las primeras 4 (recortadas a 4:3).
 */
export const CONTENEDORES = [
  {
    foto: "/img/foto-2.jpg",
    alt: "Operador de Morcast del Norte revisando un contenedor metálico",
    nombre: "Contenedor en sitio",
    ancho: 896,
    alto: 1200,
  },
  {
    foto: "/img/foto-5.jpg",
    alt: "Maniobra de carga de un contenedor roll off de Morcast del Norte",
    nombre: "Maniobra de roll off",
    ancho: 1376,
    alto: 768,
  },
];

/**
 * Tipos de contenedor/tolva que aún no tienen foto propia.
 * Se muestran como tarjetas "foto próximamente" hasta que el cliente
 * nos pase buenas fotos de cada uno.
 */
export const CONTENEDORES_PENDIENTES = [
  "Contenedor de 1.5 m³",
  "Contenedor de 3 m³",
  "Contenedor de 6 m³",
  "Tolva de 15 m³",
  "Tolva de 30 m³",
  "Tolva con compactador",
  "Roll off metálico",
];

/** Galería de trabajos: fotos reales de operación de Morcast del Norte. */
export const GALERIA = [
  { foto: "/img/foto-1.jpg", alt: "Camión roll off descargando un contenedor", ancho: 1376, alto: 768 },
  { foto: "/img/foto-7.jpg", alt: "Operador de Morcast frente a la fila de contenedores en trailer", ancho: 1500, alto: 837 },
  { foto: "/img/foto-2.jpg", alt: "Operador revisando un contenedor metálico en sitio", ancho: 896, alto: 1200 },
  { foto: "/img/foto-3.jpg", alt: "Equipo de Morcast frente al camión de contenedores", ancho: 1022, alto: 768 },
  { foto: "/img/foto-6.jpg", alt: "Camión y cargador manejando material para reciclaje", ancho: 1376, alto: 768 },
  { foto: "/img/foto-8.jpg", alt: "Operador de Morcast del Norte frente a contenedores", ancho: 1200, alto: 896 },
  { foto: "/img/foto-4.jpg", alt: "Camión recolector de carga trasera en operación", ancho: 958, alto: 768 },
  { foto: "/img/foto-5.jpg", alt: "Maniobra de carga de un contenedor roll off", ancho: 1376, alto: 768 },
];

export const MATERIALES_RECICLABLES = [
  "Cartón y papel",
  "Metales",
  "Plásticos",
  "Vidrio",
  "Electrónicos",
];

export const NAVEGACION = [
  { texto: "Inicio", href: "/" },
  { texto: "Portafolio", href: "/portafolio" },
  { texto: "Equipo", href: "/equipo" },
  { texto: "Contenedores", href: "/contenedores" },
  { texto: "Scrap", href: "/scrap" },
  { texto: "Permisos", href: "/permisos" },
];

/** Páginas que ya no van en el navbar pero siguen enlazadas en el footer. */
export const NAVEGACION_SECUNDARIA = [
  { texto: "Servicios", href: "/servicios" },
  { texto: "Nosotros", href: "/nosotros" },
  { texto: "Contacto", href: "/contacto" },
];

export const FRECUENCIAS = [
  "Diaria",
  "3 veces por semana",
  "2 veces por semana",
  "Semanal",
  "Quincenal",
  "Mensual",
  "Por evento / única vez",
  "Aún no lo sé",
];

export const TIPOS_SERVICIO = [
  "Residuos Sólidos Urbanos (RSU)",
  "Residuos Sólidos Urbanos Domiciliarios (Recolección especial mayor a 3.5 Toneladas)",
  "Residuos de Manejo Especial",
  "Residuos Peligrosos",
  "Aguas residuales",
  "Aguas oleosas",
  "Aguas peligrosas",
  "Renta de contenedores / tolvas",
  "Reciclaje (compra-venta)",
  "Limpieza industrial",
  "Despalme y afine perimetral",
  "Raspado de terreno",
  "Otro",
];

/** Preguntas frecuentes (redactadas con la información disponible del negocio). */
export const PREGUNTAS = [
  {
    q: "¿En qué zona ofrecen servicio?",
    a: "Damos servicio en Matamoros, Tamaulipas y su área industrial, atendiendo a maquiladoras, comercios, escuelas, hospitales y más.",
  },
  {
    q: "¿Qué tipos de residuos manejan?",
    a: "Residuos Sólidos Urbanos (RSU), Residuos de Manejo Especial y Residuos Peligrosos (mediante tercero autorizado), además de aguas residuales, oleosas y peligrosas.",
  },
  {
    q: "¿Qué tamaños de contenedores y tolvas tienen?",
    a: "Contenedores metálicos de 1.5, 3 y 6 m³, y tolvas de 15 y 30 m³ (estas últimas con opción de compactador). Todos disponibles para instalación inmediata en tu domicilio.",
  },
  {
    q: "¿Entregan comprobante del manejo de residuos?",
    a: "Sí. Entregamos el Manifiesto del Protocolo de Disposición, que respalda legalmente a tu empresa y te ayuda a cumplir con la normatividad y a prevenir multas.",
  },
  {
    q: "¿Cuentan con permisos vigentes?",
    a: "Sí: permiso municipal para RSU, registro estatal ante SEDUMA para Residuos de Manejo Especial, y para Residuos Peligrosos operamos bajo convenio con una empresa autorizada (nuestra autorización propia está en trámite).",
  },
  {
    q: "¿Atienden emergencias fuera de horario?",
    a: "Sí. Trabajamos de lunes a sábado y contamos con atención a emergencias las 24 horas, los 7 días de la semana.",
  },
  {
    q: "¿Compran materiales reciclables?",
    a: "Sí. Recolectamos y compramos cartón y papel, metales, plásticos, vidrio y electrónicos. Convertimos tus residuos aprovechables en un ingreso para tu empresa.",
  },
  {
    q: "¿Cómo solicito una cotización?",
    a: "Puedes llenar el formulario de contacto del sitio o escribirnos directo por WhatsApp. Cuéntanos tu volumen, frecuencia y espacio disponible y te respondemos el mismo día.",
  },
];

/** Enlace de WhatsApp con mensaje prellenado. */
export function enlaceWhatsApp(mensaje = "Hola, me interesa cotizar el servicio de recolección de residuos.") {
  return `https://wa.me/${EMPRESA.whatsapp}?text=${encodeURIComponent(mensaje)}`;
}
