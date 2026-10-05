/**
 * TÉRMINOS DEL SERVICIO — lo que firma el cliente al darse de alta.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * 🔴 ESTO ES UN BORRADOR. NO LO HA REVISADO UN ABOGADO.
 *
 * Lo redactó el equipo de desarrollo (5-oct-2026) para que la "Solicitud de
 * alta" tuviera algo que aceptar y firmar. Está escrito con prudencia y sin
 * citar artículos de ley a propósito: un artículo mal citado en un documento
 * firmado es peor que no citar ninguno. Antes de darlo por bueno tiene que
 * leerlo un abogado. Por eso la versión dice "borrador" y la pantalla y el
 * PDF llevan la `NOTA_BORRADOR` a la vista.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Por qué vive en un módulo puro (sin React ni Supabase)
 * ------------------------------------------------------
 * El MISMO texto se enseña en la pantalla "Revisa y firma", se imprime como
 * anexo del PDF (que se genera en el servidor) y entra en la huella SHA-256
 * de lo firmado. Si cada lugar tuviera su copia, el cliente podría firmar un
 * texto y recibir otro en el PDF.
 *
 * 🔑 VERSIONES. Cada alta guarda la versión que aceptó (`terminos_version`).
 * En cuanto se cambie UNA coma del texto, se sube `VERSION_TERMINOS`: si no,
 * dos altas con la misma versión habrían aceptado textos distintos y la
 * evidencia no serviría. La huella del texto (`texto_sha256` en lo firmado)
 * lo delata de todos modos, pero la versión es lo que se lee a simple vista.
 */

export const VERSION_TERMINOS = "2026-10-v1-borrador";

/** Se enseña arriba de los términos en la pantalla y en el anexo del PDF. */
export const NOTA_BORRADOR =
  "Versión preliminar (borrador) pendiente de revisión por un abogado. Morcast del Norte puede publicar una versión revisada; las solicitudes ya firmadas conservan la versión que aceptaron, salvo que el cliente acepte expresamente la nueva.";

/**
 * El aviso de precios, CONGELADO en esta versión. Es copia literal de
 * `TEXTO_AVISO_PRECIOS` (`lib/aviso-precios.mjs`) al 5-oct-2026, y NO se
 * importa a propósito: si mañana los dueños cambian el aviso de la pantalla,
 * esta versión —la que ya firmaron clientes— no puede cambiar con él. Una
 * prueba avisa si el aviso vivo y éste se separan: entonces toca publicar
 * una versión nueva de los términos, no editar ésta.
 */
const AVISO_PRECIOS_V1 =
  "Las cotizaciones y precios mostrados son estimados de referencia y no constituyen una oferta definitiva. El precio final está sujeto a una revisión del servicio por parte de Morcast del Norte (tipo de residuo, volumen, equipo y condiciones de acceso), por lo que puede ser distinto al cotizado. La cotización final es opcional: usted puede aceptarla o rechazarla sin ningún compromiso.";

/** Dónde se lee el Aviso de privacidad del sitio (`app/(claro)/aviso-de-privacidad`). */
export const RUTA_AVISO_PRIVACIDAD = "/aviso-de-privacidad";

/**
 * Las cláusulas, en orden. Cada una es un título y sus párrafos: así la
 * pantalla las pinta con jerarquía y el PDF las parte en renglones sin
 * perder dónde empieza cada una.
 */
export const CLAUSULAS = [
  {
    titulo: "1. Las partes y el objeto",
    parrafos: [
      "Estos Términos del servicio regulan la relación entre MORCAST DEL NORTE, S.A. de C.V. (\"Morcast\"), con domicilio en Heroica Matamoros, Tamaulipas, y la empresa o persona que firma la Solicitud de alta (\"el Cliente\").",
      "El objeto es la prestación de servicios de recolección, transporte y manejo de residuos, y en su caso la renta de contenedores, tolvas o compactadores, en los domicilios y con la frecuencia que el Cliente indica en su Solicitud de alta y que Morcast acepta.",
    ],
  },
  {
    titulo: "2. Solicitud de alta y aceptación",
    parrafos: [
      "Al firmar la Solicitud de alta el Cliente declara que la información que entrega es verdadera y que tiene facultades para solicitar el servicio a nombre de la empresa que representa.",
      "La Solicitud de alta no obliga a Morcast a prestar el servicio hasta que Morcast la revise, confirme la cobertura del domicilio y acuerde con el Cliente el precio y la fecha de arranque. Morcast puede rechazar una solicitud, por ejemplo cuando el domicilio queda fuera de sus rutas o el residuo no está dentro de lo que puede manejar.",
    ],
  },
  {
    titulo: "3. Solicitud y programación de recolecciones",
    parrafos: [
      "El Cliente pide sus recolecciones por el Portal de Clientes, por teléfono o por los medios que Morcast habilite. Cada solicitud queda programada cuando Morcast la confirma con fecha y, cuando sea posible, con un horario aproximado.",
      "Morcast puede reprogramar una recolección por causas operativas, de clima, de seguridad, de fallas mecánicas o por disposición de alguna autoridad, y avisará al Cliente por los medios de contacto registrados.",
      "El número de recolecciones al mes que el Cliente indica es una referencia para planear la ruta; el reparto entre las semanas se acuerda con Morcast.",
    ],
  },
  {
    titulo: "4. Obligaciones del Cliente sobre el residuo y el acceso",
    parrafos: [
      "El Cliente se obliga a entregar únicamente el tipo de residuo que declaró y que se agendó; a no mezclar residuos peligrosos con residuos que no lo son; a identificar y separar correctamente sus residuos, y a avisar con anticipación cualquier cambio en su tipo, volumen o características.",
      "El Cliente debe dar acceso seguro y libre al punto de recolección en el horario de acceso que registró, con una persona que reciba al chofer cuando sea necesario, y mantener el área de maniobra libre de obstáculos.",
      "El Cliente es responsable de la veracidad de la información que entrega sobre sus residuos. Los daños, sanciones o costos que resulten de información falsa o incompleta sobre el residuo corren por cuenta del Cliente.",
    ],
  },
  {
    titulo: "5. Visita que \"No procedió\"",
    parrafos: [
      "Si al llegar el residuo no corresponde al que se agendó o declaró, o no hay acceso al punto de recolección (cerrado, sin quien reciba, obstruido o inseguro), el chofer registra la visita como \"No procedió\", con el motivo y la evidencia correspondiente, y no recoge el residuo.",
      "Una visita que \"No procedió\" no se cobra al Cliente. Morcast y el Cliente acordarán una nueva fecha una vez que se corrija la causa.",
    ],
  },
  {
    titulo: "6. Residuos regulados",
    parrafos: [
      "Morcast solo recolecta y maneja los residuos que sus autorizaciones y permisos vigentes le permiten. Cuando la normativa aplicable exija documentos para el manejo de un residuo (por ejemplo, manifiestos), el Cliente se obliga a proporcionar la información que le corresponda para elaborarlos.",
    ],
  },
  {
    titulo: "7. Precios y cotizaciones",
    parrafos: [
      AVISO_PRECIOS_V1,
      "El precio que finalmente se acuerde, su modalidad (por recolección, mensual u otra) y si incluye impuestos se documentan por escrito, en la cotización aceptada por el Cliente o en su Portal de Clientes.",
    ],
  },
  {
    titulo: "8. Pagos y saldos",
    parrafos: [
      "El Cliente paga los servicios en la forma y plazos acordados, contra la factura correspondiente. Morcast no solicita datos bancarios del Cliente.",
      "Cuando el Cliente trabaje con saldo a favor, los depósitos que reporte se aplican a su saldo una vez que Morcast los verifica. Los servicios realizados se descuentan del saldo conforme al precio acordado.",
      "Si existen adeudos vencidos, Morcast podrá suspender la programación de nuevas recolecciones, previo aviso al Cliente, hasta que la cuenta se regularice.",
    ],
  },
  {
    titulo: "9. Equipo de Morcast",
    parrafos: [
      "Los contenedores, tolvas, compactadores y demás equipo que Morcast coloque en el domicilio del Cliente siguen siendo propiedad de Morcast. El Cliente se obliga a usarlos solo para el residuo acordado y a cuidarlos; los daños causados por mal uso, robo o descuido se cobrarán conforme a su costo de reparación o reposición.",
    ],
  },
  {
    titulo: "10. Evidencia fotográfica y ubicación",
    parrafos: [
      "Para dar constancia de cada servicio, el chofer puede tomar fotografías del punto de recolección y del residuo antes y después del servicio, y el sistema registra la fecha, la hora y la ubicación (GPS) del registro.",
      "Esta evidencia sirve a ambas partes como comprobante del servicio o de la visita que \"No procedió\". El Cliente puede consultar la evidencia de sus servicios en su Portal de Clientes.",
    ],
  },
  {
    titulo: "11. Confidencialidad",
    parrafos: [
      "Morcast trata como confidencial la información del Cliente a la que tiene acceso por el servicio: domicilios, volúmenes y tipos de residuo, datos fiscales, fotografías y documentos. Solo la usa para prestar, facturar y documentar el servicio, y solo la comparte con quien sea necesario para ese fin (por ejemplo, sitios de disposición autorizados) o cuando una autoridad competente la requiera.",
      "El Cliente, por su parte, se obliga a no divulgar información de Morcast que no sea pública, como precios particulares, rutas u otra información operativa que reciba con motivo del servicio.",
    ],
  },
  {
    titulo: "12. Datos personales",
    parrafos: [
      "Los datos personales que el Cliente y sus contactos entregan se tratan conforme al Aviso de privacidad de Morcast, publicado en morcast.mx/aviso-de-privacidad, que el Cliente declara haber leído.",
    ],
  },
  {
    titulo: "13. Responsabilidad",
    parrafos: [
      "Morcast responde por el manejo del residuo a partir de que lo recibe en el punto de recolección. Ninguna de las partes es responsable por el incumplimiento causado por caso fortuito o fuerza mayor, siempre que avise a la otra en cuanto le sea posible.",
    ],
  },
  {
    titulo: "14. Firma electrónica y comunicaciones",
    parrafos: [
      "Las partes aceptan que la Solicitud de alta se firme por medios electrónicos y reconocen la validez de esa firma y de los registros que la acompañan: la firma dibujada, el nombre de quien firma, el correo electrónico y su confirmación, la fecha y hora, la dirección IP, el navegador y la huella digital del contenido firmado.",
      "Los avisos relacionados con el servicio se envían al correo electrónico y al teléfono que el Cliente registró, o por su Portal de Clientes. El Cliente se obliga a mantener esos datos actualizados.",
    ],
  },
  {
    titulo: "15. Vigencia y terminación",
    parrafos: [
      "Estos Términos rigen desde que Morcast confirma el alta del Cliente y por tiempo indefinido. Cualquiera de las partes puede darlos por terminados avisando a la otra por escrito con al menos 30 días naturales de anticipación.",
      "Morcast puede terminarlos antes si el Cliente incumple de forma grave o reiterada sus obligaciones sobre el residuo, el acceso o los pagos. Al terminar, se liquidan los servicios prestados, el Cliente devuelve el equipo de Morcast y, si queda saldo a favor del Cliente, se le reembolsa o se aplica conforme se acuerde.",
    ],
  },
  {
    titulo: "16. Cambios a estos Términos",
    parrafos: [
      "Morcast puede publicar nuevas versiones de estos Términos y las dará a conocer al Cliente. La versión que el Cliente firmó sigue rigiendo su relación hasta que acepte expresamente una nueva.",
    ],
  },
  {
    titulo: "17. Leyes aplicables y jurisdicción",
    parrafos: [
      "Estos Términos se rigen por las leyes de los Estados Unidos Mexicanos. Para cualquier controversia, las partes se someten a los tribunales competentes de Heroica Matamoros, Tamaulipas, y renuncian a cualquier otro fuero que pudiera corresponderles por su domicilio presente o futuro.",
    ],
  },
];

/**
 * El texto completo como UNA cadena: es lo que entra a la huella (`texto_sha256`)
 * y lo que se ve en el anexo del PDF. Incluye la nota de borrador: si mañana
 * se quita la nota, cambia la huella, y eso es correcto — cambió lo que se
 * firma.
 */
export function textoTerminos({ version, nota, clausulas } = terminosVigentes()) {
  const cuerpo = clausulas.map((c) => [c.titulo, ...c.parrafos].join("\n")).join("\n\n");
  return `TÉRMINOS DEL SERVICIO — MORCAST DEL NORTE, S.A. de C.V.\nVersión ${version}\n\n${nota}\n\n${cuerpo}`;
}

/** Congela una versión entera (y sus cláusulas) para que nada la retoque en memoria. */
const congelar = (t) =>
  Object.freeze({
    ...t,
    clausulas: Object.freeze(t.clausulas.map((c) => Object.freeze({ ...c, parrafos: Object.freeze([...c.parrafos]) }))),
  });

/**
 * EL ARCHIVO DE VERSIONES. Cuando un cliente confirma su correo (hasta 7
 * días después de firmar), el PDF final se vuelve a generar con los términos
 * QUE FIRMÓ, no con los de ese día. Por eso, al publicar una versión nueva,
 * la anterior NO se borra: se queda aquí con su versión como llave. Quien
 * confirma compara además la huella del texto con la que quedó en lo
 * firmado (`terminos.texto_sha256`), así que un texto retocado sin cambiar
 * la versión se detecta.
 */
const ARCHIVO = {
  // Cada versión trae TODO su texto, incluido el aviso de precios que se
  // imprime en el recuadro del PDF (`avisoPrecios`), sin depender de nada vivo.
  "2026-10-v1-borrador": congelar({
    version: "2026-10-v1-borrador",
    nota: NOTA_BORRADOR,
    clausulas: CLAUSULAS,
    avisoPrecios: AVISO_PRECIOS_V1,
  }),
};

/** Las versiones archivadas (las prueba `tests/alta-firma.test.mjs` una por una). */
export const VERSIONES_ARCHIVADAS = Object.keys(ARCHIVO);

/** La versión que se ofrece hoy a quien se da de alta. */
export function terminosVigentes() {
  return ARCHIVO[VERSION_TERMINOS];
}

/** Los términos de una versión firmada, o null si ya no están en el archivo. */
export function terminosDeVersion(version) {
  return ARCHIVO[version] || null;
}
