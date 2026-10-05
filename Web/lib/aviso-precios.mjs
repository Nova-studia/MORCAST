/**
 * EL TEXTO DEL AVISO DE QUE LOS PRECIOS PUEDEN CAMBIAR — fuente única.
 *
 * Vivía dentro de `components/AvisoPrecios.js`, pero ese archivo es JSX y
 * arrastra los iconos de Phosphor: Node no lo puede importar, y el PDF de la
 * solicitud de alta (`lib/alta-pdf.mjs`) se genera en el SERVIDOR y se prueba
 * con `node --test`. Los Términos del servicio (`lib/terminos.mjs`) también lo
 * citan palabra por palabra. Para que los tres digan EXACTAMENTE lo mismo, el
 * texto vive aquí y el componente lo reexporta.
 *
 * Pedido de los dueños (4-oct-2026) y redacción formal de Luis (5-oct).
 * Pendiente de revisión por un abogado.
 */
export const TEXTO_AVISO_PRECIOS =
  "Las cotizaciones y precios mostrados son estimados de referencia y no constituyen una oferta definitiva. El precio final está sujeto a una revisión del servicio por parte de Morcast del Norte (tipo de residuo, volumen, equipo y condiciones de acceso), por lo que puede ser distinto al cotizado. La cotización final es opcional: usted puede aceptarla o rechazarla sin ningún compromiso.";

/** La misma idea en una línea, para junto a una cifra donde no cabe el texto completo. */
export const TEXTO_AVISO_PRECIOS_CORTO =
  "Precio estimado: el monto final está sujeto a revisión y usted puede aceptarlo o rechazarlo sin compromiso.";
