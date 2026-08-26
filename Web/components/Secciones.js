import Link from "next/link";
import Contador from "./Contador";
import Image from "next/image";
import Icono from "@/components/Iconos";
import Revelar from "@/components/Revelar";
import {
  SERVICIOS,
  SECTORES,
  CLIENTES,
  PERMISOS,
  EMPRESA,
  enlaceWhatsApp,
} from "@/lib/datos";

/* ---------- Encabezado de páginas internas ---------- */
export function Encabezado({ titulo, descripcion, miga }) {
  return (
    <section className="mc-encabezado">
      <div className="mc-encabezado-chevron" aria-hidden="true" />
      <div className="container">
        {miga && (
          <nav className="mc-miga" aria-label="Ruta de navegación">
            <Link href="/">Inicio</Link>
            <span className="mx-2">/</span>
            <span>{miga}</span>
          </nav>
        )}
        <h1>{titulo}</h1>
        {descripcion && <p>{descripcion}</p>}
      </div>
    </section>
  );
}

/* ---------- Barra de confianza ---------- */
export function BarraConfianza() {
  const items = [
    // El orden y el TAMAÑO dicen cuál importa más. Antes los cuatro pesaban
    // igual y en una fila de cuatro cosas iguales el ojo no sabe por dónde
    // empezar, así que no lee ninguna.
    //
    // Manda la flota: es lo que un cliente industrial pregunta primero
    // —"¿tienen con qué?"— y es lo que separa a Morcast de un contratista que
    // subarrienda. Le sigue 24/7, que es lo que se quiere oír cuando se
    // derramó algo un domingo.
    // Cada uno lleva SU celda con nombre. Con tres nombres para cuatro
    // números, el cuarto se caía a una fila suelta debajo de la rejilla.
    { icono: "flota", num: "11+", txt: "Tipos de unidades en flota propia", celda: "grande" },
    { icono: "emergencias", num: "24/7", txt: "Atención a emergencias", celda: "medio" },
    { icono: "categorias", num: "3", txt: "Categorías de residuos autorizadas", celda: "tres" },
    { icono: "medidas", num: "5", txt: "Medidas de contenedores y tolvas", celda: "cuatro" },
  ];

  return (
    <section className="mc-confianza">
      <div
        className="mc-chevron"
        style={{
          top: "-40%",
          right: "-3%",
          width: "26%",
          height: "180%",
          opacity: 0.1,
        }}
        aria-hidden="true"
      />
      {/* Se deja la rejilla de Bootstrap por una de tamaños propios: cuatro
          columnas iguales no pueden expresar que una vale más que las otras. */}
      <div className="container">
        <div className="mc-confianza-rejilla">
          {/* Entran en cascada con `Revelar`, que es el mecanismo que esta
              página ya usa treinta veces. Se intentó primero con
              `animation-timeline: view()` —ligado al scroll, que se mueve
              contigo y es mejor— pero no llegó a funcionar aquí y no vale
              dejar puesto algo que no corre. */}
          {items.map((it, i) => (
            <Revelar
              key={it.txt}
              retraso={i * 90}
              className={`mc-confianza-item ${it.celda}`}
            >
              <div className="mc-confianza-icono">
                <Icono nombre={it.icono} />
              </div>
              <div>
                <div className="mc-confianza-num"><Contador valor={it.num} /></div>
                <div className="mc-confianza-txt">{it.txt}</div>
              </div>
            </Revelar>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Tarjeta de servicio ---------- */
export function TarjetaServicio({ servicio }) {
  return (
    <article className="mc-tarjeta" id={servicio.slug}>
      <div className={`mc-tarjeta-icono ${servicio.tono}`}>
        <Icono nombre={servicio.icono} />
      </div>
      <h3>{servicio.titulo}</h3>
      <p>{servicio.resumen}</p>
      {servicio.etiqueta && (
        <span
          className={`mc-tarjeta-etiqueta ${servicio.etiquetaGris ? "gris" : ""}`}
        >
          {servicio.etiqueta}
        </span>
      )}
    </article>
  );
}

/* ---------- Rejilla de servicios ---------- */
export function RejillaServicios({ limite }) {
  const lista = limite ? SERVICIOS.slice(0, limite) : SERVICIOS;
  return (
    <div className="row g-4">
      {lista.map((s, i) => (
        <Revelar
          key={s.slug}
          as="div"
          className="col-md-6 col-lg-4"
          desde="abajo"
          retraso={(i % 3) * 90}
        >
          <TarjetaServicio servicio={s} />
        </Revelar>
      ))}
    </div>
  );
}

/* ---------- Sectores atendidos ---------- */
export function Sectores() {
  return (
    <section className="mc-seccion mc-seccion-hueso">
      <div className="container">
        <div className="row align-items-end mb-5">
          <div className="col-lg-7">
            <span className="mc-eyebrow">A quién servimos</span>
            <h2 className="mc-titulo-seccion">
              Trabajamos para la{" "}
              <span className="mc-marcado">mejora ambiental</span>
            </h2>
          </div>
          <div className="col-lg-5">
            <p className="mc-lead mb-0">
              Asesoramos en el manejo integral y la estrategia de recolección de
              residuos para todo tipo de empresas públicas y privadas, desde
              tiendas de conveniencia hasta la industria maquiladora.
            </p>
          </div>
        </div>
        <div className="row g-3">
          {SECTORES.map((s, i) => (
            <Revelar
              key={s.nombre}
              as="div"
              className="col-md-6 col-lg-4"
              desde="abajo"
              retraso={(i % 3) * 80}
            >
              <div className="mc-sector">
                <Icono nombre={s.icono} />
                <span>{s.nombre}</span>
              </div>
            </Revelar>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Clientes ---------- */
export function Clientes() {
  return (
    <section className="mc-seccion">
      <div className="container">
        <div className="text-center mb-5">
          <span className="mc-eyebrow">Confían en nosotros</span>
          <h2 className="mc-titulo-seccion">Algunos de nuestros clientes</h2>
          <p className="mc-lead mx-auto" style={{ maxWidth: 620 }}>
            Damos servicio a empresas de manufactura, acero, cemento, energía,
            logística portuaria y cadenas nacionales de retail y alimentos.
          </p>
        </div>
        {/* En marcha continua en vez de una rejilla quieta. La lista va DOS
            veces: la cinta se desplaza exactamente la mitad de su ancho y al
            volver a cero la segunda copia queda donde estaba la primera, asi
            que el ciclo no tiene costura visible. La copia va oculta a los
            lectores de pantalla para no leer los mismos logos dos veces. */}
        <div className="mc-clientes-marco">
          <div className="mc-clientes-cinta">
            {[0, 1].map((copia) =>
              CLIENTES.map((c) => (
                <div
                  key={`${copia}-${c.nombre}`}
                  className="mc-cliente"
                  title={c.nombre}
                  aria-hidden={copia === 1 ? "true" : undefined}
                >
                  {c.logo ? (
                    <img
                      src={c.logo}
                      alt={copia === 1 ? "" : c.nombre}
                      loading="lazy"
                      style={{ "--esc": c.escala || 1 }}
                    />
                  ) : (
                    <span className="mc-cliente-txt">{c.nombre}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Permisos ---------- */
export function Permisos({ hueso = false }) {
  return (
    <section className={`mc-seccion ${hueso ? "mc-seccion-hueso" : ""}`}>
      <div className="container">
        <div className="row g-5 align-items-center">
          <div className="col-lg-5">
            <span className="mc-eyebrow">Cumplimiento normativo</span>
            <h2 className="mc-titulo-seccion">
              Permisos vigentes en las{" "}
              <span className="mc-marcado">3 categorías</span>
            </h2>
            <p className="mc-lead">
              Contamos con todos los permisos y autorizaciones vigentes para la
              disposición de residuos, entregamos el Manifiesto del Protocolo de
              Disposición y cumplimos con la normatividad aplicable.
            </p>
            <p className="mc-lead">
              Tu empresa podrá beneficiarse con importantes ahorros mediante un
              manejo adecuado de residuos y la prevención de multas, al cumplir
              con todos los requisitos legales y ambientales.
            </p>
          </div>
          <div className="col-lg-7">
            <div className="row g-3">
              {PERMISOS.map((p, i) => (
                <Revelar
                  key={p.tipo}
                  as="div"
                  className="col-12"
                  desde="abajo"
                  retraso={i * 90}
                >
                  <div className="mc-tarjeta" style={{ padding: "1.5rem" }}>
                    <div className="d-flex gap-3 align-items-start">
                      {p.logo ? (
                        <div className="mc-permiso-logo" aria-hidden="false">
                          <img src={p.logo} alt={p.logoAlt || p.tipo} loading="lazy" />
                        </div>
                      ) : (
                        <div
                          className="mc-tarjeta-icono"
                          style={{
                            width: 46,
                            height: 46,
                            fontSize: "1.15rem",
                            marginBottom: 0,
                            flexShrink: 0,
                          }}
                        >
                          <Icono nombre="documento" />
                        </div>
                      )}
                      <div>
                        <h3 style={{ fontSize: "1.02rem", marginBottom: "0.3rem" }}>
                          {p.tipo}
                        </h3>
                        <span
                          className={`mc-tarjeta-etiqueta ${p.propio ? "" : "gris"}`}
                          style={{ marginTop: 0, marginBottom: "0.55rem" }}
                        >
                          {p.estado}
                        </span>
                        <p style={{ fontSize: "0.89rem" }}>{p.detalle}</p>
                      </div>
                    </div>
                  </div>
                </Revelar>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Banda CTA ---------- */
export function BandaCTA({
  titulo = "¿Necesitas una cotización para tu empresa?",
  texto = "Nos adaptamos a tu volumen, frecuencia y espacio disponible. Cuéntanos qué necesitas y te respondemos el mismo día.",
}) {
  return (
    <section className="mc-cta">
      <div className="mc-cta-chevron" aria-hidden="true" />
      <div className="container position-relative" style={{ zIndex: 2 }}>
        <div className="row align-items-center g-4">
          <div className="col-lg-8">
            <span className="mc-eyebrow mc-eyebrow-claro">
              Nos adaptamos a tus necesidades
            </span>
            <h2 className="mb-3">{titulo}</h2>
            <p
              style={{
                color: "rgba(255,255,255,0.72)",
                fontSize: "1.03rem",
                lineHeight: 1.65,
                margin: 0,
                maxWidth: 640,
              }}
            >
              {texto}
            </p>
          </div>
          <div className="col-lg-4">
            <div className="d-flex flex-column gap-3 align-items-lg-end">
              <Link href="/contacto" className="mc-btn mc-btn-verde">
                Solicitar cotización
              </Link>
              <a
                href={enlaceWhatsApp()}
                target="_blank"
                rel="noopener noreferrer"
                className="mc-btn mc-btn-linea-blanca"
              >
                Escríbenos por WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
