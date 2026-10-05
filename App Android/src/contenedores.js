/**
 * CONTENEDORES: el código del QR y si es del punto que se está visitando.
 *
 * El formato `MOR-C-0421` sale de `Web/lib/contenedores.mjs` (ahí está la
 * historia). Aquí solo hace falta leerlo y compararlo, no generar QR.
 *
 * Pedido (5-oct-2026): al escanear, comprobar que el contenedor sea DE ESE
 * punto. Si el chofer escanea el de la empresa de al lado, la evidencia queda
 * a nombre de otro contenedor y el inventario miente. Pero el chofer no puede
 * quedarse atorado: se le avisa claro y él decide (seguir o reportar
 * "contenedor movido"). Lógica pura para probarla con `node --test`.
 */

export const PREFIJO = "MOR-C-";

/**
 * Lleva lo que escanea o teclea el chofer al formato canónico. Acepta
 * minúsculas, espacios, sin guiones y sin ceros ("mor c 421", "MORC0421",
 * "421"). Lo que no se parece a un código devuelve `null`.
 */
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
 * Compara el código leído con los contenedores registrados en el punto.
 *
 * @param {string} leido      lo que dio el escáner o lo que se tecleó
 * @param {Array|null} delPunto contenedores del punto (`null` = no se pudieron leer)
 * @returns {{estado: "ok"|"ajeno"|"sin-inventario"|"sin-datos", codigo: string, contenedor?: object}}
 *   · ok             — es de este punto.
 *   · ajeno          — el punto SÍ tiene contenedores y este no es ninguno.
 *   · sin-inventario — el punto todavía no tiene contenedores registrados
 *                      (el inventario se está haciendo): no hay con qué comparar.
 *   · sin-datos      — no se pudo leer la lista (sin señal): no se frena al chofer.
 *   `codigo` es el canónico si se pudo normalizar; si no, lo leído tal cual.
 */
export function revisarContenedor(leido, delPunto) {
  const crudo = String(leido ?? "").trim();
  const canonico = normalizarCodigo(crudo);
  const codigo = canonico || crudo;

  if (delPunto == null) return { estado: "sin-datos", codigo };
  if (!delPunto.length) return { estado: "sin-inventario", codigo };

  const encontrado = canonico ? delPunto.find((c) => normalizarCodigo(c.codigo) === canonico) : null;
  if (encontrado) return { estado: "ok", codigo: canonico, contenedor: encontrado };
  return { estado: "ajeno", codigo };
}
