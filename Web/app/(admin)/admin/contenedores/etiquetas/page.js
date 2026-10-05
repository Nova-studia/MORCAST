import { expandirCodigos, qrDeCodigo } from "@/lib/contenedores.mjs";
import BarraEtiquetas from "./barra";
import s from "./etiquetas.module.css";

export const metadata = { title: "Etiquetas de contenedores · Morcast" };

/**
 * HOJA DE ETIQUETAS QR para imprimir (tamaño carta).
 *
 * Recibe los códigos en la URL, comprimidos en rangos (`?c=1-50,60`, ver
 * `comprimirCodigos`), para poder recargarla o abrirla en otra pestaña sin
 * perder la selección. No consulta la base: lo único que lleva cada
 * etiqueta es su código, y quien abre esto ya pasó por el candado del panel
 * (proxy.js y AdminShell).
 *
 * Es componente de SERVIDOR a propósito: los QR se dibujan aquí y llegan
 * hechos, así que la página no le manda al navegador la librería del QR.
 */

/** Dos tamaños: 12 por hoja para contenedores chicos, 6 para tolvas. */
const TAMANOS = { 12: { columnas: 3, filas: 4 }, 6: { columnas: 2, filas: 3 } };

export default async function EtiquetasPage({ searchParams }) {
  const p = await searchParams;
  const seleccion = typeof p.c === "string" ? p.c : "";
  const codigos = expandirCodigos(seleccion);
  const tam = TAMANOS[p.tam] ? Number(p.tam) : 12;
  const { columnas, filas } = TAMANOS[tam];
  const porHoja = columnas * filas;
  // Para aprovechar una hoja de etiquetas adhesivas ya empezada: se dejan en
  // blanco las primeras `salto` casillas.
  const salto = Math.min(Math.max(Number.parseInt(p.salto, 10) || 0, 0), porHoja - 1);

  const casillas = [...Array(salto).fill(null), ...codigos];
  const hojas = [];
  for (let i = 0; i < casillas.length; i += porHoja) hojas.push(casillas.slice(i, i + porHoja));

  return (
    <div className={s.raiz}>
      <BarraEtiquetas seleccion={seleccion} total={codigos.length} hojas={hojas.length} tam={tam} salto={salto} porHoja={porHoja} />

      {codigos.length === 0 ? (
        <div className="pt-card pt-vacio">
          No hay códigos que imprimir. Vuelve a Contenedores, marca los que quieras y
          pulsa <strong>Imprimir etiquetas</strong>.
        </div>
      ) : (
        <div className={s.hojas}>
          {hojas.map((hoja, h) => (
            <section
              key={h}
              className={`${s.hoja} ${tam === 6 ? s.grande : ""}`}
              style={{ "--cols": columnas, "--filas": filas }}
              aria-label={`Hoja ${h + 1} de ${hojas.length}`}
            >
              {hoja.map((codigo, i) =>
                codigo ? <Etiqueta key={codigo} codigo={codigo} /> : <div key={`v${i}`} className={s.vacia} aria-hidden="true" />
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Una etiqueta: el QR grande y, debajo, el código en letras grandes — si el
 * QR se raya o el teléfono no lo lee, el chofer lo teclea. Luego quién es el
 * dueño del contenedor y a dónde llamar si aparece en otro lado.
 */
function Etiqueta({ codigo }) {
  const { tam, d } = qrDeCodigo(codigo);
  return (
    <div className={s.etiqueta}>
      <svg
        className={s.qr}
        viewBox={`0 0 ${tam} ${tam}`}
        shapeRendering="crispEdges"
        role="img"
        aria-label={`Código QR ${codigo}`}
      >
        <rect width={tam} height={tam} fill="#fff" />
        <path d={d} fill="#000" />
      </svg>
      <div className={s.codigo}>{codigo}</div>
      <div className={s.marca}>Morcast del Norte</div>
      <div className={s.telefono}>868 384 9478</div>
    </div>
  );
}
