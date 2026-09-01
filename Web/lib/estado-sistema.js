/**
 * EL MODO HOLD — Morcast todavia no esta cobrando.
 *
 * DE DONDE SALE ESTO
 * El 1-sep-2026 se cargo la operacion real (42 clientes, 68 puntos, 64
 * servicios) desde el cuaderno que devolvio la empresa. Pero el cuaderno
 * llego con CERO precios en los 64 servicios, asi que los 12 montos del
 * cotizador siguen siendo los que invento Claude en agosto.
 *
 * Mientras eso siga asi, el sistema tiene los datos pero NO puede hablar de
 * dinero con el cliente. Este interruptor lo dice en voz alta, dentro del
 * propio sistema, en vez de dejarlo en la memoria de quien lo construyo.
 *
 * COMO SE APAGA
 * Se apaga en el MISMO commit en que entran los precios reales a
 * `CATALOGO_COTIZADOR` (lib/portal-datos.js). No antes: apagar el Hold sin
 * precios cargados devuelve al cotizador los montos inventados. Por eso el
 * interruptor vive en un archivo y no en una tabla con un boton en el panel:
 * el boton daria una libertad que en realidad no existe.
 */
export const HOLD = {
  activo: true,
  titulo: "Sistema en preparación",
  motivo:
    "Estamos cargando la operación y afinando la lista de precios. " +
    "Todavía no se generan cobros.",
  desde: "2026-09-01",
};

/** ¿Está el sistema en espera? Usar esto, no `HOLD.activo` suelto. */
export function enHold() {
  return HOLD.activo === true;
}
