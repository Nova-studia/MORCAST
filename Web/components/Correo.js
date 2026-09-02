/**
 * Un correo escrito para que quepa.
 *
 * `morcastdelnorte.sa.de.cv@gmail.com` no cabe en el ancho de un teléfono ni
 * en la columna de la ficha del portafolio. Sin ayuda, el navegador lo parte
 * por donde caiga y deja ".com" —o peor, una "m" sola— en el renglón de
 * abajo. Con el <wbr /> justo después de la arroba parte por ahí, que es
 * donde se sigue leyendo como un correo.
 *
 * El <wbr /> NO es un carácter: no se copia al portapapeles ni viaja en el
 * `mailto:`. Y para que el navegador lo respete, la caja de alrededor tiene
 * que usar `overflow-wrap`, no `word-break: break-all` (ése parte por donde
 * sea y se salta esta pista).
 */
export default function Correo({ correo }) {
  const arroba = correo.indexOf("@");
  if (arroba < 0) return correo;
  return (
    <>
      {correo.slice(0, arroba + 1)}
      <wbr />
      {correo.slice(arroba + 1)}
    </>
  );
}
