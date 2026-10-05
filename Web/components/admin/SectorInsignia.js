/**
 * La letra de un sector (A, B, C, D) en un cuadrito de su color.
 *
 * El color es el que trae el sector en la base (db/023): sigue a la ENTIDAD,
 * así que el Sector C se ve igual en el mapa, en la lista de puntos y en la
 * tabla de clientes. Los cuatro colores de 023 son oscuros, por eso la letra
 * va en blanco (misma regla que el verde de marca en DESIGN.md).
 *
 * `decorativa`: cuando al lado ya está escrito el nombre del sector.
 *
 * Radio de 4px, nunca píldora: DESIGN.md › Disposición.
 */
export default function SectorInsignia({ clave, color, nombre, chica = false, decorativa = false }) {
  const lado = chica ? 20 : 24;
  return (
    <span
      title={nombre || `Sector ${clave}`}
      // Junto al nombre escrito ("Sector A") la letra sobra para un lector de
      // pantalla: diría "Sector A Sector A".
      aria-label={decorativa ? undefined : nombre || `Sector ${clave}`}
      aria-hidden={decorativa || undefined}
      style={{
        display: "inline-grid",
        placeItems: "center",
        width: lado,
        height: lado,
        borderRadius: 4,
        background: color || "#2a6a99",
        color: "#fff",
        fontSize: chica ? "0.72rem" : "0.8rem",
        fontWeight: 700,
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      {clave}
    </span>
  );
}
