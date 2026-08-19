import {
  FaTruck,
  FaShieldAlt,
  FaClock,
  FaFileContract,
  FaDumpster,
} from "react-icons/fa";

/**
 * Iconografía de Morcast.
 *
 * Los iconos de categoría (servicios y sectores) usan las ilustraciones a
 * color del cliente, guardadas en /public/img/iconos/. El resto (insignias de
 * confianza, usos en línea sin ilustración) conservan los iconos de línea.
 *
 * El sistema de iconos ANTERIOR (react-icons monocromáticos) quedó respaldado
 * en la carpeta "iconos anteriores" en la raíz del repo.
 */

// Clave -> archivo PNG en /public/img/iconos/
const PNG = {
  // Servicios
  basura: "residuos-solidos-urbanos",
  rme: "manejo-especial",
  peligro: "residuos-peligrosos",
  agua: "aguas-residuales",
  aceite: "aguas-oleosas",
  gota: "aguas-peligrosas",
  contenedor: "contenedores",
  reciclar: "reciclaje",
  // Sectores
  fabrica: "industrias-maquiladoras",
  restaurante: "industrias-restauranteras",
  tienda: "centros-comerciales",
  escuela: "escuelas",
  mercado: "mercados",
  hospital: "clinicas-hospitales",
  // Barra de confianza (estadísticas)
  categorias: "categorias-residuos",
  flota: "flota-unidades",
  medidas: "medidas-contenedores",
  emergencias: "atencion-emergencias",
};

// Iconos de línea para las claves sin ilustración a color.
const MAPA = {
  camion: FaTruck,
  escudo: FaShieldAlt,
  reloj: FaClock,
  documento: FaFileContract,
  // Versión de línea del contenedor, para la barra de stats (fila uniforme
  // con los demás iconos de línea; el PNG a color se usa en las tarjetas).
  contenedorLinea: FaDumpster,
};

export default function Icono({ nombre, size, className, style, ...props }) {
  const archivo = PNG[nombre];
  if (archivo) {
    const lado = size ? `${size}px` : undefined;
    return (
      <img
        src={`/img/iconos/${archivo}.png`}
        alt=""
        aria-hidden="true"
        className={`mc-icono-img${className ? ` ${className}` : ""}`}
        style={lado ? { width: lado, height: lado, ...style } : style}
        {...props}
      />
    );
  }

  const Componente = MAPA[nombre];
  if (!Componente) return null;
  return (
    <Componente
      aria-hidden="true"
      size={size}
      className={className}
      style={style}
      {...props}
    />
  );
}
