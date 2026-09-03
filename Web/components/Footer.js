import Link from "next/link";
import Image from "next/image";
import {
  Phone,
  Envelope,
  MapPin,
  Clock,
} from "@phosphor-icons/react/dist/ssr";
import {
  EMPRESA,
  NAVEGACION,
  NAVEGACION_SECUNDARIA,
  SERVICIOS,
} from "@/lib/datos";
import Correo from "@/components/Correo";

export default function Footer() {
  const anio = new Date().getFullYear();

  return (
    <footer className="mc-footer">
      <div className="container">
        <div className="row g-5">
          {/* Marca */}
          <div className="col-lg-4">
            <Image
              src="/img/logo-nuevo-blanco.png"
              alt="Morcast del Norte"
              width={688}
              height={200}
              style={{ width: "auto", height: 58, marginBottom: "1.25rem" }}
            />
            <p style={{ lineHeight: 1.75, marginBottom: "1.5rem" }}>
              Servicio integral de recolección, transporte y disposición final de
              residuos sólidos, líquidos y de manejo especial en {EMPRESA.ciudad},{" "}
              {EMPRESA.estado}.
            </p>
            <div className="d-flex flex-column gap-2">
              <span className="d-inline-flex align-items-center gap-2">
                <MapPin size={15} style={{ color: "var(--mc-verde)" }} />
                {EMPRESA.ciudad}, {EMPRESA.estado}, {EMPRESA.pais}
              </span>
              <span className="d-inline-flex align-items-center gap-2">
                <Clock size={15} style={{ color: "var(--mc-verde)" }} />
                {EMPRESA.horario}
              </span>
            </div>
          </div>

          {/* Navegación */}
          <div className="col-6 col-lg-2">
            <h5>Navegación</h5>
            {[...NAVEGACION, ...NAVEGACION_SECUNDARIA].map((item) => (
              <Link key={item.href} href={item.href}>
                {item.texto}
              </Link>
            ))}
          </div>

          {/* Servicios */}
          <div className="col-6 col-lg-3">
            <h5>Servicios</h5>
            {SERVICIOS.slice(0, 6).map((s) => (
              <Link key={s.slug} href={`/servicios#${s.slug}`}>
                {s.titulo}
              </Link>
            ))}
          </div>

          {/* Contacto */}
          <div className="col-lg-3">
            <h5>Contacto</h5>
            {EMPRESA.telefonos.map((tel) => (
              <a key={tel} href={`tel:+52${tel.replace(/\s/g, "")}`}>
                <span className="d-inline-flex align-items-center gap-2">
                  <Phone size={14} style={{ color: "var(--mc-verde)" }} />
                  {tel}
                </span>
              </a>
            ))}
            {EMPRESA.correos.map((correo) => (
              <a
                key={correo}
                href={`mailto:${correo}`}
                /* `break-all` cortaba el correo largo por donde cayera y
                   dejaba "com" solo en el segundo renglon. Con `break-word`
                   solo parte si de plano no cabe, y el <wbr /> de abajo le
                   dice que parta por la arroba, que es donde se lee bien. */
                style={{ overflowWrap: "break-word", fontSize: "0.84rem" }}
              >
                <span className="d-inline-flex align-items-start gap-2">
                  <Envelope
                    size={14}
                    style={{ color: "var(--mc-verde)", marginTop: 4, flexShrink: 0 }}
                  />
                  <span>
                    <Correo correo={correo} />
                  </span>
                </span>
              </a>
            ))}
          </div>
        </div>

        <div className="mc-footer-base">
          <div className="row align-items-center g-3">
            <div className="col-md-7">
              {/* Sin punto extra: `razonSocial` ya termina en "S.A. de C.V.",
                  asi que el pie decia "C.V.. Todos los derechos reservados". */}
              © {anio} {EMPRESA.razonSocial} Todos los derechos reservados.
            </div>
            <div className="col-md-5 text-md-end">
              <Link
                href="/aviso-de-privacidad"
                style={{ display: "inline-block", margin: 0 }}
              >
                Aviso de Privacidad
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
