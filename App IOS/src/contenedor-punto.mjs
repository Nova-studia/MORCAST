/**
 * ¿EL CONTENEDOR QUE ESCANEÓ EL CHOFER ES DE ESTE PUNTO?
 *
 * Los dueños están haciendo el inventario de contenedores (db/023) y a cada
 * uno le pegan un QR con su código (`MOR-C-0421`). Al escanearlo en una
 * parada se compara con los contenedores registrados en ESE punto. Si no
 * cuadra, hay dos explicaciones y las dos le importan a la oficina: el
 * contenedor se movió de un cliente a otro, o el inventario está mal.
 *
 * Lo que NO se hace es bloquear al chofer: el servicio sí se hizo, y no
 * poder registrarlo por un error de inventario sería peor. Se le avisa
 * claro y él decide si continúa o reporta "contenedor movido".
 *
 * `normalizarCodigo` es la de `Web/lib/contenedores.mjs` (copiada): sin
 * ella, "mor-c-421" escrito a mano no encontraría a "MOR-C-0421".
 */

export const PREFIJO = "MOR-C-";

/** Lleva lo que se escanea o teclea al formato canónico, o null. */
export function normalizarCodigo(texto) {
  const limpio = String(texto ?? "").trim().toUpperCase();
  if (!limpio) return null;
  const m = /^(?:MOR[\s-]*C[\s-]*)?(\d{1,4})$/.exec(limpio);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isInteger(n) || n < 1 || n > 9999) return null;
  return `${PREFIJO}${String(n).padStart(4, "0")}`;
}

/**
 * Compara el código contra los contenedores del punto.
 *
 * Devuelve:
 *   · `del-punto`      → es uno de los registrados aquí. Todo bien.
 *   · `ajeno`          → el punto tiene inventario y este código no está.
 *   · `sin-inventario` → el punto todavía no tiene contenedores dados de
 *                        alta: no hay contra qué comparar y NO se avisa,
 *                        porque hoy sería todos los puntos y el chofer
 *                        aprendería a ignorar el aviso.
 *   · `vacio`          → no hay código.
 */
export function revisarContenedor(codigo, contenedoresDelPunto) {
  const leido = String(codigo ?? "").trim();
  if (!leido) return { estado: "vacio", codigo: "" };

  const lista = Array.isArray(contenedoresDelPunto) ? contenedoresDelPunto : [];
  // Se compara normalizado cuando se puede; si el QR trae otra cosa (una
  // calcomanía vieja, un código de otro sistema) se compara tal cual.
  const canon = normalizarCodigo(leido) || leido.toUpperCase();
  if (!lista.length) return { estado: "sin-inventario", codigo: canon };

  const hallado = lista.find(
    (c) => (normalizarCodigo(c?.codigo) || String(c?.codigo || "").toUpperCase()) === canon
  );
  return hallado
    ? { estado: "del-punto", codigo: canon, contenedor: hallado }
    : { estado: "ajeno", codigo: canon };
}
