/**
 * LAS REGLAS DE LIMPIEZA DEL CUADERNO.
 *
 * Funciones PURAS: no tocan red, ni disco, ni la base. Por eso se pueden
 * probar de verdad, y por eso cada regla de aqui nace de un renglon real del
 * cuaderno que la empresa devolvio el 27-ago-2026.
 *
 * `extraer.py` deja el volcado fiel; aqui es donde se decide que significa.
 */

import { hayDato } from "../../lib/estado-cliente.mjs";

/** Un dato de verdad, o `null`. Nunca la cadena "N-A". */
export function limpio(txt) {
  const v = String(txt ?? "").trim();
  return hayDato(v) ? v : null;
}

/**
 * Solo los digitos. El cuaderno trae "(868)1490531" y "868 170 7754".
 * No se valida el largo: hay telefonos de 7 digitos legitimos en la region y
 * rechazarlos perderia el unico contacto de ese cliente.
 */
export function telefono(txt) {
  const v = limpio(txt);
  if (!v) return null;
  const digitos = v.replace(/\D/g, "");
  return digitos.length ? digitos : null;
}

/**
 * ¿Este "domicilio fiscal" es en realidad el REGIMEN fiscal?
 *
 * En 28 de los 42 clientes la empresa escribio "General de Ley Personas
 * Morales" en la columna del domicilio. No es basura: es un dato bueno en el
 * cajon equivocado, y `clientes.regimen` existe y esta vacia. Se muda, no se
 * tira.
 */
export function esRegimen(txt) {
  const v = String(txt ?? "").toLowerCase();
  return /r[eé]gimen|ley\s+personas|personas?\s+morales|personas?\s+f[ií]sicas|simplificado\s+de\s+confianza/.test(v);
}

/**
 * La clave con la que se comparan nombres entre hojas.
 *
 * Sin acentos (el cuaderno escribe "CINEPOLIS" y "CINÉPOLIS"), sin apostrofes
 * ("MCDONALD'S"), con los guiones como espacio ("Carne-Mart" vs "CARNE MART")
 * y sin espacios dobles.
 *
 * ⚠️ Esto NO es para adivinar a que cliente pertenece un punto huerfano. Eso
 * se resuelve UNICAMENTE en `equivalencias.js`, a mano. Esto sirve para que
 * "  Carne-Mart " y "CARNE MART" se reconozcan como el mismo texto, no para
 * decidir que dos nombres parecidos son la misma empresa.
 */
export function nombreClave(txt) {
  return String(txt ?? "")
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    // Comillas simples Y DOBLES. El cuaderno trae `Carne-Mart "Coliseo"` con
    // comillas dobles y la hoja de clientes lo llama `CARNE MART` a secas: sin
    // quitarlas, esos dos nombres nunca se reconocen como el mismo.
    .replace(/['’"“”]/g, "")
    .replace(/-/g, " ")
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

/**
 * Un renglon de ayuda del cuaderno que se colo entre los datos.
 *
 * En la hoja 4 aparecio el texto "RECOLECCIONES AL MES es el dato que mas
 * importa..." ocupando la columna de empresa. Sin esta regla se habria
 * intentado mapear como un servicio de una empresa de 180 caracteres, y el
 * script se habria detenido pidiendo una equivalencia para algo que no es un
 * cliente.
 *
 * Se reconoce por lo que es —una frase larga, sola en su renglon— y no por su
 * texto exacto: si la empresa reenvia el cuaderno con la ayuda reacomodada,
 * la regla sigue sirviendo.
 */
export function esRenglonDeInstrucciones(fila) {
  const primera = String(fila?.[0] ?? "").trim();
  if (primera.length < 80) return false;
  const restoVacio = (fila || []).slice(1).every((c) => !String(c ?? "").trim());
  return restoVacio;
}
