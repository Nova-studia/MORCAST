import Link from "next/link";
import { FiArrowRight } from "react-icons/fi";
import { Encabezado } from "@/components/Secciones";
import { enlaceWhatsApp } from "@/lib/datos";

/**
 * Scrap. Página de aviso: el servicio todavía no arranca.
 *
 * Se publica vacía a propósito, porque la empresa quiere que la pestaña ya se
 * vea en el menú. Cuando haya información real (materiales que se compran,
 * precios o condiciones), esta página se reemplaza por el contenido de verdad.
 * Mientras tanto no promete nada: dice que viene y deja por dónde preguntar.
 */
export const metadata = {
  title: "Scrap",
  description:
    "Compra y venta de scrap en Matamoros, Tamaulipas. Servicio próximamente disponible en Morcast del Norte.",
  alternates: { canonical: "/scrap" },
};

export default function PaginaScrap() {
  return (
    <>
      <Encabezado
        miga="Scrap"
        titulo="Scrap"
        descripcion="Compra y venta de scrap."
      />

      <section className="mc-seccion">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-7 text-center">
              <p className="mc-eyebrow-claro">Muy pronto</p>

              <h2 className="mb-4">Próximamente venta y compra de scrap</h2>

              <p className="mc-lead">
                Estamos preparando este servicio. Si te interesa vendernos o
                comprarnos material, escríbenos y te avisamos en cuanto arranque.
              </p>

              <div className="mc-hero-botones justify-content-center mt-4">
                <Link href="/contacto" className="mc-btn mc-btn-verde">
                  Déjanos tus datos <FiArrowRight aria-hidden="true" />
                </Link>
                <a
                  className="mc-btn mc-btn-linea"
                  href={enlaceWhatsApp("Hola, me interesa la compra/venta de scrap.")}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
