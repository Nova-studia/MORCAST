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
 * Desde el 7-oct-2026 los precios reales NO van en el codigo: se capturan en
 * /admin/precios (tablas `conceptos` y `precios`, db/027). El Hold se apaga
 * aqui el dia que la lista real este capturada, junto con Luis. No antes:
 * apagar el Hold sin precios deja el cotizador con todo "Precio por
 * confirmar". El interruptor sigue en un archivo y no en un boton del panel.
 * Las apps 1.1.1 lo leen de /api/app/precios, asi que lo siguen solas.
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

/**
 * PESO REAL (RELLENO) — apagado por ahora (6-oct-2026, Luis): "por el
 * momento hay que eliminar Peso real (relleno); cuando lo pida la empresa lo
 * volvemos a habilitar".
 *
 * Apagado se esconden el renglón del menú, la pantalla /admin/viajes, el
 * botón "Poner peso real" de Recolecciones y los textos que lo prometen. NO
 * se borra nada: el código, la base (db/023) y los datos siguen ahí, y el
 * peso del chofer se sigue guardando como estimado. Para volver a
 * encenderlo basta poner `activo: true`.
 */
export const PESO_REAL = { activo: false };

/** ¿Está habilitado el peso real del relleno? Usar esto, no `PESO_REAL.activo` suelto. */
export function pesoRealActivo() {
  return PESO_REAL.activo === true;
}
