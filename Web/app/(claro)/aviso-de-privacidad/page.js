import { Encabezado } from "@/components/Secciones";
import Correo from "@/components/Correo";
import { EMPRESA } from "@/lib/datos";

/**
 * AVISO DE PRIVACIDAD DEL SITIO WEB.
 *
 * Distinto del de `/privacidad`, que cubre la APLICACIÓN MÓVIL y existe
 * porque Play Console y App Store exigen una URL que declare permiso por
 * permiso. Éste cubre lo que pasa en morcast.mx.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * 🔴 DOS COSAS QUE HAY QUE SABER ANTES DE TOCAR ESTE ARCHIVO
 *
 * 1. ESTE TEXTO NO LO HA REVISADO UN ABOGADO.
 *    Hasta el 7-sep-2026 la página llevaba encima un recuadro que lo decía
 *    en voz alta: "Borrador pendiente de revisión legal". Luis pidió
 *    quitarlo, y se quitó — un aviso que se presenta como borrador no le
 *    sirve a la empresa el día que alguien reclama. Pero quitar el cartel
 *    no revisa el documento: se redactó siguiendo la LFPDPPP y su
 *    Reglamento, y sigue sin pasar por un abogado. Conviene que lo vea uno.
 *
 * 2. LA PROMESA DE LOS 12 MESES DEPENDE DE UNA VARIABLE DE ENTORNO.
 *    Más abajo se promete que las solicitudes de empleo "se borran solas"
 *    a los 12 meses. Quien lo cumple es la tarea programada
 *    `app/api/tareas/purgar-empleo/route.js`, y esa ruta responde 401 —
 *    también a la llamada de Vercel — mientras `CRON_SECRET` no esté
 *    puesta en el proyecto de Vercel. Sin esa variable, este párrafo
 *    afirma algo que NO está ocurriendo. No es un problema de código
 *    (el 401 es deliberado, para que un despliegue sin la variable no
 *    deje abierta una ruta que BORRA datos); es de configuración, y está
 *    en manos del socio. Si se decide no ponerla, hay que cambiar este
 *    párrafo, no dejarlo prometiendo.
 * ─────────────────────────────────────────────────────────────────────────
 */

/** Se escribe a mano y se cambia a mano: es la fecha en que se revisó el
 *  texto, no la del último despliegue. Generarla con `new Date()` haría
 *  que el aviso dijera que se actualizó hoy cada vez que alguien lo abre. */
const ULTIMA_ACTUALIZACION = "7 de septiembre de 2026";

export const metadata = {
  title: "Aviso de Privacidad",
  description:
    "Aviso de Privacidad de Morcast del Norte, S.A. de C.V. conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.",
  alternates: { canonical: "/aviso-de-privacidad" },
  // Sí se indexa. Antes iba con `index: false`, que tenía sentido mientras
  // era un borrador con marcadores a la vista. Un aviso de privacidad es un
  // documento que la gente y las tiendas de aplicaciones tienen que poder
  // encontrar; esconderlo de los buscadores trabaja en su contra.
  robots: { index: true, follow: true },
};

const TITULO = { fontSize: "1.35rem", marginTop: "2.5rem" };
const ENLACE = { color: "var(--mc-verde-claro)", fontWeight: 600 };

export default function AvisoPrivacidad() {
  return (
    <>
      <Encabezado miga="Aviso de Privacidad" titulo="Aviso de Privacidad" />

      <section className="mc-seccion">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-8">
              <div className="mc-lead" style={{ color: "var(--mc-tinta)" }}>
                <p>
                  <strong>{EMPRESA.razonSocial}</strong> (en adelante
                  &laquo;MORCAST&raquo;), con domicilio en {EMPRESA.direccion},
                  es el responsable del uso y protección de sus datos
                  personales, conforme a la Ley Federal de Protección de Datos
                  Personales en Posesión de los Particulares (LFPDPPP), su
                  Reglamento y los Lineamientos del Aviso de Privacidad.
                </p>
                <p>
                  Para cualquier asunto relacionado con este aviso puede
                  escribirnos a{" "}
                  <a href={`mailto:${EMPRESA.correoPrivacidad}`} style={ENLACE}>
                    <Correo correo={EMPRESA.correoPrivacidad} />
                  </a>
                  , o llamarnos al {EMPRESA.telefonos[0]}.
                </p>

                <h2 style={TITULO}>¿Qué datos personales recabamos?</h2>
                <p>
                  Nombre, razón social, teléfono, correo electrónico, domicilio
                  del servicio, RFC y constancia de situación fiscal cuando se
                  requiera para facturación.
                </p>
                <p>
                  <strong>No recabamos datos personales sensibles</strong> —los
                  que se refieren a salud, origen étnico, creencias religiosas,
                  afiliación sindical, opiniones políticas o preferencia
                  sexual— y no los necesitamos para ninguno de nuestros
                  servicios.
                </p>

                <h2 style={TITULO}>
                  ¿Para qué fines usamos sus datos personales?
                </h2>
                <p>
                  Las siguientes finalidades son{" "}
                  <strong>primarias</strong>: son necesarias para prestarle el
                  servicio que nos solicita, y sin ellas no podríamos
                  atenderle.
                </p>
                <ul className="mc-lista">
                  <li>Elaborar y enviar cotizaciones de servicio</li>
                  <li>Formalizar y dar seguimiento a contratos de recolección</li>
                  <li>Programar rutas, frecuencias y entrega de contenedores</li>
                  <li>Emitir facturación y comprobantes fiscales</li>
                  <li>
                    Cumplir con obligaciones de trazabilidad y manifiestos ante
                    autoridades ambientales
                  </li>
                  <li>Atender dudas, quejas y solicitudes de servicio</li>
                </ul>
                <p>
                  <strong>No usamos sus datos para finalidades secundarias.</strong>{" "}
                  No le enviamos publicidad, no hacemos mercadotecnia ni
                  prospección comercial con su información, y no la usamos para
                  crear perfiles. Si en el futuro quisiéramos hacerlo, se lo
                  haríamos saber y le pediríamos su consentimiento antes,
                  nunca después.
                </p>

                <h2 style={TITULO}>Si nos mandas una solicitud de empleo</h2>
                <p>
                  Cuando envías una solicitud desde{" "}
                  <strong>Trabaja con nosotros</strong> recabamos tu{" "}
                  <strong>
                    nombre, teléfono, el puesto que buscas y tu experiencia
                  </strong>
                  ; tu <strong>correo</strong> sólo si decides dejarlo, y tu{" "}
                  <strong>currículum</strong> sólo si decides adjuntarlo.
                </p>
                <p>
                  Los usamos <strong>únicamente</strong> para evaluar tu
                  candidatura y para contactarte. No se comparten con nadie, no
                  se usan para publicidad y no se cruzan con la información de
                  nuestros clientes.
                </p>
                <p>
                  <strong>Los conservamos 12 meses</strong> a partir del día que
                  los envías, y después se borran solos, incluido tu currículum.
                  Si quieres que los borremos antes, escríbenos a{" "}
                  <a href={`mailto:${EMPRESA.correoPrivacidad}`} style={ENLACE}>
                    <Correo correo={EMPRESA.correoPrivacidad} />
                  </a>{" "}
                  con tu nombre y el folio que te dimos al enviarla.
                </p>

                <h2 style={TITULO}>Transferencia de datos</h2>
                <p>
                  Sus datos pueden ser compartidos con terceros autorizados que
                  participen en la disposición final de residuos, únicamente
                  cuando sea necesario para prestar el servicio y cumplir con la
                  normatividad ambiental aplicable. También pueden ser
                  requeridos por autoridades ambientales, fiscales o judiciales
                  cuando la ley nos obligue a entregarlos.
                </p>
                <p>
                  <strong>No comercializamos sus datos personales</strong> y no
                  los transferimos a nadie más con fines distintos a los
                  anteriores.
                </p>

                <h2 style={TITULO}>Derechos ARCO</h2>
                <p>
                  Usted tiene derecho a conocer qué datos personales tenemos de
                  usted, para qué los utilizamos y las condiciones del uso que
                  les damos (<strong>Acceso</strong>). Asimismo, es su derecho
                  solicitar la corrección de su información personal en caso de
                  que esté desactualizada, sea inexacta o incompleta (
                  <strong>Rectificación</strong>); que la eliminemos de nuestros
                  registros o bases de datos cuando considere que la misma no
                  está siendo utilizada conforme a los principios, deberes y
                  obligaciones previstas en la normativa (
                  <strong>Cancelación</strong>); así como oponerse al uso de sus
                  datos personales para fines específicos (
                  <strong>Oposición</strong>).
                </p>

                <h3 style={{ fontSize: "1.05rem", marginTop: "1.8rem" }}>
                  Cómo ejercerlos
                </h3>
                <p>
                  Envíe su solicitud al correo{" "}
                  <a href={`mailto:${EMPRESA.correoPrivacidad}`} style={ENLACE}>
                    <Correo correo={EMPRESA.correoPrivacidad} />
                  </a>
                  . Para poder atenderla, su solicitud debe incluir:
                </p>
                <ul className="mc-lista">
                  <li>
                    Su nombre y un medio para comunicarle nuestra respuesta
                  </li>
                  <li>
                    Copia de una identificación oficial que acredite que es
                    usted, o el documento que acredite la representación si lo
                    hace a nombre de alguien más
                  </li>
                  <li>
                    Una descripción clara de los datos sobre los que quiere
                    ejercer su derecho y de cuál de los cuatro derechos se trata
                  </li>
                  <li>
                    Cualquier dato que nos ayude a localizar su información
                    (número de contrato, folio de solicitud, razón social)
                  </li>
                </ul>

                <h3 style={{ fontSize: "1.05rem", marginTop: "1.8rem" }}>
                  Cuánto tardamos
                </h3>
                <p>
                  Le responderemos en un plazo máximo de{" "}
                  <strong>20 días hábiles</strong> contados desde que recibimos
                  su solicitud. Si procede, la haremos efectiva dentro de los{" "}
                  <strong>15 días hábiles</strong> siguientes a esa respuesta.
                  Los plazos pueden ampliarse una sola vez por un periodo igual
                  cuando el caso lo justifique, y se lo avisaríamos.
                </p>
                <p>
                  <strong>Ejercer estos derechos es gratuito.</strong> Sólo
                  tendría que cubrir los gastos de envío o el costo de copias si
                  pide la información en un formato que los genere.
                </p>

                <h2 style={TITULO}>Revocación del consentimiento</h2>
                <p>
                  Usted puede revocar en cualquier momento el consentimiento que
                  nos haya otorgado para tratar sus datos personales, por el
                  mismo medio: escribiendo a{" "}
                  <a href={`mailto:${EMPRESA.correoPrivacidad}`} style={ENLACE}>
                    <Correo correo={EMPRESA.correoPrivacidad} />
                  </a>
                  .
                </p>
                <p>
                  Tenga en cuenta que en algunos casos no podremos atender la
                  revocación de inmediato o del todo, porque la ley nos obliga a
                  conservar cierta información —por ejemplo, los manifiestos de
                  residuos y los comprobantes fiscales— durante los plazos que
                  marcan la normatividad ambiental y la fiscal. También es
                  posible que revocar su consentimiento signifique que ya no
                  podamos prestarle el servicio.
                </p>

                <h2 style={TITULO}>Cookies y tecnologías de rastreo</h2>
                <p>
                  Este sitio <strong>no utiliza cookies de publicidad ni de
                  rastreo</strong>, y no lo sigue por otros sitios. Sólo usamos
                  el almacenamiento propio del navegador para lo indispensable:
                  mantener su sesión iniciada en el portal de clientes y
                  recordar preferencias de la interfaz. Puede borrarlo en
                  cualquier momento desde la configuración de su navegador, con
                  la única consecuencia de que tendría que volver a iniciar
                  sesión.
                </p>

                <h2 style={TITULO}>Cambios al aviso de privacidad</h2>
                <p>
                  El presente aviso puede sufrir modificaciones derivadas de
                  nuevos requerimientos legales o de nuestras propias
                  necesidades. Las modificaciones estarán disponibles en esta
                  misma página, y la fecha del pie le indica cuándo se actualizó
                  por última vez.
                </p>

                <h2 style={TITULO}>Si no queda conforme</h2>
                <p>
                  Si considera que su derecho a la protección de datos
                  personales ha sido lesionado, o que en el tratamiento de sus
                  datos existe alguna violación a la ley, puede acudir al
                  Instituto Nacional de Transparencia, Acceso a la Información y
                  Protección de Datos Personales (INAI). Antes de eso, le
                  agradeceríamos la oportunidad de resolverlo directamente:
                  escríbanos y lo atenderemos.
                </p>

                <p
                  style={{
                    marginTop: "2.5rem",
                    fontSize: "0.9rem",
                    color: "var(--mc-gris)",
                  }}
                >
                  Última actualización: {ULTIMA_ACTUALIZACION}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
