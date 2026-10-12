import { encode } from "uqr";
import { enlaceGafete } from "./gafetes.mjs";

/**
 * EL GAFETE IMPRESO — las medidas (sin React ni Supabase).
 *
 * La hoja para la imprenta lleva UNA CARA POR PÁGINA: la tarjeta CR80 con su
 * sangría alrededor y marcas de corte afuera. Aquí viven todos los números,
 * en milímetros, para que la pantalla (app/(admin)/admin/personal/imprimir)
 * solo dibuje y para poder probarlos (tests/gafete-impresion.test.mjs).
 *
 * El diseño es el v3 aprobado (Morcast Gafetes\propuesta\gafete-v3-tarjeta.html):
 * franjas en diagonal con los colores del logo, y la vuelta sin datos
 * personales (QR, enlace, chip y PIN).
 *
 * La única dependencia es `uqr`, que ya usa lib/contenedores.mjs.
 */

/** Tarjeta CR80, la de una tarjeta bancaria (ISO/IEC 7810 ID-1). */
export const TARJETA = { ancho: 54, alto: 85.6, radio: 3.18 };
/** Lo que el fondo se pasa del corte, para que no quede un filo blanco si la guillotina se mueve. */
export const SANGRIA = 2;
/** El borde de la página, fuera de la sangría, donde van las marcas de corte. */
export const MARGEN = 6;
/** Colores medidos del logo: son los de la tarjeta impresa, no los de la web. */
export const COLOR = { teal: "#044D57", naranja: "#F77B39" };
/** La ranura del cordón la troquela la imprenta: no se imprime, pero nada va ahí. */
export const RANURA = { ancho: 13, alto: 3.2, arriba: 3 };

const r2 = (n) => Math.round(n * 100) / 100;

/**
 * La página de una cara: su tamaño, dónde cae la tarjeta y dónde la sangría.
 * 54 + 2·2 + 2·6 = 70 mm de ancho; 85.6 + 4 + 12 = 101.6 mm de alto.
 */
export function medidasDePagina() {
  const borde = MARGEN + SANGRIA;
  return {
    ancho: r2(TARJETA.ancho + 2 * borde),
    alto: r2(TARJETA.alto + 2 * borde),
    tarjeta: { x: borde, y: borde, ancho: TARJETA.ancho, alto: TARJETA.alto },
    sangria: { x: MARGEN, y: MARGEN, ancho: TARJETA.ancho + 2 * SANGRIA, alto: r2(TARJETA.alto + 2 * SANGRIA) },
  };
}

/**
 * Las ocho marcas de corte, dos por esquina, sobre las líneas del corte y
 * FUERA de la sangría (dejan 1 mm de aire para no manchar el fondo).
 */
export function marcasDeCorte() {
  const { ancho, alto, tarjeta } = medidasDePagina();
  const hasta = MARGEN - 1; // la marca termina 1 mm antes de la sangría
  const desde = 0.5;
  const marcas = [];
  for (const y of [tarjeta.y, r2(tarjeta.y + tarjeta.alto)]) {
    marcas.push({ x1: desde, y1: y, x2: hasta, y2: y }, { x1: r2(ancho - hasta), y1: y, x2: r2(ancho - desde), y2: y });
  }
  for (const x of [tarjeta.x, tarjeta.x + tarjeta.ancho]) {
    marcas.push({ x1: x, y1: desde, x2: x, y2: hasta }, { x1: x, y1: r2(alto - hasta), x2: x, y2: r2(alto - desde) });
  }
  return marcas;
}

/**
 * Las franjas de cada cara. Cada una va entre dos líneas inclinadas, dadas
 * por su altura en el borde izquierdo y en el derecho de la TARJETA (en mm
 * desde arriba). `null` es el borde de la página.
 */
const FRANJAS = {
  frente: [
    { arriba: null, abajo: [25, 19], color: COLOR.teal },
    { arriba: [25, 19], abajo: [29.5, 23.5], color: COLOR.naranja },
    { arriba: [30.4, 24.4], abajo: [31.5, 25.5], color: COLOR.naranja },
    { arriba: [81.4, 75.4], abajo: [82.5, 76.5], color: COLOR.naranja },
    { arriba: [82.5, 76.5], abajo: null, color: COLOR.teal },
  ],
  vuelta: [
    { arriba: null, abajo: [16.5, 10.5], color: COLOR.teal },
    { arriba: [16.5, 10.5], abajo: [19.3, 13.3], color: COLOR.naranja },
    { arriba: [81.4, 75.4], abajo: [82.5, 76.5], color: COLOR.naranja },
    { arriba: [82.5, 76.5], abajo: null, color: COLOR.teal },
  ],
};

/**
 * Los polígonos del fondo de una cara, YA con sangría: cada franja se alarga
 * 2 mm hacia los cuatro lados siguiendo su misma inclinación, para que el
 * dibujo no se quiebre en la línea de corte. Coordenadas en mm con el origen
 * en la esquina de la tarjeta (van de -2 a 56 y de -2 a 87.6); `caja` es el
 * viewBox que las contiene.
 */
export function fondoDeCara(cara) {
  const x0 = -SANGRIA;
  const x1 = TARJETA.ancho + SANGRIA;
  const cima = -SANGRIA;
  const base = r2(TARJETA.alto + SANGRIA);
  // La línea [izq, der] alargada a los bordes de la sangría.
  const alargar = (linea, borde) => {
    if (!linea) return [borde, borde];
    const pendiente = (linea[1] - linea[0]) / TARJETA.ancho;
    return [r2(linea[0] + pendiente * x0), r2(linea[0] + pendiente * x1)];
  };
  return {
    caja: `${x0} ${cima} ${x1 - x0} ${r2(base - cima)}`,
    franjas: FRANJAS[cara].map((f) => {
      const [a0, a1] = alargar(f.arriba, cima);
      const [b0, b1] = alargar(f.abajo, base);
      return { color: f.color, puntos: `${x0},${a0} ${x1},${a1} ${x1},${b1} ${x0},${b0}` };
    }),
  };
}

/**
 * El fondo de seguridad del frente (guilloche): dos familias de ondas finas
 * que se cruzan, como en una credencial oficial. Devuelve el trazo para un
 * <path> en las mismas coordenadas de `fondoDeCara`.
 */
export function guilloche({ desde = 33, hasta = 80 } = {}) {
  const paso = 1.9, amplitud = 1.35, onda = 12.5;
  const x0 = -SANGRIA, x1 = TARJETA.ancho + SANGRIA;
  let d = "";
  for (let familia = 0; familia < 2; familia++) {
    for (let y = desde; y <= hasta; y += paso) {
      for (let x = x0; x <= x1 + 1e-6; x += 0.4) {
        const yy = y + amplitud * Math.sin((2 * Math.PI * x) / onda + familia * Math.PI)
          + 0.35 * Math.sin((2 * Math.PI * x) / (onda / 3) + y * 0.7);
        d += `${x === x0 ? "M" : "L"}${x.toFixed(2)} ${yy.toFixed(2)}`;
      }
    }
  }
  return d;
}

/** Lado del QR impreso, en mm. */
export const LADO_QR = 24;

/**
 * El QR del enlace de un gafete, listo para un <svg>: `tam` en módulos y `d`
 * el trazo de los negros (sin margen: alrededor ya hay tarjeta blanca).
 *
 * Corrección **Q** (aguanta ~25 % dañado): el gafete cuelga del cuello todo
 * el día y se raya. El enlace cabe en la versión 3 (29 módulos), que a 24 mm
 * da módulos de 0.83 mm: los lee cualquier teléfono.
 */
export function qrDeGafete(codigo) {
  const enlace = enlaceGafete(codigo);
  if (!enlace) return null;
  const qr = encode(enlace, { ecc: "Q", border: 0 });
  let d = "";
  qr.data.forEach((fila, y) => {
    fila.forEach((negro, x) => {
      if (negro) d += `M${x} ${y}h1v1h-1z`;
    });
  });
  return { tam: qr.size, d, version: qr.version, enlace, modulo: r2(LADO_QR / qr.size) };
}

/**
 * Las páginas de la hoja, en el orden en que se imprimen:
 *   · "tarjeta": frente y vuelta de cada gafete, seguidos (impresora a dos caras).
 *   · "caras": todos los frentes y luego todas las vueltas, en el mismo orden.
 */
export function paginasDeImpresion(gafetes, orden = "tarjeta") {
  const lista = gafetes || [];
  if (orden === "caras") {
    return [...lista.map((g) => ({ cara: "frente", gafete: g })), ...lista.map((g) => ({ cara: "vuelta", gafete: g }))];
  }
  return lista.flatMap((g) => [{ cara: "frente", gafete: g }, { cara: "vuelta", gafete: g }]);
}
