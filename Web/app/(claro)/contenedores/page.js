import Image from "next/image";
import { Encabezado, BandaCTA } from "@/components/Secciones";
import Icono from "@/components/Iconos";
import {
  CONTENEDORES,
  CONTENEDORES_MEDIDAS,
  CONTENEDORES_PENDIENTES,
} from "@/lib/datos";

export const metadata = {
  title: "Contenedores y tolvas",
  description:
    "Renta de contenedores metálicos de 1.5, 3 y 6 m³, y tolvas de 15 y 30 m³ en Matamoros, Tamaulipas. Instalación inmediata en tu domicilio y roll off para movimiento de tolvas.",
  alternates: { canonical: "/contenedores" },
};

export default function Contenedores() {
  return (
    <>
      <Encabezado
        miga="Contenedores"
        titulo="Contenedores y tolvas"
        descripcion="Cinco medidas para adaptarnos al volumen, la frecuencia y el espacio disponible de tu empresa. Todas disponibles para instalación inmediata en tu domicilio."
      />

      {/* Medidas disponibles */}
      <section className="mc-seccion">
        <div className="container">
          <div className="text-center mb-5">
            <span className="mc-eyebrow">Nos adaptamos a tus necesidades</span>
            <h2 className="mc-titulo-seccion">
              Medidas <span className="mc-marcado">disponibles</span>
            </h2>
            <p className="mc-lead mx-auto" style={{ maxWidth: 620 }}>
              Contenedores metálicos de 1.5, 3 y 6 m³ para comercios e industrias, y
              tolvas de 15 y 30 m³ para operaciones de gran volumen.
            </p>
          </div>
          <div className="row g-4">
            {/* Una sola columna en el telefono: a dos columnas la tarjeta se
                queda en ~175 px, "1.5 m³" se parte en dos renglones y el texto
                cae en una tira de dos palabras por linea.
                Y en escritorio `col-lg` (sin numero) reparte el ancho entre
                las que haya: con `col-lg-3` eran cuatro por renglon y la
                quinta medida se quedaba sola con tres huecos vacios al lado. */}
            {CONTENEDORES_MEDIDAS.map((c) => (
              <div key={c.medida} className="col-12 col-sm-6 col-lg">
                <div className="mc-tarjeta text-center h-100">
                  <div
                    className="mc-tarjeta-icono verde"
                    style={{ marginInline: "auto" }}
                  >
                    <Icono nombre="contenedor" />
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--fuente-titulo)",
                      fontWeight: 800,
                      fontSize: "1.9rem",
                      color: "var(--mc-verde-claro)",
                      lineHeight: 1.1,
                    }}
                  >
                    {c.medida}
                  </div>
                  <span
                    className="mc-tarjeta-etiqueta"
                    style={{ marginTop: "0.5rem", marginBottom: "0.7rem" }}
                  >
                    {c.tipo}
                  </span>
                  <p style={{ fontSize: "0.87rem" }}>{c.detalle}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mc-nota mt-4">
            <strong>¿Mucho volumen?</strong> Las tolvas de 15 y 30 m³ pueden
            equiparse con compactador de alta eficiencia, y contamos con roll off
            propio para su movimiento e intercambio.
          </div>
        </div>
      </section>

      {/* Galería */}
      <section className="mc-seccion mc-seccion-hueso">
        <div className="container">
          <div className="text-center mb-5">
            <span className="mc-eyebrow">Equipo en operación</span>
            <h2 className="mc-titulo-seccion">Nuestros contenedores</h2>
          </div>
          {/* Mosaico: fotos completas, sin recorte, cada una a su proporción. */}
          <div className="mc-galeria-mosaico">
            {CONTENEDORES.map((c) => (
              <div key={c.foto} className="mc-galeria-item">
                <Image
                  src={c.foto}
                  alt={c.alt}
                  width={c.ancho}
                  height={c.alto}
                  sizes="(max-width: 575px) 100vw, 50vw"
                  style={{ width: "100%", height: "auto" }}
                />
                <div className="mc-flota-cap">{c.nombre}</div>
              </div>
            ))}
          </div>

          {/* Tipos pendientes de foto (se agregarán cuando lleguen buenas fotos) */}
          <div className="row g-3 mt-4">
            {CONTENEDORES_PENDIENTES.map((nombre) => (
              <div key={nombre} className="col-6 col-md-4 col-lg-2">
                <div className="mc-pendiente">
                  <Icono nombre="contenedor" />
                  <span className="nombre">{nombre}</span>
                  <span className="etq">Foto próximamente</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <BandaCTA
        titulo="¿Qué medida necesita tu operación?"
        texto="Dinos tu volumen, frecuencia y espacio disponible. Te recomendamos el contenedor o la tolva adecuada sin costo."
      />
    </>
  );
}
