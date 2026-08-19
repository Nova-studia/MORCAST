import { Encabezado } from "@/components/Secciones";
import { EMPRESA } from "@/lib/datos";

/**
 * Aviso de privacidad de la APLICACIÓN MÓVIL.
 *
 * Es distinto del de /aviso-de-privacidad, que cubre el sitio web. Este existe
 * porque Google Play y App Store exigen una URL pública que describa
 * exactamente qué datos recoge la app y para qué usa cada permiso del
 * teléfono. Sin esta página no se puede mandar la ficha a revisión.
 *
 * Si cambian los permisos de la app (hoy: cámara y fotos), hay que actualizar
 * la tabla de la sección 3 y volver a declararlo en Play Console.
 */
export const metadata = {
  title: "Aviso de Privacidad de la aplicación",
  description:
    "Qué datos recaba la aplicación móvil de Morcast del Norte, para qué usa los permisos del teléfono y cómo ejercer sus derechos ARCO.",
  alternates: { canonical: "/privacidad" },
};

const PERMISOS = [
  {
    permiso: "Cámara",
    para: "Leer el código del contenedor y tomar la fotografía del comprobante de pago o de la recolección.",
  },
  {
    permiso: "Fotos y galería",
    para: "Permitirle elegir y adjuntar el comprobante de pago que usted decida subir.",
  },
];

const DATOS = [
  ["Identificación y contacto", "Nombre de la persona de contacto, razón social, RFC, teléfono y correo electrónico."],
  ["Cuenta", "Correo electrónico y contraseña para iniciar sesión."],
  ["Servicio", "Historial de recolecciones, tipo y peso de los residuos, folios, manifiestos y la ubicación del punto de recolección que usted nos indica."],
  ["Facturación", "Saldo, movimientos, montos y los comprobantes de pago que usted decida cargar."],
  ["Fotografías", "Imágenes del comprobante de pago que usted sube y, en el caso del personal operador, fotografías del contenedor antes y después de la recolección."],
];

export default function PrivacidadApp() {
  return (
    <>
      <Encabezado
        miga="Aviso de Privacidad de la aplicación"
        titulo="Aviso de Privacidad de la aplicación"
      />

      <section className="mc-seccion">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-8">
              <p style={{ color: "var(--mc-gris)" }}>
                Última actualización: 12 de agosto de 2026
              </p>

              <p>
                En <strong>{EMPRESA.razonSocial}</strong> protegemos su información.
                Este aviso describe cómo recabamos, usamos y protegemos los datos
                personales de quienes usan la <strong>aplicación móvil Morcast</strong>,
                conforme a la Ley Federal de Protección de Datos Personales en Posesión
                de los Particulares (LFPDPPP).
              </p>

              <h2 className="h4 mt-5">1. Responsable de sus datos</h2>
              <p>
                El responsable del tratamiento es <strong>{EMPRESA.razonSocial}</strong>,
                con domicilio en {EMPRESA.ciudad}, México. Para cualquier asunto
                relacionado con este aviso puede escribirnos a{" "}
                <a href="mailto:contacto@morcast.mx">contacto@morcast.mx</a> o visitar{" "}
                <a href="https://morcast.mx">morcast.mx</a>.
              </p>

              <h2 className="h4 mt-5">2. Qué datos recabamos</h2>
              <p>
                La aplicación es un portal para clientes, personal administrativo y
                operadores de Morcast del Norte. Según su rol, podemos recabar:
              </p>
              <ul>
                {DATOS.map(([que, detalle]) => (
                  <li key={que} className="mb-2">
                    <strong>{que}:</strong> {detalle}
                  </li>
                ))}
              </ul>

              <h2 className="h4 mt-5">3. Permisos del teléfono</h2>
              <table className="table table-sm mc-tabla-privacidad">
                <thead>
                  <tr>
                    <th>Permiso</th>
                    <th>Para qué lo usamos</th>
                  </tr>
                </thead>
                <tbody>
                  {PERMISOS.map((p) => (
                    <tr key={p.permiso}>
                      <td><strong>{p.permiso}</strong></td>
                      <td>{p.para}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>
                <strong>La aplicación no accede a su ubicación</strong>, no muestra
                publicidad y no usa herramientas de seguimiento ni de analítica de
                terceros. Los permisos se piden en el momento en que se necesitan y
                usted puede negarlos o retirarlos desde los ajustes de su teléfono; en
                ese caso, las funciones que dependen de ellos dejarán de estar
                disponibles.
              </p>

              <h2 className="h4 mt-5">4. Para qué usamos sus datos</h2>
              <ul>
                <li>Prestar y programar el servicio de recolección que usted contrata.</li>
                <li>Emitir manifiestos, comprobantes y facturas.</li>
                <li>Llevar el estado de cuenta y verificar los pagos que usted reporta.</li>
                <li>Comprobar que el servicio se realizó, mediante las fotografías de la recolección.</li>
                <li>Contactarle sobre su servicio.</li>
              </ul>

              <h2 className="h4 mt-5">5. Con quién los compartimos</h2>
              <p>
                <strong>No vendemos ni compartimos sus datos personales con terceros
                con fines comerciales.</strong> Solo se comparten cuando la autoridad
                ambiental o fiscal lo requiere conforme a la ley, y con los proveedores
                que nos prestan servicios de infraestructura (alojamiento de la base de
                datos y envío de correo), que los tratan únicamente por nuestra
                instrucción.
              </p>

              <h2 className="h4 mt-5">6. Cómo los protegemos</h2>
              <p>
                La información viaja cifrada y se guarda con controles de acceso por
                usuario: cada cliente ve únicamente su propia información. Las
                contraseñas se guardan cifradas y nadie de Morcast puede consultarlas.
              </p>

              <h2 className="h4 mt-5">7. Sus derechos ARCO</h2>
              <p>
                Usted puede solicitar el <strong>Acceso</strong>, la{" "}
                <strong>Rectificación</strong>, la <strong>Cancelación</strong> de sus
                datos o la <strong>Oposición</strong> a su tratamiento, así como la
                eliminación de su cuenta, escribiendo a{" "}
                <a href="mailto:contacto@morcast.mx">contacto@morcast.mx</a>. Le
                responderemos en los plazos que marca la LFPDPPP. Tenga en cuenta que
                cierta información debe conservarse por obligación fiscal y ambiental
                aunque usted cancele su cuenta.
              </p>

              <h2 className="h4 mt-5">8. Cambios a este aviso</h2>
              <p>
                Si este aviso cambia, publicaremos la nueva versión en esta misma
                dirección con su fecha de actualización.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
