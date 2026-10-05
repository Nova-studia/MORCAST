/**
 * EL TEXTO DEL AVISO DE QUE LOS PRECIOS PUEDEN CAMBIAR.
 *
 * ⚠️ COPIA LITERAL de `Web/lib/aviso-precios.mjs`. Los dueños pidieron
 * (4-oct-2026) que junto a CUALQUIER precio o cotización, en la web y en la
 * app, vaya el mismo aviso; la redacción formal es de Luis (5-oct) y está
 * pendiente de revisión por un abogado. Si cambia allá, se copia aquí y en
 * `App Android/src/` palabra por palabra: el cliente no puede leer una cosa
 * en el portal y otra en el teléfono. Hay una prueba que compara las dos
 * copias (`tests/aviso-precios.test.mjs`).
 *
 * Va en .mjs, sin React, para que `node --test` lo importe directo.
 */
export const TEXTO_AVISO_PRECIOS =
  "Las cotizaciones y precios mostrados son estimados de referencia y no constituyen una oferta definitiva. El precio final está sujeto a una revisión del servicio por parte de Morcast del Norte (tipo de residuo, volumen, equipo y condiciones de acceso), por lo que puede ser distinto al cotizado. La cotización final es opcional: usted puede aceptarla o rechazarla sin ningún compromiso.";

/** La misma idea en una línea, para junto a una cifra donde no cabe el texto completo. */
export const TEXTO_AVISO_PRECIOS_CORTO =
  "Precio estimado: el monto final está sujeto a revisión y usted puede aceptarlo o rechazarlo sin compromiso.";
