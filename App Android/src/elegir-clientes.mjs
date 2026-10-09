/**
 * ELEGIR CLIENTES DE UNA LISTA (apps al 100%, 9-oct-2026): avisos a
 * "Clientes específicos" y el buscador de "Nueva recolección". Como la web:
 * buscar por empresa, folio o correo sin importar acentos, marcar uno por
 * uno, "Marcar todos" (o los que se ven) y "Quitar todos". Puro, con pruebas
 * en tests/oficina-100.test.mjs.
 */

// Sin \p{M}: Hermes no lo garantiza. El rango de marcas combinantes, a mano.
export const normalTexto = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function filtrarClientes(clientes = [], q = "") {
  const t = normalTexto(q).trim();
  if (!t) return clientes;
  return clientes.filter((c) => normalTexto(`${c.empresa} ${c.folio || ""} ${c.correo || ""}`).includes(t));
}

export function alternarId(ids = [], id) {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

/** Suma los que se ven a los ya marcados, sin repetir. */
export const marcarVisibles = (ids = [], visibles = []) => [...new Set([...ids, ...visibles.map((c) => c.id)])];

export const textoMarcados = (n) => `${n} marcado${n === 1 ? "" : "s"}`;
