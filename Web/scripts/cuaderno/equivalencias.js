/**
 * LOS NOMBRES ROTOS DEL CUADERNO, RESUELTOS A MANO.
 *
 * POR QUE ESTO NO SE HACE POR PARECIDO DE TEXTO
 * Amarrar un servicio a la empresa equivocada es facturarle a quien no era.
 * Un algoritmo de similitud acertaria en 19 de 21 casos y fallaria en 2, en
 * silencio, y nadie se enteraria hasta que llegara una factura ajena. Esta
 * tabla se escribe a mano, se revisa, y lo que no este aqui DETIENE el
 * script (`cargar.mjs`, Task 13).
 *
 * DE DONDE SALEN LOS ERRORES
 * En KARZO y en Nacionales, la empresa escribio el nombre de la SUCURSAL en
 * la columna de empresa. No son clientes nuevos: son puntos de un cliente que
 * si existe. Se ve claro porque el nombre de la sucursal empieza con el del
 * cliente ("KARZO SEXTA", "NACIONAL MAYOREO") y porque la hoja 2 no los
 * tiene como cliente aparte.
 *
 * COMO SE SACO ESTA LISTA
 * Corriendo sobre `cuaderno.json` (27-ago-2026): 21 nombres de la hoja "3
 * Puntos de recoleccion" que no existen en la hoja "2 Clientes", y 12
 * renglones de la hoja "4 Servicio contratado" cuya pareja empresa+punto no
 * amarra con ningun punto de la hoja 3.
 *
 * 1-sep-2026: Luis resolvio los 3 casos que habian quedado en SIN_RESOLVER
 * (LLANTERA, KARZINI, TPI) y corrigio un error propio en el mapeo de
 * NACIONAL AV DEL NIÑO. Detalle de cada decision en los comentarios de abajo
 * y en el reporte de la Task 11.
 */

/**
 * Nombre tal como aparece en el cuaderno (ya pasado por `nombreClave`) →
 * empresa real de la hoja 2 (o de `CLIENTES_EXTRA`, para KARZINI).
 *
 * ⚠️ Las llaves van EXACTAMENTE en la forma que produce `nombreClave()`:
 * MAYUSCULAS, sin acentos, sin comillas ni apostrofes, guiones como espacio,
 * espacios colapsados.
 *
 * 🔴 LA TRAMPA: la normalizacion NFD le quita la tilde a la Ñ. O sea que
 * `nombreClave("NACIONAL AV DEL NIÑO")` devuelve "NACIONAL AV DEL NINO", con N
 * pelada. Escribir la llave con Ñ hace que NUNCA case, en silencio. Lo mismo
 * con `Carne-Mart "Coliseo"`: las comillas dobles se quitan.
 *
 * Cada llave de aqui abajo se comprobo asi (ver el reporte de la Task 11
 * para la corrida completa):
 *   node -e "import('./scripts/cuaderno/normalizar.mjs').then(m =>
 *     console.log(m.nombreClave('NACIONAL AV DEL NIÑO')))"
 *   // -> "NACIONAL AV DEL NINO"
 */
export const EMPRESAS = {
  // Sucursales de KARZO escritas como si fueran empresas (hoja 2, fila 42:
  // el cliente real se llama solo "KARZO").
  "KARZO CONSTITUYENTES": "KARZO",
  "KARZO DIAGONAL": "KARZO",
  "KARZO MAGNOLIAS": "KARZO",
  "KARZO MARTE R GOMEZ": "KARZO",
  "KARZO MORELOS": "KARZO",
  "KARZO OFICINAS": "KARZO",
  "KARZO PIPAS": "KARZO",
  "KARZO SEXTA": "KARZO",
  "KARZO TOMATES": "KARZO",

  // Sucursales de Nacionales (hoja 2, fila 47: "Nacionales").
  "NACIONAL AV DEL NINO": "Nacionales",
  "NACIONAL CAMINO REAL": "Nacionales",
  "NACIONAL DIVISION DEL NORTE": "Nacionales",
  "NACIONAL MARINADOS": "Nacionales",
  "NACIONAL MAYOREO": "Nacionales",
  "NACIONAL PEDRO CARDENAS": "Nacionales",
  "NACIONAL PERIFERICO": "Nacionales",
  "NACIONAL SENDERO": "Nacionales",
  "NACIONAL VALLE ALTO": "Nacionales",

  // Una comilla y un guion de diferencia con el nombre de la hoja 2 (fila 9:
  // "CARNE MART "). `Carne-Mart "Coliseo"` es la sucursal Coliseo (Zona
  // Centro) de ese mismo cliente.
  "CARNE MART COLISEO": "CARNE MART",

  // KARZINI: decision de Luis, 1-sep-2026 (ver CLIENTES_EXTRA abajo). Sus 2
  // puntos comparten direccion con 2 de KARZO pero son un negocio distinto,
  // no el mismo cliente mal tecleado.
  "KARZINI DIAGONAL": "KARZINI",
  "KARZINI MARTE R GOMEZ": "KARZINI",
};

/**
 * Clientes que NO vienen en la hoja 2 pero que la hoja de puntos revela.
 *
 * KARZINI tiene 2 puntos propios (KARZINI DIAGONAL, KARZINI MARTE R GOMEZ)
 * en las MISMAS direcciones que 2 puntos de KARZO, pero con su propio conteo
 * de recolecciones al mes (12/mes contra las 8/mes de KARZO en esas mismas
 * direcciones — hoja 4, filas 45 y 47 contra 44 y 46). "KARZINI" no aparece
 * en ningun renglon de la hoja 2.
 *
 * Luis decidio el 1-sep-2026, al revisar los 3 casos de SIN_RESOLVER de la
 * Task 11, que KARZINI y KARZO son NEGOCIOS DISTINTOS que solo comparten
 * ubicacion (no un cliente duplicado por error de captura). Por eso KARZINI
 * entra como cliente nuevo, no como alias de KARZO.
 *
 * Sin correo ni telefono en el cuaderno: al cargarlo le va a tocar el estado
 * `pendiente-info` (ver `estado-cliente.mjs`), y eso es correcto — no hay
 * dato de contacto que inventarle.
 */
export const CLIENTES_EXTRA = [
  {
    empresa: "KARZINI",
    nota:
      "Cliente nuevo, no viene en la hoja 2 de clientes del cuaderno. Sus 2 " +
      "puntos (KARZINI DIAGONAL, KARZINI MARTE R GOMEZ) comparten direccion " +
      "exacta con 2 puntos de KARZO, pero traen su propio conteo de " +
      "recolecciones (12/mes contra las 8/mes de KARZO en esas mismas " +
      "direcciones). Luis decidio el 1-sep-2026, al revisar los casos de " +
      "SIN_RESOLVER de la Task 11, que KARZINI y KARZO son negocios " +
      "distintos que solo comparten ubicacion, no un cliente duplicado por " +
      "error de captura.",
  },
];

/**
 * Servicios que cubren VARIOS puntos en un solo renglon, que nombran el
 * punto distinto a como esta en la hoja 3, o que comparten llave con otros
 * servicios y solo se distinguen por otra columna (equipo).
 *
 * `null` significa: se reparte entre TODOS los puntos de esa empresa. El
 * cargador crea una suscripcion por punto y divide las recolecciones al mes
 * en partes iguales, dejando constancia en la nota interna del cliente de que
 * el reparto lo hizo el script y no la empresa.
 *
 * `{ empresa, alias }` apunta el servicio a UN punto concreto (posiblemente
 * de una empresa distinta a la que aparece tal cual en la hoja 4 — ver
 * LLANTERA abajo).
 *
 * `{ porEquipo: {...} }` es para cuando el mismo par empresa+punto de la
 * hoja 4 aparece en MAS DE UN renglon y ningun otro campo del servicio los
 * distingue salvo el equipo (columna "Contenedor, tolva, compactador, roll
 * off" de la hoja 4). El cargador tiene que buscar por
 * `nombreClave(equipo)` dentro de `porEquipo`, no usar `alias` directo —
 * ver TPI abajo. Es la unica llave de esta tabla con esta forma.
 *
 * Las llaves son `nombreClave(empresa) + " :: " + nombreClave(punto)`, leidas
 * de la hoja "4 Servicio contratado" (columnas 1 y 2).
 */
export const PUNTOS = {
  // Hoja 4: "CEMEX" / "PLANTA 1 Y 2" (26 recolecciones/mes en un solo
  // renglon) cubre las 2 plantas de la hoja 3 (Cd Industrial y C. Sendero
  // Nacional 7 S/N).
  "CEMEX :: PLANTA 1 Y 2": null,

  // Igual que CEMEX: un renglon de servicio para las 2 plantas de CONCURRENT
  // (Parque Industrial CYLSA y Zona Industrial).
  "CONCURRENT :: PLANTA 1 Y 2": null,

  // Un renglon de servicio para las 4 sucursales de CARNE MART (01 Coliseo,
  // 02 Lucero, 03 Emilio Portes Gil, 04 Carr Anahuac-Matamoros).
  "CARNE MART :: SURCURSAL 01 02 03 Y 04": null,

  // CARTA BLANCA solo tiene 1 punto en la hoja 3 (Cd Industrial), asi que
  // este reparto entre "todos los puntos" cae en ese unico punto: no hay
  // ambiguedad, solo un nombre de punto que no calca el de la hoja 3
  // ("SUCURSAL" contra "PLANTA").
  "CARTA BLANCA :: PLANTA": null,

  // CORREGIDO 1-sep-2026 (Luis, verificando el hallazgo de la Task 11): el
  // punto real de esta empresa (hoja 3, fila 66) trae el alias "ROBERTO
  // GUERRA" — es el nombre de una CALLE de Matamoros ("Roberto Guerra"), no
  // un contacto como se penso al escribir la primera version de esta tabla.
  // La calle de la hoja 3 tambien dice "Av. del Niño & Av Solidaridad", y el
  // servicio nombra el punto "AV DEL NIÑO": son el mismo lugar con dos
  // nombres distintos. No es adivinanza porque Nacionales tiene un SOLO
  // punto en todo el cuaderno con ese alias exacto, y los otros 8 puntos de
  // Nacionales casan uno a uno sin ayuda. El alias que se usa es el que YA
  // tiene el punto en la hoja 3 (ROBERTO GUERRA), no el que usa el servicio,
  // porque `cargar.mjs` busca el punto por SU alias, no por el del servicio.
  "NACIONAL AV DEL NINO :: AV DEL NINO": { empresa: "Nacionales", alias: "ROBERTO GUERRA" },

  // RESUELTO 1-sep-2026 (Luis). Los 4 servicios dicen solo "LLANTERA" en la
  // columna de empresa, que no existe como cliente: la hoja 2 tiene DOS
  // llanteras, cada una con su propio RFC —
  //   LLANTERA LLANTAS — RFC LRM950503EH7, razon social "LLANTAS Y
  //     REFACCIONES DE MATAMOROS"
  //   LLANTERA JESUS   — RFC ROGJ710704FUA, razon social "JESUS ROBERTO
  //     RODRIGUEZ"
  // No es adivinanza por parecido: cada apodo del servicio (SEXTA, CENTRO,
  // LAURO, DIAGONAL) aparece en el alias de UN UNICO punto en TODO el
  // cuaderno, y ese alias ya trae de que empresa es la planta —
  //   "PLANTA 01 SEXTA"  y "PLANTA 02 CENTRO"  -> LLANTERA LLANTAS
  //   "PLANTA 03 LAURO"  y "PLANTA 04 DIAGONAL" -> LLANTERA JESUS
  // La numeracion 01-04 corre entre las dos empresas porque comparten
  // proveedor de servicio, no porque sean el mismo cliente: para facturar
  // hay que respetar el RFC de cada una.
  "LLANTERA :: SEXTA": { empresa: "LLANTERA LLANTAS", alias: "PLANTA 01 SEXTA" },
  "LLANTERA :: CENTRO": { empresa: "LLANTERA LLANTAS", alias: "PLANTA 02 CENTRO" },
  "LLANTERA :: LAURO": { empresa: "LLANTERA JESUS", alias: "PLANTA 03 LAURO" },
  "LLANTERA :: DIAGONAL": { empresa: "LLANTERA JESUS", alias: "PLANTA 04 DIAGONAL" },

  // RESUELTO 1-sep-2026 (Luis). Los 3 servicios de TPI comparten LA MISMA
  // llave ("TPI :: PLANTA") porque los 3 dicen "PLANTA" en la columna de
  // punto; ninguna combinacion de empresa+punto los distingue. Lo que SI los
  // distingue, uno a uno y sin ambiguedad, es el EQUIPO (columna 5 de la
  // hoja "4 Servicio contratado") contra el nombre de la planta en la hoja
  // 3 (las 3 en la misma direccion, Av Guillermo Gonzalez Camarena):
  //   CONTENEDOR / 3 M3  (26/mes, RSU)            -> "PLANTA RSU"    (RUTA 3)
  //   COMPACTADOR / CE-30 (43/mes, manejo especial) -> "PLANTA COMPACTADOR" (RUTA 10)
  //   TOLVA / T-30        (36/mes, manejo especial) -> "PLANTA TOLVA"       (RUTA 11)
  // Los puntos "PLANTA TOLVA" y "PLANTA COMPACTADOR" traen la columna de
  // empresa EN BLANCO en la hoja 3 (se sobreentiende que heredan la fila de
  // arriba, "TPI"); son de TPI y estan en su misma direccion. `cargar.mjs`
  // tiene que decidir que una fila con la empresa en blanco hereda la de la
  // fila anterior ANTES de buscar en esta tabla, o esos 2 puntos nunca
  // existiran para que esta tabla los encuentre.
  "TPI :: PLANTA": {
    porEquipo: {
      CONTENEDOR: { empresa: "TPI", alias: "PLANTA RSU" },
      COMPACTADOR: { empresa: "TPI", alias: "PLANTA COMPACTADOR" },
      TOLVA: { empresa: "TPI", alias: "PLANTA TOLVA" },
    },
  },
};

/**
 * LO QUE EL SCRIPT NO PUEDE RESOLVER SOLO, Y LUIS TIENE QUE DECIDIR.
 *
 * Mientras algo este en esta lista, el cargador se DETIENE al encontrarlo. No
 * se le pone un valor "provisional": un amarre inventado se ve igual que uno
 * bueno y nadie vuelve a revisarlo.
 *
 * Vacia desde el 1-sep-2026: Luis resolvio los 3 casos que traia (LLANTERA,
 * KARZINI, TPI). Quedan documentados arriba, en `EMPRESAS`, `PUNTOS` y
 * `CLIENTES_EXTRA`, con la fecha y quien decidio cada uno.
 */
export const SIN_RESOLVER = [];
