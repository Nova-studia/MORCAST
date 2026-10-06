import { Encabezado } from "@/components/Secciones";
import { EMPRESA } from "@/lib/datos";
import { CORREO_CONTACTO } from "@/lib/eliminar-cuenta.mjs";

/**
 * CÓMO ELIMINAR TU CUENTA (6-oct-2026).
 *
 * Google Play exige, a las apps en las que se puede crear una cuenta, un
 * enlace PÚBLICO donde cualquiera vea cómo pedir que se borre (se declara en
 * Play Console → "Seguridad de los datos"). Desde la app 1.1 se entra con
 * Google o con Apple, así que la app ya "permite crear cuentas".
 *
 * Lo que dice aquí tiene que coincidir con lo que hace de verdad
 * `lib/eliminar-cuenta.mjs` (Más → Eliminar mi cuenta): se borra el ACCESO
 * (usuario, contraseña y perfil) y se conservan los registros de la empresa
 * por obligación fiscal y ambiental. Si eso cambia, se cambia aquí.
 */
export const metadata = {
  title: "Eliminar tu cuenta",
  description:
    "Cómo eliminar tu cuenta de la aplicación de Morcast del Norte, qué datos se borran y cuáles se conservan por ley.",
  alternates: { canonical: "/eliminar-cuenta" },
};

export default function EliminarCuenta() {
  return (
    <>
      <Encabezado miga="Eliminar tu cuenta" titulo="Eliminar tu cuenta de Morcast" />

      <section className="mc-seccion">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-8">
              <p style={{ color: "var(--mc-gris)" }}>Última actualización: 6 de octubre de 2026</p>

              <p>
                Esta página explica cómo eliminar tu cuenta de la aplicación{" "}
                <strong>Morcast del Norte</strong> de {EMPRESA.razonSocial}, qué se borra
                y qué información debemos conservar por ley.
              </p>

              <h2 className="h4 mt-5">1. Desde la aplicación (inmediato)</h2>
              <ol>
                <li>Abre la app de Morcast e inicia sesión.</li>
                <li>
                  Ve a <strong>Más → Eliminar mi cuenta</strong>.
                </li>
                <li>Confirma. Tu acceso se borra en ese momento.</li>
              </ol>

              <h2 className="h4 mt-5">2. Por correo (si ya no tienes la app)</h2>
              <p>
                Escríbenos a <a href={`mailto:${CORREO_CONTACTO}`}>{CORREO_CONTACTO}</a>{" "}
                desde el correo de tu cuenta, con el asunto{" "}
                <strong>«Eliminar mi cuenta»</strong>. Si te registraste con Google o con
                Apple, usa el correo de esa cuenta. Confirmaremos que eres tú y la
                eliminaremos en un plazo máximo de 20 días hábiles, conforme a la
                LFPDPPP.
              </p>

              <h2 className="h4 mt-5">3. Qué se borra</h2>
              <ul>
                <li>Tu usuario: correo, contraseña y sesiones abiertas.</li>
                <li>Tu perfil: nombre y teléfono de contacto de tu cuenta.</li>
                <li>El vínculo con Google o Apple, si entraste con ellos.</li>
                <li>Los identificadores del teléfono para notificaciones.</li>
              </ul>

              <h2 className="h4 mt-5">4. Qué se conserva y por cuánto tiempo</h2>
              <p>
                Los registros del <strong>servicio prestado a la empresa</strong> no se
                borran con tu cuenta, porque la ley nos obliga a conservarlos y porque
                pertenecen a la empresa, que puede tener otras cuentas:
              </p>
              <ul>
                <li>
                  Recolecciones, manifiestos y su evidencia fotográfica, por la normatividad
                  ambiental aplicable.
                </li>
                <li>
                  Comprobantes, saldos y facturación, por al menos 5 años conforme al
                  Código Fiscal de la Federación.
                </li>
              </ul>
              <p>
                Pasado ese tiempo se eliminan. Si eres el representante de la empresa y
                quieres dar de baja el servicio completo, escríbenos al mismo correo.
              </p>

              <p className="mt-5" style={{ color: "var(--mc-gris)" }}>
                Más detalles en nuestro <a href="/privacidad">Aviso de Privacidad de la aplicación</a>.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
