/**
 * PRECIOS — la lógica pura (sin red, sin React), probada con node --test.
 *
 * La base decide qué precio toca con `precio_de` (db/027). `precioVigente`
 * es su espejo en JS para pintar historiales y para las pruebas: si un día
 * cambia la regla, cambian LOS DOS (tests/precios.test.mjs lo vigila).
 *
 * Los precios se capturan SIN IVA. El 16 % se suma solo a los clientes con
 * "¿Requiere factura?" = Sí (respuesta de la empresa, 7-oct-2026).
 */

export const IVA_FACTURA = 0.16;

export const MODALIDADES = {
  "por-recoleccion": "Por recolección",
  semanal: "Semanal",
  mensual: "Mensual",
  "por-tonelada": "Por tonelada",
};

export function redondear(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/** "$1,250.50" → 1250.5. Máximo 2 decimales y menos de 10 millones. */
export function leerMonto(texto) {
  const limpio = String(texto ?? "").replace(/[$\s]/g, "");
  if (!/^\d{1,3}(,\d{3})*(\.\d{1,2})?$|^\d+(\.\d{1,2})?$/.test(limpio)) {
    return { ok: false, motivo: "Escribe el precio con números, por ejemplo 1250 o 1,250.50." };
  }
  const valor = Number(limpio.replace(/,/g, ""));
  if (!(valor >= 0) || valor >= 10_000_000) return { ok: false, motivo: "Ese precio no se ve bien. Revísalo." };
  return { ok: true, valor };
}

export function claveDe(nombre) {
  return String(nombre || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/³/g, "3").replace(/²/g, "2")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

export function validarConcepto({ nombre, unidad, modalidad } = {}) {
  const n = String(nombre || "").trim();
  const u = String(unidad || "").trim();
  if (n.length < 2 || n.length > 120) return { ok: false, motivo: "Escribe el nombre del concepto." };
  if (u.length < 2 || u.length > 60) return { ok: false, motivo: "Escribe la unidad (por ejemplo: por recolección)." };
  if (!MODALIDADES[modalidad]) return { ok: false, motivo: "Elige cómo se cobra." };
  const clave = claveDe(n);
  if (clave.length < 2) return { ok: false, motivo: "El nombre necesita letras o números." };
  return { ok: true, limpio: { clave, nombre: n, unidad: u, modalidad } };
}

const ordenar = (a, b) =>
  new Date(b.vale_desde) - new Date(a.vale_desde) || new Date(b.creado) - new Date(a.creado);

/** Espejo de `precio_de` (db/027). */
export function precioVigente(renglones, { clienteId, conceptoId, en = new Date() }) {
  const hasta = new Date(en).getTime();
  const vale = (r) => r.concepto_id === conceptoId && new Date(r.vale_desde).getTime() <= hasta;
  const especial = renglones.filter((r) => vale(r) && clienteId && r.cliente_id === clienteId).sort(ordenar)[0];
  if (especial && !especial.quitado) return Number(especial.precio);
  const lista = renglones.filter((r) => vale(r) && r.cliente_id == null).sort(ordenar)[0];
  return lista ? Number(lista.precio) : null;
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
