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

/* ==================================================================== */
/* DIAS, TIPO DE RUTA Y FRECUENCIA                                      */
/* ==================================================================== */

/** El orden de la semana laboral, empezando en lunes. `DIAS_SEMANA` no sirve
 *  aqui porque su orden es el del panel, y para resolver rangos hace falta
 *  saber que el domingo va AL FINAL. */
const ORDEN = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

/** Sin acentos y en minusculas, para comparar contra lo que tecleo la empresa. */
const pelado = (s) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const PELADOS = ORDEN.map(pelado); // ["lunes", ..., "miercoles", ...]

/**
 * Los dias en que se pasa, sacados del texto libre del cuaderno.
 *
 * La empresa escribio: "LUNES", "miercoles", "LUNES Y JUEVES",
 * "MARTES Y VIERNES", "LUNES A SABADO", "LUNES A DOMINGO" y "POR LLAMADA"
 * (hoja "1 Rutas", columna "Días que pasa").
 *
 * "POR LLAMADA" NO ES UN DIA, y es la unica de estas que importa de verdad:
 * son 8 puntos que se atienden cuando el cliente llama. Meterlos en un dia
 * fijo inventaria una visita que nadie acordo, y dejarlos sin ninguna marca
 * los volveria invisibles en la agenda. Se devuelve la bandera aparte.
 */
export function diasDesdeTexto(txt) {
  const v = pelado(limpio(txt) ?? "");
  if (!v) return { dias: [], porLlamada: false };

  if (/por\s+llamada|a\s+solicitud|cuando\s+llam/.test(v)) {
    return { dias: [], porLlamada: true };
  }

  // Rango: "lunes a sabado", "lunes a domingo".
  const rango = v.match(/(\w+)\s+a\s+(\w+)/);
  if (rango) {
    const desde = PELADOS.indexOf(rango[1]);
    const hasta = PELADOS.indexOf(rango[2]);
    if (desde >= 0 && hasta >= desde) {
      return { dias: ORDEN.slice(desde, hasta + 1), porLlamada: false };
    }
  }

  // Lista: "lunes y jueves", "martes, viernes".
  const dias = ORDEN.filter((_, i) => new RegExp(`\\b${PELADOS[i]}\\b`).test(v));
  return { dias, porLlamada: false };
}

/** Los tres tipos de `rutas.tipo`, como los escribio la empresa (hoja "1
 *  Rutas", columna "Tipo": "manual", "compactador ", "roll off", "ROLL -OFF"). */
export function tipoDeRuta(txt) {
  const v = pelado(limpio(txt) ?? "").replace(/[\s-]/g, "");
  if (!v) return null;
  if (v.includes("rolloff")) return "roll-off";
  if (v.includes("compactador")) return "compactador";
  if (v.includes("manual")) return "manual";
  return null;
}

/**
 * `RUTA 10` y `RUTA10` son la misma ruta.
 * El cuaderno usa las dos formas en hojas distintas (nombre de ruta en la
 * hoja "1 Rutas" contra la columna de ruta en "3 Puntos de recoleccion").
 */
export function claveDeRuta(txt) {
  const v = limpio(txt);
  if (!v) return null;
  const m = pelado(v).match(/ruta\s*0*(\d+)/);
  return m ? `RUTA-${Number(m[1])}` : null;
}

/**
 * De "recolecciones al mes" a la frecuencia que acepta `suscripciones`.
 *
 * Es una simplificacion, y a proposito: el numero EXACTO se guarda en
 * `suscripciones.servicios_por_mes`, asi que nada se pierde al redondear
 * aqui. `frecuencia` sirve para decirle al cliente "cada cuando pasamos";
 * el conteo real vive en la otra columna.
 */
export function frecuenciaPorMes(n) {
  // El saneo tiene que CONSERVAR el signo, no solo los digitos: si se borra
  // el "-" junto con la basura, -5 se convierte en 5 y sale "semanal", la
  // frecuencia MAS agresiva justo cuando el dato dice lo contrario.
  const v = Number(String(n ?? "").replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(v) || v <= 0) return "mensual";
  if (v >= 4) return "semanal";
  if (v >= 2) return "quincenal";
  return "mensual";
}
