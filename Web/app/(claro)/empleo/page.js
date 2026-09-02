import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { Encabezado } from "@/components/Secciones";
import FormularioEmpleo from "@/components/FormularioEmpleo";
import { vacantesAbiertas } from "@/app/acciones-empleo";
import { fichaDeVacante, nombreDeVacante } from "@/lib/empleo.mjs";

export const metadata = {
  title: "Trabaja con nosotros",
  description:
    "Vacantes abiertas en Morcast del Norte: operación y oficina en Matamoros, Tamaulipas. Manda tu solicitud aunque no haya una vacante abierta para tu perfil.",
  alternates: { canonical: "/empleo" },
};

/**
 * Esta página NO puede ser estática, aunque nada de lo de arriba lo delate.
 *
 * `vacantesAbiertas()` lee la base EN CADA VISITA porque así lo necesita esta
 * pantalla: sin esta línea, Next no ve ninguna razón para no congelarla en
 * el build (no hay cookies, ni headers, ni nada que la vuelva dinámica "por
 * accidente"), y la prerenderiza una sola vez (`○ /empleo` en la salida de
 * `next build`). El resultado es que la dueña publica una vacante desde el
 * panel y el sitio sigue enseñando lo de antes hasta el próximo despliegue
 * —o, peor, la cierra y /empleo la sigue ofreciendo, recibiendo gente para
 * un puesto que ya no existe—. Eso rompe la razón de ser de la función: que
 * ella publique sola, sin depender de un despliegue de nadie.
 */
export const dynamic = "force-dynamic";

/**
 * `FormularioEmpleo` lee `?vacante=<id>` con `useSearchParams()` para
 * preseleccionar la vacante —esa lógica vive ahí, no se repite aquí—. Este
 * bloque de respaldo evita el salto de maquetado mientras Next resuelve el
 * límite de Suspense que ese hook exige: mismo `mc-form` y una altura
 * parecida a la del formulario real, no una caja vacía.
 */
function CargandoFormulario() {
  return <div className="mc-form" style={{ minHeight: 640 }} aria-hidden="true" />;
}

export default async function Empleo() {
  const vacantes = await vacantesAbiertas();

  return (
    <>
      <Encabezado
        miga="Trabaja con nosotros"
        titulo="Trabaja con nosotros"
        descripcion="Somos una empresa en crecimiento, con flota propia y operación en toda la ciudad de Matamoros. Conoce las vacantes abiertas o déjanos tu solicitud aunque no haya una para tu perfil."
      />

      {/* Vacantes abiertas */}
      <section className="mc-seccion">
        <div className="container">
          {vacantes.length > 0 ? (
            <>
              <div className="text-center mb-5">
                <span className="mc-eyebrow">Únete al equipo</span>
                <h2 className="mc-titulo-seccion">
                  Vacantes <span className="mc-marcado">abiertas</span>
                </h2>
              </div>
              {/* Una sola columna en el teléfono: a dos columnas en 390 px el
                  texto de la tarjeta se queda con una palabra por renglón,
                  igual que en `contenedores`. */}
              <div className="row g-4 justify-content-center">
                {vacantes.map((v) => {
                  const ficha = fichaDeVacante(v);
                  return (
                    <div key={v.id} className="col-12 col-md-6 col-lg-4">
                      <article className="mc-tarjeta h-100 d-flex flex-column">
                        <h3>{nombreDeVacante(v)}</h3>
                        {ficha && <span className="mc-tarjeta-etiqueta">{ficha}</span>}
                        {v.descripcion && <p>{v.descripcion}</p>}
                        {v.requisitos?.length > 0 && (
                          <ul className="mc-lista">
                            {v.requisitos.map((r) => (
                              <li key={r}>{r}</li>
                            ))}
                          </ul>
                        )}
                        <Link
                          href={`/empleo?vacante=${v.id}#solicitud`}
                          className="mc-btn mc-btn-linea mt-auto"
                        >
                          Aplicar a esta vacante <ArrowRight aria-hidden="true" />
                        </Link>
                      </article>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="mc-nota">
              Ahora mismo no tenemos vacantes abiertas, pero déjanos tus datos
              y te buscamos cuando se abra una.
            </div>
          )}
        </div>
      </section>

      {/* La solicitud */}
      <section id="solicitud" className="mc-seccion mc-seccion-hueso">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-8">
              <Suspense fallback={<CargandoFormulario />}>
                <FormularioEmpleo vacantes={vacantes} />
              </Suspense>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
