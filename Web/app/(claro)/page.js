import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
} from "@phosphor-icons/react/dist/ssr";
import {
  BarraConfianza,
  RejillaServicios,
  Sectores,
  Clientes,
  Permisos,
  BandaCTA,
} from "@/components/Secciones";
import Icono from "@/components/Iconos";
import Revelar from "@/components/Revelar";
import PreguntasFrecuentes from "@/components/PreguntasFrecuentes";
import {
  EMPRESA,
  GALERIA,
  MATERIALES_RECICLABLES,
  SERVICIOS_ADICIONALES,
  enlaceWhatsApp,
} from "@/lib/datos";

export const metadata = {
  title: "Recolección de residuos en Matamoros, Tamaulipas",
  description:
    "Morcast del Norte: recolección, transporte y disposición final de residuos sólidos, líquidos y de manejo especial en Matamoros. Contenedores de 1.5, 3 y 6 m³, tolvas de 15 y 30 m³, pipas certificadas y permisos vigentes.",
  alternates: { canonical: "/" },
};

export default function Inicio() {
  return (
    <>
      {/* ============ HERO ============ */}
      <section className="mc-hero">
        <div className="mc-hero-foto">
          <Image
            src="/img/hero-portada-hd.jpg"
            alt="Operador de Morcast del Norte frente a contenedores en Matamoros"
            fill
            priority
            quality={92}
            sizes="100vw"
            style={{ objectFit: "cover", objectPosition: "center 15%" }}
          />
        </div>
        <div className="mc-hero-velo" aria-hidden="true" />
        <div className="mc-hero-chevron" aria-hidden="true" />

        <div className="container mc-hero-contenido">
          <div className="mc-hero-grid">
            <div className="mc-hero-titular">
              <span className="mc-eyebrow mc-eyebrow-claro">
                {EMPRESA.ciudad}, {EMPRESA.estado} · Recolección · Transporte ·
                Disposición final
              </span>
              <h1>
                Manejo integral
                <br />
                de residuos
              </h1>
            </div>

            <div className="mc-hero-lateral">
              <p>
                Recolección, transporte y disposición final de residuos
                sólidos, líquidos y de manejo especial para la industria de
                Matamoros. Flota propia y permisos vigentes.
              </p>
              <div className="mc-hero-botones">
                <Link href="/contacto" className="mc-btn mc-btn-verde">
                  Solicitar cotización <ArrowRight aria-hidden="true" />
                </Link>
                <a
                  href={enlaceWhatsApp()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mc-btn mc-btn-linea-blanca"
                >
                  WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <BarraConfianza />

      {/* ============ SERVICIOS ============ */}
      <section className="mc-seccion">
        <div className="container">
          <Revelar as="div" className="row align-items-end mb-5" desde="abajo">
            <div className="col-lg-7">
              <span className="mc-eyebrow">Qué hacemos</span>
              <h2 className="mc-titulo-seccion">
                Recolección, transporte, disposición y{" "}
                <span className="mc-marcado">reciclaje</span>
              </h2>
            </div>
            <div className="col-lg-5">
              <p className="mc-lead mb-0">
                Somos especialistas en la recolección, transporte y disposición
                final de residuos sólidos y líquidos, incluyendo aguas
                residuales, oleosas y peligrosas.
              </p>
            </div>
          </Revelar>

          <RejillaServicios limite={6} />

          <div className="text-center mt-5">
            <Link href="/servicios" className="mc-btn mc-btn-linea">
              Ver todos los servicios <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* ============ CONTENEDORES ============ */}
      <section className="mc-seccion mc-seccion-hueso">
        <div className="container">
          <div className="row g-5 align-items-center">
            <Revelar as="div" className="col-lg-5" desde="izq">
              <span className="mc-eyebrow">Nos adaptamos a tus necesidades</span>
              <h2 className="mc-titulo-seccion">Contenedores y tolvas</h2>
              <p className="mc-lead">
                Contamos con contenedores metálicos de 1.5, 3 y 6 metros cúbicos, y
                tolvas de 15 y 30 metros cúbicos, dependiendo de las necesidades
                de tu empresa.
              </p>
              <ul className="mc-lista mb-4">
                <li>Contenedores metálicos de 1.5, 3 y 6 m³</li>
                <li>Tolvas de 15 y 30 m³, con compactador de alta eficiencia</li>
                <li>Roll off para movimiento de tolvas y compactadores</li>
                <li>Instalación inmediata en su domicilio</li>
              </ul>
              <Link href="/contenedores" className="mc-btn mc-btn-teal">
                Ver contenedores y tolvas <ArrowRight aria-hidden="true" />
              </Link>
            </Revelar>

            <Revelar as="div" className="col-lg-7" desde="der" retraso={120}>
              <div
                className="mc-foto-marco mc-foto-diag"
                style={{ aspectRatio: "16 / 11" }}
              >
                <Image
                  src="/img/foto-3.jpg"
                  alt="Equipo de Morcast del Norte frente al camión de contenedores roll off"
                  fill
                  sizes="(max-width: 991px) 100vw, 58vw"
                  style={{ objectFit: "cover" }}
                />
              </div>
            </Revelar>
          </div>
        </div>
      </section>

      <Permisos />

      <Sectores />

      {/* ============ RECICLAJE ============ */}
      <section className="mc-seccion">
        <div className="container">
          <div className="row g-5 align-items-center">
            <Revelar as="div" className="col-lg-6 order-lg-2" desde="der">
              <span className="mc-eyebrow">Economía circular</span>
              <h2 className="mc-titulo-seccion">
                Compra-venta de{" "}
                <span className="mc-marcado">materiales reciclables</span>
              </h2>
              <p className="mc-lead mb-4">
                Nos dedicamos a la recolección así como a la compra-venta de
                materiales reciclables. Convierte tus residuos aprovechables en
                un ingreso para tu empresa.
              </p>
              <div className="d-flex flex-wrap gap-2 mb-4">
                {MATERIALES_RECICLABLES.map((m) => (
                  <span key={m} className="mc-pildora">
                    <Icono nombre="reciclar" size={15} />
                    {m}
                  </span>
                ))}
              </div>
              <div className="mc-nota">
                <strong>Además:</strong>{" "}
                {SERVICIOS_ADICIONALES.map((s) => s.titulo).join(" · ")}.
              </div>
            </Revelar>

            <Revelar
              as="div"
              className="col-lg-6 order-lg-1"
              desde="izq"
              retraso={120}
            >
              <div
                className="mc-foto-marco mc-foto-diag"
                style={{ aspectRatio: "16 / 10" }}
              >
                <Image
                  src="/img/foto-6.jpg"
                  alt="Camión y cargador de Morcast del Norte manejando material para reciclaje"
                  fill
                  sizes="(max-width: 991px) 100vw, 50vw"
                  style={{ objectFit: "cover" }}
                />
              </div>
            </Revelar>
          </div>
        </div>
      </section>

      {/* ============ GALERÍA DE TRABAJOS ============ */}
      <section className="mc-seccion mc-seccion-hueso">
        <div className="container">
          <Revelar as="div" className="text-center mb-5" desde="abajo">
            <span className="mc-eyebrow">Nuestro trabajo</span>
            <h2 className="mc-titulo-seccion">
              Galería de <span className="mc-marcado">trabajos</span>
            </h2>
            <p className="mc-lead mx-auto" style={{ maxWidth: 620 }}>
              Flota, contenedores y operación real de Morcast del Norte en el
              área de Matamoros.
            </p>
          </Revelar>
          <div className="mc-galeria-trabajos">
            {GALERIA.map((g, i) => (
              <Revelar
                key={g.foto}
                as="div"
                className="mc-galeria-item"
                desde="escala"
                retraso={(i % 3) * 70}
              >
                <Image
                  src={g.foto}
                  alt={g.alt}
                  width={g.ancho}
                  height={g.alto}
                  sizes="(max-width: 575px) 100vw, (max-width: 991px) 50vw, 33vw"
                  style={{ width: "100%", height: "auto" }}
                />
              </Revelar>
            ))}
          </div>
        </div>
      </section>

      <Clientes />

      {/* ============ PREGUNTAS FRECUENTES ============ */}
      <section className="mc-seccion mc-seccion-hueso">
        <div className="container">
          <Revelar as="div" className="text-center mb-5" desde="abajo">
            <span className="mc-eyebrow">Preguntas frecuentes</span>
            <h2 className="mc-titulo-seccion">
              Resolvemos tus <span className="mc-marcado">dudas</span>
            </h2>
          </Revelar>
          <PreguntasFrecuentes />
        </div>
      </section>

      <BandaCTA />
    </>
  );
}
