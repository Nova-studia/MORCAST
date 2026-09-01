/**
 * LA ZONA DE COBERTURA, MIENTRAS NO HAYA POLIGONOS POR RUTA.
 *
 * DE DONDE SALE ESTO
 * El cuaderno del 27-ago-2026 da las 5 rutas reales de Morcast con sus dias,
 * su chofer y su unidad, pero la cobertura viene como NOMBRES DE COLONIAS
 * ("pedro cardenas, lauro villar, avenida del maestro"), no como coordenadas.
 * La columna `rutas.zona` guarda un poligono, y de ahi vive el verificador de
 * cobertura de la pagina publica — el que capta prospectos y los guarda en
 * `zonas_pedidas`.
 *
 * Si las 5 rutas entraran con zona vacia, el verificador le diria que NO hay
 * cobertura a todo el mundo, incluida la gente que si la tiene.
 *
 * QUE ES ESTE POLIGONO
 * El contorno exterior de las 3 zonas que existian antes (RT-NORTE,
 * RT-CENTRO, RT-INDUSTRIAL), que en agosto ya se habian ampliado a toda la
 * ciudad de Matamoros. O sea: EXACTAMENTE la misma superficie que el sitio
 * viene prometiendo desde entonces. No se promete de mas ni de menos.
 *
 * Las tres eran bandas apiladas que compartian borde. La union se traza
 * siguiendo el borde este de las tres de norte a sur y cerrando por el sur y
 * el oeste. Donde la banda industrial tenia una muesca hacia adentro se pasa
 * derecho: la muesca queda DENTRO. Es cobertura de mas, no de menos, y en un
 * captador de prospectos ese es el lado correcto para equivocarse — un
 * "cuentanos donde estas" se resuelve con una llamada; un "no te cubrimos"
 * falso pierde al cliente en silencio.
 *
 * VIVE EN EL CODIGO, NO EN `rutas`. Tiene que sobrevivir al borrado de las
 * 3 rutas demo, y ademas dice la verdad sobre lo que es: la cobertura de la
 * EMPRESA, no la zona de ninguna ruta.
 *
 * CUANDO SE QUITA: cuando la empresa entregue los poligonos por ruta. Ese dia
 * `zonasDeCobertura()` vuelve a leer de `rutas` y este archivo se borra.
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
