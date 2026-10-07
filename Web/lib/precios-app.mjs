import { precioVigente, redondear, IVA_FACTURA } from "./precios.mjs";

/** Lo que recibe la app. La regla de precios es la de la web: la app no calcula nada. */
export function respuestaPrecios({ hold, requiereFactura, conceptos, renglones, clienteId }) {
  const iva = requiereFactura ? IVA_FACTURA : 0;
  return {
    ok: true,
    hold: Boolean(hold),
    iva,
    requiereFactura: clienteId ? Boolean(requiereFactura) : null,
    conceptos: (conceptos || []).map((k) => {
      const vigente = hold ? null : precioVigente(renglones, { clienteId, conceptoId: k.id });
      const lista = precioVigente(renglones, { clienteId: null, conceptoId: k.id });
      return {
        clave: k.clave, nombre: k.nombre, unidad: k.unidad, modalidad: k.modalidad,
        precio: vigente,
        precioConIva: vigente == null ? null : redondear(vigente * (1 + iva)),
        especial: !hold && clienteId != null && vigente != null && vigente !== lista,
      };
    }),
  };
}
