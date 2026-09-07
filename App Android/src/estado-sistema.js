/**
 * EL MODO HOLD — Morcast todavía no está cobrando.
 *
 * ESPEJO de `Web/lib/estado-sistema.js`. La web lo tiene desde el 1-sep-2026
 * y estas apps NO, que es justo el problema que vino a resolver este archivo:
 * durante once días el portal web le decía al cliente "todavía no se generan
 * cobros" mientras la app, en el mismo teléfono y con la misma cuenta, le
 * enseñaba un cotizador con doce precios y le sacaba un PDF con totales.
 *
 * DE DÓNDE SALE
 * El 1-sep-2026 se cargó la operación real (43 clientes, 70 puntos, 69
 * servicios) del cuaderno que devolvió la empresa. El cuaderno llegó con CERO
 * precios, así que los doce montos de `CATALOGO_COTIZADOR` siguen siendo los
 * que se inventaron en agosto para poder enseñar el flujo.
 *
 * CÓMO SE APAGA
 * En el MISMO commit en que entren los precios reales, y en las TRES partes a
 * la vez: aquí, en `App IOS/src/estado-sistema.js` y en la web. No antes:
 * apagarlo sin precios cargados devuelve los montos inventados al cotizador.
 * Por eso vive en un archivo y no en un botón del panel — el botón daría una
 * libertad que en realidad no existe.
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
 * Lo que va donde iría una cifra mientras el Hold esté encendido.
 * Un guion largo, no un cero: un cero es una cantidad y se lee como "no
 * debes nada", y eso todavía no lo sabemos.
 */
export const SIN_CIFRA = "—";

/**
 * Envuelve un monto ya formateado. Del lado del CLIENTE las cifras se apagan;
 * del lado de MORCAST se dejan ver, porque ahí son sumas reales de la base y
 * quien las lee sabe de dónde salen.
 */
export function montoCliente(textoFormateado) {
  return enHold() ? SIN_CIFRA : textoFormateado;
}
