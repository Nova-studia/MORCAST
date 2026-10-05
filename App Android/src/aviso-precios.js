/**
 * EL TEXTO DEL AVISO DE QUE LOS PRECIOS PUEDEN CAMBIAR.
 *
 * ⚠️ COPIA LITERAL de `Web/lib/aviso-precios.mjs` (y espejo en `App IOS/`).
 * Pedido de los dueños (4-oct-2026) con la redacción formal de Luis (5-oct):
 * en la web, en la app y en los PDF tiene que decir EXACTAMENTE lo mismo,
 * para que el cliente no pueda reclamar "en la app me salió otro precio".
 * Si cambia allá, se copia aquí palabra por palabra; no se "mejora" aquí.
 *
 * Va sin imports de React a propósito: lo leen la pantalla (`ui.js`, el
 * recuadro `AvisoPrecios`), los PDF (`pdf.js`) y las pruebas de `node --test`.
 */
export const TEXTO_AVISO_PRECIOS =
  "Las cotizaciones y precios mostrados son estimados de referencia y no constituyen una oferta definitiva. El precio final está sujeto a una revisión del servicio por parte de Morcast del Norte (tipo de residuo, volumen, equipo y condiciones de acceso), por lo que puede ser distinto al cotizado. La cotización final es opcional: usted puede aceptarla o rechazarla sin ningún compromiso.";

/** La misma idea en una línea, para junto a una cifra donde no cabe el texto completo. */
export const TEXTO_AVISO_PRECIOS_CORTO =
  "Precio estimado: el monto final está sujeto a revisión y usted puede aceptarlo o rechazarlo sin compromiso.";
