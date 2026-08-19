import Image from "next/image";
import Link from "next/link";
import { FiArrowRight, FiPhone } from "react-icons/fi";
import {
  Encabezado,
  RejillaServicios,
  Clientes,
  Permisos,
  BandaCTA,
} from "@/components/Secciones";
import Revelar from "@/components/Revelar";
import { GALERIA, enlaceWhatsApp } from "@/lib/datos";
import {
  EMPRESA_COTIZACION,
  UNIDADES,
  EQUIPO_RENTA,
  COBERTURA,
  HORARIOS,
  CONDICIONES_COMERCIALES,
} from "@/lib/cotizacion-datos";

export const metadata = {
  title: "Portafolio de servicios",
  description:
    "Portafolio de Morcast del Norte: manejo integral de residuos en Matamoros, Tamaulipas. Servicios, flota, contenedores y tolvas, permisos vigentes, clientes y condiciones comerciales.",
  alternates: { canonical: "/portafolio" },
};

/** Ficha etiqueta/valor para el bloque de datos de la empresa. */
function Dato({ etiqueta, children }) {
  return (
    <div className="mc-dato">
      <span className="mc-dato-et">{etiqueta}</span>
      <span className="mc-dato-val">{children}</span>
    </div>
  );
}

export default function PaginaPortafolio() {
  const d = EMPRESA_COTIZACION.domicilio;

  return (
    <>
      <Encabezado
        miga="Portafolio"
        titulo="Portafolio de servicios"
        descripcion="Todo lo que hace Morcast del Norte en un solo lugar: nuestros servicios, la flota con la que operamos, el equipo que rentamos, los permisos que nos respaldan y las condiciones con las que trabajamos."
      />

      {/* ============ LA EMPRESA ============ */}
      <section className="mc-seccion">
        <div className="container">
          <Revelar as="div" className="row g-5" desde="abajo">
            <div className="col-lg-5">
              <span className="mc-eyebrow">Quiénes somos</span>
              <h2 className="mc-titulo-seccion">
                Manejo integral de <span className="mc-marcado">residuos</span>
              </h2>
              <p className="mc-lead">
                Somos una empresa de Matamoros dedicada a la recolección,
                transporte, disposición final y reciclaje de residuos para
                industrias, comercios e instituciones. Entregamos el Manifiesto
                del Protocolo de Disposición que respalda legalmente a tu
                empresa en cada servicio.
              </p>
              <Link href="/contacto" className="mc-btn mc-btn-teal">
                Solicitar cotización <FiArrowRight aria-hidden="true" />
              </Link>
            </div>

            <div className="col-lg-7">
              <div className="mc-tarjeta mc-ficha">
                <Dato etiqueta="Razón social">
                  {EMPRESA_COTIZACION.razonSocial}
                </Dato>
                <Dato etiqueta="Representante legal">
                  {EMPRESA_COTIZACION.representanteLegal}
                </Dato>
                <Dato etiqueta="Domicilio">
                  {d.calle}, {d.colonia}
                  <br />
                  C.P. {d.cp}, {d.ciudad}, {d.estado}
                </Dato>
                <Dato etiqueta="Cobertura">{COBERTURA}</Dato>
                <Dato etiqueta="Atención en oficina">{HORARIOS.oficina}</Dato>
                <Dato etiqueta="Recolecciones">{HORARIOS.recolecciones}</Dato>
                <Dato etiqueta="Emergencias">{HORARIOS.emergencias}</Dato>
                <Dato etiqueta="Teléfonos">
                  {EMPRESA_COTIZACION.telefonos.join(" · ")}
                </Dato>
                <Dato etiqueta="Correo">
                  {EMPRESA_COTIZACION.correos.join(" · ")}
                </Dato>
              </div>
            </div>
          </Revelar>
        </div>
      </section>

      {/* ============ SERVICIOS ============ */}
      <section className="mc-seccion mc-seccion-hueso">
        <div className="container">
          <Revelar as="div" className="text-center mb-5" desde="abajo">
            <span className="mc-eyebrow">Qué hacemos</span>
            <h2 className="mc-titulo-seccion">
              Nuestros <span className="mc-marcado">servicios</span>
            </h2>
          </Revelar>
          <RejillaServicios />
        </div>
      </section>

      {/* ============ FLOTA Y EQUIPO ============ */}
      <section className="mc-seccion">
        <div className="container">
          <Revelar as="div" className="text-center mb-5" desde="abajo">
            <span className="mc-eyebrow">Con qué trabajamos</span>
            <h2 className="mc-titulo-seccion">
              Flota y <span className="mc-marcado">equipo</span>
            </h2>
          </Revelar>

          <div className="row g-4">
            {/* Se entra desde abajo, no de los lados: los transform horizontales
                ensanchan la página en móvil y provocan scroll lateral. */}
            <Revelar as="div" className="col-lg-5" desde="abajo">
              <div className="mc-tarjeta h-100">
                <h3 className="mc-tarjeta-titulo">Unidades</h3>
                <ul className="mc-lista-marca">
                  {UNIDADES.map((u) => (
                    <li key={u}>{u}</li>
                  ))}
                </ul>
              </div>
            </Revelar>

            <Revelar as="div" className="col-lg-7" desde="abajo">
              <div className="mc-tarjeta h-100">
                <h3 className="mc-tarjeta-titulo">Equipo en renta</h3>
                <div className="mc-equipo-rejilla">
                  {EQUIPO_RENTA.map((e) => (
                    <div key={e.tipo} className="mc-equipo-grupo">
                      <span className="mc-equipo-tipo">{e.tipo}</span>
                      <div className="mc-equipo-medidas">
                        {e.medidas.map((m) => (
                          <span key={m} className="mc-medida">
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mc-nota">
                  Instalamos en el domicilio del cliente. Para maniobras se
                  solicita un área específica para la instalación de lo
                  solicitado.
                </p>
              </div>
            </Revelar>
          </div>
        </div>
      </section>

      <Permisos hueso />

      {/* ============ TRABAJOS ============ */}
      <section className="mc-seccion">
        <div className="container">
          <Revelar as="div" className="text-center mb-5" desde="abajo">
            <span className="mc-eyebrow">Nuestro trabajo</span>
            <h2 className="mc-titulo-seccion">
              Operación <span className="mc-marcado">real</span>
            </h2>
            <p className="mc-lead mx-auto" style={{ maxWidth: 620 }}>
              Flota, contenedores y equipo de Morcast del Norte trabajando en el
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

      {/* ============ CONDICIONES COMERCIALES ============ */}
      <section className="mc-seccion mc-seccion-hueso">
        <div className="container">
          <div className="row g-5 align-items-center">
            {/* Se entra desde abajo, no de los lados: los transform horizontales
                ensanchan la página en móvil y provocan scroll lateral. */}
            <Revelar as="div" className="col-lg-5" desde="abajo">
              <span className="mc-eyebrow">Cómo trabajamos</span>
              <h2 className="mc-titulo-seccion">
                Condiciones <span className="mc-marcado">comerciales</span>
              </h2>
              <p className="mc-lead">
                Las mismas condiciones aplican a toda cotización que emitimos.
                Los precios se determinan según volumen, frecuencia y
                condiciones del sitio.
              </p>
              <a
                href={enlaceWhatsApp(
                  "Hola, vi el portafolio de Morcast y quiero cotizar un servicio."
                )}
                className="mc-btn mc-btn-teal"
                target="_blank"
                rel="noopener noreferrer"
              >
                <FiPhone aria-hidden="true" /> Hablar por WhatsApp
              </a>
            </Revelar>

            <Revelar as="div" className="col-lg-7" desde="abajo">
              <div className="mc-tarjeta">
                <ul className="mc-lista-marca">
                  {CONDICIONES_COMERCIALES.lista.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            </Revelar>
          </div>
        </div>
      </section>

      <BandaCTA
        titulo="¿Listo para trabajar con nosotros?"
        texto={`Atendemos ${COBERTURA} con permisos vigentes y manifiesto en cada servicio. Cuéntanos qué residuos generas y te preparamos una propuesta.`}
      />
    </>
  );
}
