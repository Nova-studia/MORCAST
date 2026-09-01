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
 */

/**
 * Nombre tal como aparece en el cuaderno (ya pasado por `nombreClave`) →
 * empresa real de la hoja 2.
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
};

/**
 * Servicios que cubren VARIOS puntos en un solo renglon, o que nombran el
 * punto distinto a como esta en la hoja 3.
 *
 * `null` significa: se reparte entre TODOS los puntos de esa empresa. El
 * cargador crea una suscripcion por punto y divide las recolecciones al mes
 * en partes iguales, dejando constancia en la nota interna del cliente de que
 * el reparto lo hizo el script y no la empresa.
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

  // El punto real de esta empresa (hoja 3, fila 66) trae "ROBERTO GUERRA" en
  // la columna de alias en vez del nombre de la sucursal; la calle sí dice
  // "Av. del Niño". Se usa el alias legible en vez del que trae la hoja, para
  // que el punto no quede con el nombre de un contacto.
  "NACIONAL AV DEL NINO :: AV DEL NINO": { empresa: "Nacionales", alias: "AV DEL NIÑO" },
};

/**
 * LO QUE EL SCRIPT NO PUEDE RESOLVER SOLO, Y LUIS TIENE QUE DECIDIR.
 *
 * Mientras algo este en esta lista, el cargador se DETIENE al encontrarlo. No
 * se le pone un valor "provisional": un amarre inventado se ve igual que uno
 * bueno y nadie vuelve a revisarlo.
 */
export const SIN_RESOLVER = [
  // LLANTERA: 4 servicios (hoja 4, filas 24-27) que dicen solo "LLANTERA" en
  // la columna de empresa:
  //   LLANTERA / SEXTA    — 4 recolecciones/mes, contenedor 3 m3
  //   LLANTERA / CENTRO   — 2 recolecciones/mes, contenedor 3 m3
  //   LLANTERA / LAURO    — 4 recolecciones/mes, contenedor 3 m3
  //   LLANTERA / DIAGONAL — 2 recolecciones/mes, contenedor 3 m3
  // La hoja 2 no tiene "LLANTERA" a secas: tiene DOS clientes distintos, cada
  // uno repetido dos veces (parecen renglones duplicados, no dos empresas
  // mas):
  //   "LLANTERA LLANTAS" — RFC LRM950503EH7, razon social "LLANTAS Y
  //     REFACCIONES DE MATAMOROS" (filas 23 y 24)
  //   "LLANTERA JESUS"   — RFC ROGJ710704FUA, razon social "JESUS ROBERTO
  //     RODRIGUEZ" (filas 25 y 26)
  // Y la hoja 3 SI trae 4 puntos ya repartidos entre esos dos clientes:
  //   LLANTERA LLANTAS -> "PLANTA 01 SEXTA" (Fracc. Victoria)
  //   LLANTERA LLANTAS -> "PLANTA 02 CENTRO" (Zona Centro)
  //   LLANTERA JESUS   -> "PLANTA 03 LAURO" (Col. Modelo)
  //   LLANTERA JESUS   -> "PLANTA 04 DIAGONAL" (Col San Francisco)
  // El nombre de la planta ya trae el mismo apodo que el servicio (SEXTA,
  // CENTRO, LAURO, DIAGONAL), lo que sugiere el reparto de arriba, pero es
  // una lectura de parecido de texto sobre datos que ya vienen duplicados en
  // la hoja de clientes — exactamente el tipo de suposicion que esta tarea
  // prohibe. ¿Confirma Luis que SEXTA y CENTRO son de LLANTERA LLANTAS, y
  // LAURO y DIAGONAL de LLANTERA JESUS? ¿O son datos mezclados y hay que
  // corregir la hoja de clientes primero?
  "LLANTERA: hay 4 servicios (SEXTA 4/mes, CENTRO 2/mes, LAURO 4/mes, DIAGONAL 2/mes, " +
    "todos contenedor 3 m3) pero en la hoja de clientes existen DOS llanteras " +
    "distintas — LLANTERA LLANTAS (RFC LRM950503EH7) y LLANTERA JESUS (RFC " +
    "ROGJ710704FUA), cada una repetida dos veces en la hoja. La hoja de puntos " +
    "ya trae 4 plantas con esos mismos apodos repartidas 2 y 2 entre las dos " +
    "empresas (SEXTA y CENTRO bajo LLANTERA LLANTAS; LAURO y DIAGONAL bajo " +
    "LLANTERA JESUS). ¿Confirma Luis ese reparto, y por que la hoja de " +
    "clientes trae cada llantera duplicada?",

  // KARZINI: 2 puntos en la hoja 3 (filas 51 y 53) con la MISMA calle y
  // colonia que dos puntos de KARZO (filas 50 y 52), pero con mas
  // recolecciones al mes (hoja 4, filas 45 y 47: 12/mes contra las 8/mes de
  // KARZO en esas mismas direcciones):
  //   KARZINI DIAGONAL        -> Diagonal y 20, San Francisco, RUTA 2 (12/mes)
  //   KARZO DIAGONAL          -> Diagonal y 20, San Francisco, RUTA 2 (8/mes)
  //   KARZINI MARTE R GOMEZ   -> Marte R Gomez S/N Hacienda Misiones, RUTA 1 (12/mes)
  //   KARZO MARTE R GOMEZ     -> Marte R Gomez S/N Hacienda Misiones, RUTA 1 (8/mes)
  // "KARZINI" no existe en la hoja de clientes bajo ningun nombre.
  "KARZINI: hay 2 puntos (KARZINI DIAGONAL, KARZINI MARTE R GOMEZ) en las MISMAS " +
    "direcciones que KARZO DIAGONAL y KARZO MARTE R GOMEZ, pero con mas " +
    "recolecciones al mes (12 contra 8) y la hoja de clientes no tiene KARZINI " +
    "bajo ningun nombre. ¿Es el mismo cliente que KARZO con dos contenedores " +
    "en la misma direccion, es una empresa hermana que hay que dar de alta " +
    "aparte, o es un error de captura?",

  // TPI: 3 servicios (hoja 4, filas 35-37) que dicen todos "PLANTA" en la
  // columna de punto y solo se distinguen por el equipo:
  //   TPI / PLANTA — 26/mes, contenedor 3 m3, "Residuos Solidos Urbanos"
  //   TPI / PLANTA — 43/mes, compactador CE-30, "Residuos de Manejo Especial"
  //   TPI / PLANTA — 36/mes, tolva T-30, "Residuos de Manejo Especial"
  // La hoja 3 SI trae 3 puntos de TPI en la misma direccion (Parque
  // Industrial La Ventana), cada uno con su propia ruta:
  //   fila 41: "PLANTA RSU" (RUTA 3, empresa = TPI)
  //   fila 42: "PLANTA TOLVA" (RUTA 11, columna de empresa en blanco)
  //   fila 43: "PLANTA COMPACTADOR" (RUTA 10, columna de empresa en blanco)
  // Las filas 42 y 43 no tienen "TPI" escrito en la columna de empresa (se
  // sobreentiende que es la misma de la fila de arriba), por lo que el volcado
  // actual del cuaderno las deja fuera de la lista de puntos de TPI.
  "TPI: los 3 servicios dicen todos PLANTA y se distinguen solo por el equipo " +
    "(contenedor 3 m3 / compactador CE-30 / tolva T-30, con 26, 43 y 36 " +
    "recolecciones al mes respectivamente). La hoja de puntos SI trae 3 " +
    "plantas de TPI en la misma direccion (PLANTA RSU, PLANTA TOLVA, PLANTA " +
    "COMPACTADOR, cada una en su propia ruta), pero las dos ultimas traen la " +
    "columna de empresa en blanco (se entiende que heredan la de la fila de " +
    "arriba) y no se estan leyendo como puntos de TPI. ¿Confirma Luis que " +
    "PLANTA/26/contenedor va a PLANTA RSU, PLANTA/43/compactador a PLANTA " +
    "COMPACTADOR y PLANTA/36/tolva a PLANTA TOLVA?",
];
