import Image from "next/image";
import { Encabezado, BandaCTA } from "@/components/Secciones";
import { EQUIPAMIENTO, EQUIPAMIENTO_LISTA } from "@/lib/datos";

export const metadata = {
  title: "Equipo y flota",
  description:
    "Flota propia de Morcast del Norte: camiones recolectores de 4 toneladas, pipas certificadas, camiones de volteo de 12 y 14 m³, roll off, jaulas de acero, retroexcavadora y tolvas con compactador.",
  alternates: { canonical: "/equipo" },
};

export default function Equipo() {
  return (
    <>
      <Encabezado
        miga="Equipo"
        titulo="Camiones, pipas y roll off"
        descripcion="Contamos con flota propia y capacidad para brindar servicio en el área de Matamoros. Cada unidad se asigna según el tipo de residuo, el volumen y el espacio disponible en tus instalaciones."
      />

      {/* Galería de flota */}
      <section className="mc-seccion">
        <div className="container">
          <div className="row align-items-end mb-5">
            <div className="col-lg-7">
              <span className="mc-eyebrow">Flota propia</span>
              <h2 className="mc-titulo-seccion">
                Unidades para cada tipo de <span className="mc-marcado">residuo</span>
              </h2>
            </div>
            <div className="col-lg-5">
              <p className="mc-lead mb-0">
                Desde recolección compactada de RSU hasta pipas aseguradas para
                daños ambientales en el manejo de líquidos peligrosos.
              </p>
            </div>
          </div>

          <div className="row g-4">
            {EQUIPAMIENTO.map((e) => (
              <div key={e.nombre} className="col-md-6 col-lg-4">
                <div className="mc-flota-item">
                  <Image
                    src={e.foto}
                    alt={e.nombre}
                    fill
                    sizes="(max-width: 767px) 100vw, (max-width: 991px) 50vw, 33vw"
                    style={{ objectFit: "cover" }}
                  />
                  <div className="mc-flota-cap">{e.nombre}</div>
                </div>
                <p
                  style={{
                    fontSize: "0.88rem",
                    color: "var(--mc-gris)",
                    marginTop: "0.75rem",
                    lineHeight: 1.6,
                  }}
                >
                  {e.detalle}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Lista completa */}
      <section className="mc-seccion mc-seccion-hueso">
        <div className="container">
          <div className="row g-5">
            <div className="col-lg-5">
              <span className="mc-eyebrow">Inventario</span>
              <h2 className="mc-titulo-seccion">Equipo disponible</h2>
              <p className="mc-lead">
                Servicio de limpieza a maquiladoras e industrias, y servicio de
                despalme y afine perimetral con maquinaria propia.
              </p>
              <div className="mc-nota">
                <strong>Contenedores a la medida.</strong> Contenedores metálicos
                de 1.5, 3 y 6 m³, y tolvas de 15 y 30 m³, dependiendo de las
                necesidades de tu empresa. Disponibles para instalación
                inmediata.
              </div>
            </div>
            <div className="col-lg-7">
              <div className="row">
                <div className="col-md-6">
                  <ul className="mc-lista">
                    {EQUIPAMIENTO_LISTA.slice(0, 6).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="col-md-6">
                  <ul className="mc-lista">
                    {EQUIPAMIENTO_LISTA.slice(6).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <BandaCTA
        titulo="¿Qué unidad necesita tu operación?"
        texto="Dinos tu volumen, frecuencia y espacio disponible. Te recomendamos el contenedor y la unidad adecuada sin costo."
      />
    </>
  );
}
