import Image from "next/image";
import { Encabezado, Permisos, Clientes, BandaCTA, BarraConfianza } from "@/components/Secciones";
import Icono from "@/components/Iconos";

export const metadata = {
  title: "Quiénes somos",
  description:
    "Morcast del Norte, S.A. de C.V. — empresa de manejo integral de residuos en Matamoros, Tamaulipas. Permisos vigentes en residuos sólidos urbanos, manejo especial y peligrosos.",
  alternates: { canonical: "/nosotros" },
};

const VALORES = [
  {
    icono: "escudo",
    titulo: "Cumplimiento normativo",
    texto:
      "Entregamos el Manifiesto del Protocolo de Disposición y cumplimos con la normatividad ambiental aplicable en cada categoría de residuo que manejamos.",
  },
  {
    icono: "camion",
    titulo: "Flota propia",
    texto:
      "Camiones recolectores, pipas certificadas, volteo, roll off, jaulas de acero y retroexcavadora. Sin depender de terceros para operar.",
  },
  {
    icono: "reciclar",
    titulo: "Enfoque ambiental",
    texto:
      "Trabajamos para la mejora ambiental: recuperamos y comercializamos materiales reciclables para reducir lo que llega a disposición final.",
  },
];

export default function Nosotros() {
  return (
    <>
      <Encabezado
        miga="Nosotros"
        titulo="Morcast"
        descripcion="Morcast del Norte es una empresa dedicada al manejo integral de residuos en Matamoros, Tamaulipas. Damos servicio a industria maquiladora, comercios, hospitales, escuelas y dependencias públicas."
      />

      <BarraConfianza />

      {/* Intro */}
      <section className="mc-seccion">
        <div className="container">
          <div className="row g-5 align-items-center">
            <div className="col-lg-6">
              <span className="mc-eyebrow">Nuestra operación</span>
              <h2 className="mc-titulo-seccion">
                Manejo integral, de la recolección a la{" "}
                <span className="mc-marcado">disposición final</span>
              </h2>
              <p className="mc-lead">
                Asesoramos en el manejo integral y la estrategia de recolección de
                residuos para todo tipo de empresas públicas y privadas, desde
                tiendas de conveniencia hasta la industria maquiladora.
              </p>
              <p className="mc-lead">
                También somos especialistas en la recolección, transporte y
                disposición final de residuos líquidos, incluyendo aguas
                residuales, aguas oleosas y aguas peligrosas.
              </p>
              <p className="mc-lead mb-0">
                Tu empresa podrá beneficiarse con importantes ahorros mediante un
                manejo adecuado de residuos y la prevención de multas, al cumplir
                con todos los requisitos legales y ambientales.
              </p>
            </div>
            <div className="col-lg-6">
              <div
                className="mc-foto-marco mc-foto-diag"
                style={{ aspectRatio: "4 / 3" }}
              >
                <Image
                  src="/img/pipa.jpg"
                  alt="Pipa certificada de Morcast del Norte para transporte de residuos líquidos"
                  fill
                  sizes="(max-width: 991px) 100vw, 50vw"
                  style={{ objectFit: "cover" }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Valores */}
      <section className="mc-seccion mc-seccion-hueso">
        <div className="container">
          <div className="text-center mb-5">
            <span className="mc-eyebrow">Cómo trabajamos</span>
            <h2 className="mc-titulo-seccion">Lo que nos distingue</h2>
          </div>
          <div className="row g-4">
            {VALORES.map((v) => (
              <div key={v.titulo} className="col-md-4">
                <article className="mc-tarjeta">
                  <div className="mc-tarjeta-icono">
                    <Icono nombre={v.icono} />
                  </div>
                  <h3>{v.titulo}</h3>
                  <p>{v.texto}</p>
                </article>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Permisos />

      <Clientes />

      <BandaCTA titulo="Trabajemos juntos" />
    </>
  );
}
