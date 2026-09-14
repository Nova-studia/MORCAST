import { FaWhatsapp } from "react-icons/fa";
import { Encabezado } from "@/components/Secciones";
import CuestionarioWhatsApp from "@/components/CuestionarioWhatsApp";
import { enlaceWhatsApp } from "@/lib/datos";

export const metadata = {
  title: "Cotiza por WhatsApp",
  description:
    "Cotiza la recolección de residuos de tu empresa en Matamoros: contesta un cuestionario de un minuto y envíalo por WhatsApp con todos los datos.",
  alternates: { canonical: "/cotizar" },
};

/**
 * /cotizar — el cuestionario que antecede al WhatsApp (14-sep-2026).
 *
 * Aquí caen todos los botones de WhatsApp del sitio, y es el enlace que el
 * dueño de Morcast manda a quien le escribe directo. En el teléfono el
 * cuestionario va PRIMERO: quien llega desde un chat viene a llenarlo, no a
 * leer cómo funciona.
 */
export default function Cotizar() {
  return (
    <>
      <Encabezado
        miga="Cotizar"
        titulo="Cotiza por WhatsApp"
        descripcion="Contesta un cuestionario de un minuto y tu mensaje llega a nuestro WhatsApp con todo lo que necesitamos para cotizarte."
      />

      <section className="mc-seccion">
        <div className="container">
          <div className="row g-5">
            <div className="col-lg-5 order-2 order-lg-1">
              <span className="mc-eyebrow">Cómo funciona</span>
              <h2 className="mc-titulo-seccion" style={{ fontSize: "1.9rem" }}>
                Sin preguntas de ida y vuelta
              </h2>
              <p className="mc-lead mb-4">
                Con estos datos te cotizamos desde el primer mensaje, en lugar de
                preguntarte uno por uno.
              </p>

              <ol className="mc-cotizar-pasos">
                <li><span>01</span> Contesta el cuestionario.</li>
                <li><span>02</span> Aprieta «Enviar por WhatsApp» y envía el mensaje.</li>
                <li><span>03</span> Te respondemos con tu cotización.</li>
              </ol>

              <p className="mc-cotizar-directo">
                ¿Solo tienes una duda o ya eres cliente?{" "}
                <a
                  href={enlaceWhatsApp("Hola, tengo una duda.")}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FaWhatsapp aria-hidden="true" /> Escríbenos directo
                </a>
              </p>
            </div>

            <div className="col-lg-7 order-1 order-lg-2">
              <CuestionarioWhatsApp />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
