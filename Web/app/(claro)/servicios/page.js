import Image from "next/image";
import { Encabezado, RejillaServicios, BandaCTA, Sectores } from "@/components/Secciones";
import Icono from "@/components/Iconos";
import {
  SERVICIOS_ADICIONALES,
  MATERIALES_RECICLABLES,
  CONTENEDORES,
} from "@/lib/datos";

export const metadata = {
  title: "Servicios de manejo de residuos",
  description:
    "Recolección de residuos sólidos urbanos, manejo especial y peligrosos, aguas residuales, oleosas y peligrosas. Contenedores, tolvas y reciclaje en Matamoros, Tamaulipas.",
  alternates: { canonical: "/servicios" },
};

export default function Servicios() {
  return (
    <>
      <Encabezado
        miga="Servicios"
        titulo="Recolección, transporte, disposición y reciclaje"
        descripcion="Asesoramos en el manejo integral y la estrategia de recolección de residuos para todo tipo de empresas públicas y privadas, desde tiendas de conveniencia hasta la industria maquiladora."
      />

      <section className="mc-seccion">
        <div className="container">
          <RejillaServicios />
        </div>
      </section>

      {/* Contenedores */}
      <section className="mc-seccion mc-seccion-hueso">
        <div className="container">
          <div className="row g-5 align-items-center">
            <div className="col-lg-6">
              <div className="row g-3">
                {CONTENEDORES.map((c, i) => (
                  <div key={c.foto} className="col-6">
                    <div
                      className={`mc-foto-marco ${
                        i % 2 === 0 ? "mc-foto-diag" : "mc-foto-diag-inv"
                      }`}
                      style={{ aspectRatio: "4 / 3" }}
                    >
                      <Image
                        src={c.foto}
                        alt={c.alt}
                        fill
                        sizes="(max-width: 991px) 50vw, 25vw"
                        style={{ objectFit: "cover" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="col-lg-6">
              <span className="mc-eyebrow">Nos adaptamos a tus necesidades</span>
              <h2 className="mc-titulo-seccion">Contenedores y tolvas</h2>
              <p className="mc-lead">
                Cada opción se personaliza según volumen, frecuencia y espacio
                disponible en tus instalaciones.
              </p>
              <ul className="mc-lista">
                <li>Contenedores metálicos de 1.5, 3 y 6 m³</li>
                <li>Tolvas de 15 y 30 m³</li>
                <li>Tolvas con compactador de alta eficiencia</li>
                <li>Roll off para movimiento de tolvas y compactadores</li>
                <li>Contenedores disponibles para instalación inmediata</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Reciclaje */}
      <section className="mc-seccion">
        <div className="container">
          <div className="text-center mb-5">
            <span className="mc-eyebrow">Economía circular</span>
            <h2 className="mc-titulo-seccion">Materiales que reciclamos</h2>
            <p className="mc-lead mx-auto" style={{ maxWidth: 640 }}>
              Nos dedicamos a la recolección así como a la compra-venta de
              materiales reciclables.
            </p>
          </div>
          <div className="row g-3 justify-content-center">
            {MATERIALES_RECICLABLES.map((m) => (
              <div key={m} className="col-6 col-md-4 col-lg-2">
                <div className="mc-sector justify-content-center text-center">
                  <Icono nombre="reciclar" />
                  <span>{m}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Servicios adicionales */}
      <section className="mc-seccion mc-seccion-hueso">
        <div className="container">
          <div className="text-center mb-5">
            <span className="mc-eyebrow">También hacemos</span>
            <h2 className="mc-titulo-seccion">Servicios complementarios</h2>
          </div>
          <div className="row g-4 justify-content-center">
            {SERVICIOS_ADICIONALES.map((s) => (
              <div key={s.titulo} className="col-md-6 col-lg-5">
                <article className="mc-tarjeta">
                  <div className="mc-tarjeta-icono azul">
                    <Icono nombre="fabrica" />
                  </div>
                  <h3>{s.titulo}</h3>
                  <p>{s.resumen}</p>
                </article>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Sectores />

      <BandaCTA />
    </>
  );
}
