/**
 * LA ZONA DE COBERTURA, MIENTRAS NO HAYA POLÍGONOS POR RUTA.
 *
 * ESPEJO de `Web/lib/zona-matamoros.mjs` (ahí está la historia completa).
 * Las 5 rutas reales entraron SIN polígono: el cuaderno de la empresa da
 * nombres de colonias, no coordenadas. Sin este respaldo el mapa de
 * Cobertura le contesta "todavía no llegamos ahí" a todo el mundo, incluida
 * la gente que sí tiene servicio. La web usa este mismo contorno desde
 * septiembre, así que la app promete exactamente la misma superficie.
 *
 * CUÁNDO SE QUITA: el día que la empresa entregue los polígonos por ruta,
 * aquí y en la web a la vez.
 */
export const ZONA_MATAMOROS = {
  clave: "COBERTURA-MATAMOROS",
  nombre: "Matamoros y zona industrial",
  tipo: "manual",
  dias: [],
  zona: [
    // Borde norte y este de la banda norte
    [25.9291, -97.605], [25.9291, -97.57], [25.9251, -97.565], [25.925, -97.56],
    [25.9291, -97.555], [25.9291, -97.55], [25.9182, -97.54], [25.9193, -97.535],
    [25.885, -97.52], [25.8869, -97.51], [25.8963, -97.5], [25.8787, -97.495],
    [25.8826, -97.49], [25.8775, -97.485], [25.8837, -97.475], [25.8744, -97.47],
    [25.8804, -97.465], [25.8826, -97.46], [25.872, -97.46],
    // Borde este de la banda centro
    [25.8661, -97.455], [25.8541, -97.45], [25.8487, -97.445], [25.8476, -97.405],
    [25.845, -97.405],
    // Borde este y sur de la banda industrial
    [25.838, -97.4], [25.8361, -97.395], [25.795, -97.395], [25.795, -97.605],
    // El borde oeste cierra solo contra el primer vertice
  ],
};
