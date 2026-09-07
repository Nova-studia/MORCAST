/**
 * Paleta y tokens de la app Morcast — mismo look que la web (tema oscuro).
 *
 * PUESTA AL DÍA EL 7-sep-2026
 * La web cambió de sistema de color el 3-sep y estas apps se quedaron con el
 * anterior: verde `#4eb34a`, teal `#144c4f` y naranja `#db652d`. Eran, en la
 * práctica, dos productos con la misma marca. Aquí quedaron alineadas.
 *
 * EL CRITERIO, que es lo que hay que respetar al agregar pantallas:
 *   · ACCIÓN → azul. Botón, chip elegido, segmento activo. En las tres
 *     zonas (cliente, panel y chofer) significa lo mismo: esto se pulsa.
 *   · MARCA → verde, y sólo como relleno grande (avatar, barra).
 *   · ESTADO → ok / alerta / error / ruta. Informan, no decoran.
 *   · CAMPO → el naranja se conserva SÓLO en el modo chofer, donde es
 *     señalización: se usa en la calle, con sol y con guantes.
 *
 * 🔴 Sobre un relleno de `verde` o de `accion` el texto va BLANCO. El casi
 * negro `#0d1211` que había antes daba 2.19:1 contra el verde de marca y
 * literalmente no se leía.
 *
 * ⚠️ ESTE ARCHIVO ESTÁ DUPLICADO en `App IOS/src/tema.js`. Al tocarlo, tocar
 * el espejo. Las dos apps no comparten código.
 */
export const T = {
  fondo: "#121516",       // fondo de pantalla   (era #0f1615)
  panel: "#1b1f20",       // tarjetas            (era #16201f)
  panel2: "#191d1e",      // superficies internas / inputs
  linea: "#2a2f30",       // bordes
  tinta: "#ecedea",       // texto principal
  gris: "#9ba3a1",        // texto secundario
  grisClaro: "#6e7877",   // texto tenue

  // --- Acción -------------------------------------------------------------
  accion: "#2a6a99",      // relleno del botón. Texto BLANCO encima: 5.80:1
  accionH: "#215579",     // pulsado
  accionTxt: "#6ba3cf",   // el azul cuando es TINTA (icono, enlace): 6.15:1
  accionTinte: "rgba(42,106,153,0.15)",

  // --- Marca --------------------------------------------------------------
  verdeMarca: "#265421",  // relleno grande. NUNCA como texto: 2.07:1
  verdeTxt: "#6fa867",    // el verde cuando es tinta: 5.91:1

  // --- Estado -------------------------------------------------------------
  ok: "#6fa867",
  alerta: "#d6a44a",
  error: "#d9776b",
  ruta: "#e0955f",        // "en ruta": es un estado, no un color de marca

  // --- Seña de área y campo ----------------------------------------------
  admin: "#db652d",       // sólo el distintivo del panel, no sus botones
  adminTxt: "#f0895c",
  campo: "#db652d",       // el naranja del modo chofer (señalización)

  blanco: "#ffffff",

  /* ---------------------------------------------------------------------
     ALIAS DE COMPATIBILIDAD
     Los nombres viejos siguen vivos porque los usan ~90 sitios repartidos
     por las pantallas, y renombrarlos todos de golpe era mucha superficie
     para romper de una sentada. Lo que cambió es a QUÉ apuntan:

       verde       → la ACCIÓN (azul). Así lo usaban 13 de sus 15 sitios:
                     chips activos, botones y segmentos. O sea que el nombre
                     mentía desde antes; ahora al menos el color es correcto.
       verdeClaro  → el estado "bien" (ok)
       teal        → superficie, ya no un color propio
       tealClaro   → el azul de tinta, que es como se usaba: iconos
                     informativos y acentos
       naranja     → el naranja de campo/panel, sin cambio de tono

     Al tocar una pantalla, cambia sus `T.verde` por `T.accion` (o por
     `T.verdeMarca` si de verdad era marca) y borra el alias cuando ya no
     lo use nadie. --------------------------------------------------- */
  verde: "#2a6a99",
  verdeClaro: "#6fa867",
  teal: "#1b1f20",
  tealClaro: "#6ba3cf",
  naranja: "#db652d",
  naranjaClaro: "#f0895c",
};

// Colores de estatus (badges), igual que la web
export const BADGE = {
  ok:   { bg: "rgba(111,168,103,0.16)", fg: "#6fa867" },
  prog: { bg: "rgba(42,106,153,0.18)",  fg: "#6ba3cf" },
  ruta: { bg: "rgba(224,149,95,0.18)",  fg: "#e0955f" },
  // Rechazada / cancelada. La usan las solicitudes de recolección.
  mal:  { bg: "rgba(217,119,107,0.18)", fg: "#d9776b" },
  none: { bg: "rgba(155,163,161,0.16)", fg: "#9ba3a1" },
};

/**
 * Paleta de las GRÁFICAS. Espejo de `Web/lib/paleta-datos.js`.
 *
 * Cinco tonos generados en OKLCH y validados (banda de luminosidad, piso de
 * saturación, separación para daltonismo, separación para visión normal y
 * contraste), en oscuro y en claro — los PDF van sobre blanco.
 *
 * 🔴 El orden no es decorativo: el validador compara pares adyacentes y casi
 * ningún otro orden pasa. Si se reordena, hay que volver a validar.
 */
export const SERIES = ["#479B57", "#348DCF", "#C36286", "#B07A00", "#009DA0"];

/** Colores fijos por tipo de residuo: el color sigue al tipo, no a su lugar. */
export const COLOR_TIPO = {
  "Residuos Sólidos Urbanos": SERIES[0],
  "Manejo Especial": SERIES[1],
  "Aguas Oleosas": SERIES[2],
  "Aguas Residuales": SERIES[3],
  Reciclaje: SERIES[4],
};

export const radio = 14;
export const espacio = 16;
