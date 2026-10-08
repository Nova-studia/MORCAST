/**
 * PRECIOS Y HOLD EN LA APP — lógica pura (8-oct-2026).
 *
 * `redondear`, `lineasDeCotizador` y `cotizar` son COPIA LITERAL de
 * `Web/lib/precios.mjs`: la prueba `tests/precios-logica.test.mjs` compara
 * las dos. Si cambias una, cambia la otra.
 *
 * Los precios, el IVA y el Hold los decide la web (/api/app/precios). La app
 * solo decide qué hacer cuando todavía no tiene respuesta: quedarse en Hold,
 * para no enseñar nunca montos inventados.
 */

export const IVA_FACTURA = 0.16;

export const TEXTO_IVA =
  "Los precios no incluyen IVA. A quien requiere factura se le suma el 16% sobre el subtotal.";

/**
 * ¿La app está en Hold?
 *   · La cuenta de revisión de las tiendas nunca (tiene su catálogo de ejemplo).
 *   · Sin respuesta del servidor ni copia guardada: lo que diga el Hold local.
 *   · Con respuesta: lo que diga la web.
 */
export function decidirHold({ respuesta, holdLocal, esMuestra }) {
  if (esMuestra) return false;
  if (!respuesta) return Boolean(holdLocal);
  return respuesta.hold === true;
}

/** Los conceptos que ve el cotizador y si se suma IVA. */
export function catalogoDe({ respuesta, esMuestra, catalogoMuestra }) {
  if (esMuestra) {
    return {
      requiereFactura: true,
      conceptos: (catalogoMuestra || []).map((s) => ({ id: s.id, nombre: s.servicio, unidad: s.unidad, precio: s.precio })),
    };
  }
  if (!respuesta) return { conceptos: [], requiereFactura: false };
  return {
    requiereFactura: Boolean(respuesta.requiereFactura),
    conceptos: (respuesta.conceptos || []).map((k) => ({ id: k.clave, nombre: k.nombre, unidad: k.unidad, precio: k.precio })),
  };
}

// ---- Copia literal de Web/lib/precios.mjs ----
export function redondear(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

export function cotizar(lineas, { requiereFactura }) {
  const sinPrecio = [];
  const conPrecio = [];
  for (const l of lineas || []) {
    const cantidad = Math.max(0, Number(l.cantidad) || 0);
    if (!cantidad) continue;
    if (l.precio == null) { sinPrecio.push(l.nombre); continue; }
    conPrecio.push({ ...l, cantidad, importe: redondear(Number(l.precio) * cantidad) });
  }
  const subtotal = redondear(conPrecio.reduce((t, l) => t + l.importe, 0));
  const iva = requiereFactura ? redondear(subtotal * IVA_FACTURA) : 0;
  return { lineas: conPrecio, subtotal, iva, total: redondear(subtotal + iva), sinPrecio };
}

/** Del estado del cotizador ({ conceptoId: cantidad }) a las líneas de `cotizar`. */
export function lineasDeCotizador(catalogo, cantidades) {
  return (catalogo || [])
    .filter((k) => Number(cantidades?.[k.id]) > 0)
    .map((k) => ({ conceptoId: k.id, nombre: k.nombre, unidad: k.unidad, precio: k.precio, cantidad: Number(cantidades[k.id]) }));
}
