import { FiPhone, FiMail, FiMapPin, FiClock } from "react-icons/fi";
import { FaWhatsapp } from "react-icons/fa";
import { Encabezado } from "@/components/Secciones";
import FormularioCotizacion from "@/components/FormularioCotizacion";
import { EMPRESA, enlaceWhatsApp } from "@/lib/datos";

export const metadata = {
  title: "Contacto y cotización",
  description:
    "Solicita una cotización de recolección de residuos en Matamoros, Tamaulipas. Teléfonos 868 384 9478 y 868 907 6020. Atención a emergencias 24/7.",
  alternates: { canonical: "/contacto" },
};

export default function Contacto() {
  return (
    <>
      <Encabezado
        miga="Contacto"
        titulo="Hablemos de tu operación"
        descripcion="Nos adaptamos a tu volumen, frecuencia y espacio disponible. Cuéntanos qué necesitas y te armamos una propuesta a la medida."
      />

      <section className="mc-seccion">
        <div className="container">
          <div className="row g-5">
            {/* Datos de contacto */}
            <div className="col-lg-5">
              <span className="mc-eyebrow">Datos de contacto</span>
              <h2 className="mc-titulo-seccion" style={{ fontSize: "1.9rem" }}>
                Estamos a una llamada
              </h2>
              <p className="mc-lead mb-4">
                Atendemos {EMPRESA.ciudad} y su zona industrial. Para emergencias
                y derrames contamos con atención 24/7.
              </p>

              <div className="mb-4">
                {EMPRESA.telefonos.map((tel, i) => (
                  <div className="mc-contacto-item" key={tel}>
                    <div className="mc-contacto-icono">
                      <FiPhone />
                    </div>
                    <div>
                      <h4>{i === 0 ? "Teléfono principal" : "Teléfono alterno"}</h4>
                      <a href={`tel:+52${tel.replace(/\s/g, "")}`}>{tel}</a>
                    </div>
                  </div>
                ))}

                {EMPRESA.correos.map((correo, i) => (
                  <div className="mc-contacto-item" key={correo}>
                    <div className="mc-contacto-icono">
                      <FiMail />
                    </div>
                    <div>
                      <h4>{i === 0 ? "Correo" : "Correo alterno"}</h4>
                      <a href={`mailto:${correo}`}>{correo}</a>
                    </div>
                  </div>
                ))}

                <div className="mc-contacto-item">
                  <div className="mc-contacto-icono">
                    <FiMapPin />
                  </div>
                  <div>
                    <h4>Cobertura</h4>
                    <p>
                      {EMPRESA.ciudad}, {EMPRESA.estado}, {EMPRESA.pais}
                    </p>
                  </div>
                </div>

                <div className="mc-contacto-item">
                  <div className="mc-contacto-icono">
                    <FiClock />
                  </div>
                  <div>
                    <h4>Horario</h4>
                    <p>{EMPRESA.horario}</p>
                  </div>
                </div>
              </div>

              <a
                href={enlaceWhatsApp()}
                target="_blank"
                rel="noopener noreferrer"
                className="mc-btn mc-btn-verde w-100"
              >
                <FaWhatsapp size={19} aria-hidden="true" /> Escríbenos por WhatsApp
              </a>
            </div>

            {/* Formulario */}
            <div className="col-lg-7">
              <FormularioCotizacion />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
