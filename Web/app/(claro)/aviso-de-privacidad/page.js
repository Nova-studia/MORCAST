import { Encabezado } from "@/components/Secciones";
import Correo from "@/components/Correo";
import { EMPRESA } from "@/lib/datos";

export const metadata = {
  title: "Aviso de Privacidad",
  description:
    "Aviso de Privacidad de Morcast del Norte, S.A. de C.V. conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.",
  alternates: { canonical: "/aviso-de-privacidad" },
  robots: { index: false, follow: true },
};

export default function AvisoPrivacidad() {
  return (
    <>
      <Encabezado miga="Aviso de Privacidad" titulo="Aviso de Privacidad" />

      <section className="mc-seccion">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-8">
              <div className="mc-nota mb-5">
                <strong>Borrador pendiente de revisión legal.</strong> Este texto
                es una base conforme a la LFPDPPP. Antes de publicar el sitio debe
                revisarlo un abogado y completarse el domicilio fiscal y los datos
                del responsable.
              </div>

              <div className="mc-lead" style={{ color: "var(--mc-tinta)" }}>
                <p>
                  <strong>{EMPRESA.razonSocial}</strong> (en adelante
                  &laquo;MORCAST&raquo;), con domicilio en{" "}
                  <mark>[PENDIENTE: domicilio fiscal]</mark>, {EMPRESA.ciudad},{" "}
                  {EMPRESA.estado}, es el responsable del uso y protección de sus
                  datos personales, conforme a la Ley Federal de Protección de
                  Datos Personales en Posesión de los Particulares.
                </p>

                <h2 style={{ fontSize: "1.35rem", marginTop: "2.5rem" }}>
                  ¿Para qué fines usamos sus datos personales?
                </h2>
                <p>
                  Los datos personales que recabamos se utilizan para las
                  siguientes finalidades primarias, necesarias para el servicio
                  que solicita:
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

                <h2 style={{ fontSize: "1.35rem", marginTop: "2.5rem" }}>
                  Si nos mandas una solicitud de empleo
                </h2>
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
                  candidatura y para contactarte. No se comparten con nadie,
                  no se usan para publicidad y no se cruzan con la
                  información de nuestros clientes.
                </p>
                <p>
                  <strong>Los conservamos 12 meses</strong> a partir del día
                  que los envías, y después se borran solos, incluido tu
                  currículum. Si quieres que los borremos antes, escríbenos a{" "}
                  <a
                    href={`mailto:${EMPRESA.correos[0]}`}
                    style={{ color: "var(--mc-verde-claro)", fontWeight: 600 }}
                  >
                    <Correo correo={EMPRESA.correos[0]} />
                  </a>{" "}
                  con tu nombre y el folio que te dimos al enviarla.
                </p>

                <h2 style={{ fontSize: "1.35rem", marginTop: "2.5rem" }}>
                  ¿Qué datos personales recabamos?
                </h2>
                <p>
                  Nombre, razón social, teléfono, correo electrónico, domicilio del
                  servicio, RFC y constancia de situación fiscal cuando se requiera
                  para facturación.
                </p>

                <h2 style={{ fontSize: "1.35rem", marginTop: "2.5rem" }}>
                  Transferencia de datos
                </h2>
                <p>
                  Sus datos pueden ser compartidos con terceros autorizados que
                  participen en la disposición final de residuos, únicamente cuando
                  sea necesario para prestar el servicio y cumplir con la
                  normatividad ambiental aplicable. No comercializamos sus datos.
                </p>

                <h2 style={{ fontSize: "1.35rem", marginTop: "2.5rem" }}>
                  Derechos ARCO
                </h2>
                <p>
                  Usted tiene derecho a conocer qué datos personales tenemos de
                  usted, para qué los utilizamos y las condiciones del uso que les
                  damos (Acceso). Asimismo, es su derecho solicitar la corrección
                  de su información personal en caso de que esté desactualizada,
                  sea inexacta o incompleta (Rectificación); que la eliminemos de
                  nuestros registros o bases de datos cuando considere que la misma
                  no está siendo utilizada conforme a los principios, deberes y
                  obligaciones previstas en la normativa (Cancelación); así como
                  oponerse al uso de sus datos personales para fines específicos
                  (Oposición).
                </p>
                <p>
                  Para ejercer cualquiera de estos derechos, envíe su solicitud al
                  correo{" "}
                  <a
                    href={`mailto:${EMPRESA.correos[0]}`}
                    style={{ color: "var(--mc-verde-claro)", fontWeight: 600 }}
                  >
                    {EMPRESA.correos[0]}
                  </a>
                  .
                </p>

                <h2 style={{ fontSize: "1.35rem", marginTop: "2.5rem" }}>
                  Cambios al aviso de privacidad
                </h2>
                <p>
                  El presente aviso puede sufrir modificaciones derivadas de nuevos
                  requerimientos legales o de nuestras propias necesidades. Las
                  modificaciones estarán disponibles en esta misma página.
                </p>

                <p style={{ marginTop: "2.5rem", fontSize: "0.9rem", color: "var(--mc-gris)" }}>
                  Última actualización: <mark>[PENDIENTE: fecha]</mark>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
