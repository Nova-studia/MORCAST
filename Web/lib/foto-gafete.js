"use client";

/**
 * LA FOTO DEL GAFETE, lista para subir (solo navegador).
 *
 * La foto de un teléfono pesa 4 o 5 MB y viene en cualquier proporción. En
 * el gafete y en la página va en 4:5, chica. Aquí se recorta al centro y se
 * baja a 600 × 750 en JPG (unos 100 KB): cabe de sobra en el tope de la
 * cubeta, se imprime bien a 300 ppp en los 25 mm del gafete y hace que
 * cargar 140 personas desde el Excel no tarde una eternidad.
 */

export const ANCHO_FOTO = 600;
export const ALTO_FOTO = 750;

/** La dirección de la foto de un empleado en el panel (ver foto/[id]/route.js). */
export function fotoDelPanel(empleado) {
  return empleado?.foto_ruta
    ? `/admin/personal/foto/${empleado.id}?v=${encodeURIComponent(empleado.foto_ruta)}`
    : null;
}

/**
 * Un archivo o Blob de imagen → un `File` JPG de 600 × 750, recortado al
 * centro. Lanza si el navegador no puede leer la imagen (un HEIC en un
 * navegador que no lo abre, un archivo que no es imagen).
 */
export async function prepararFoto(origen, nombre = "foto.jpg") {
  const mapa = await createImageBitmap(origen, { imageOrientation: "from-image" });
  try {
    // El recorte más grande de proporción 4:5 que cabe, centrado. Un poco
    // hacia arriba en las fotos altas: ahí suele estar la cara.
    const proporcion = ANCHO_FOTO / ALTO_FOTO;
    let ancho = mapa.width;
    let alto = Math.round(ancho / proporcion);
    if (alto > mapa.height) {
      alto = mapa.height;
      ancho = Math.round(alto * proporcion);
    }
    const x = Math.round((mapa.width - ancho) / 2);
    const y = Math.round((mapa.height - alto) * 0.35);

    const lienzo = document.createElement("canvas");
    lienzo.width = ANCHO_FOTO;
    lienzo.height = ALTO_FOTO;
    const ctx = lienzo.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    // Fondo blanco: un PNG con transparencia saldría con el fondo negro en JPG.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, ANCHO_FOTO, ALTO_FOTO);
    ctx.drawImage(mapa, x, y, ancho, alto, 0, 0, ANCHO_FOTO, ALTO_FOTO);

    const blob = await new Promise((listo) => lienzo.toBlob(listo, "image/jpeg", 0.86));
    if (!blob) throw new Error("No se pudo preparar la foto.");
    return new File([blob], nombre.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } finally {
    mapa.close?.();
  }
}
