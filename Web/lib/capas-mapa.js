/**
 * Las dos vistas de fondo de los mapas de Leaflet: "Mapa" (OpenStreetMap) y
 * "Satélite" (Esri World Imagery con nombres de calles encima).
 *
 * El satélite existe para que el pin quede EXACTO (6-oct-2026, Luis): en el
 * plano de calles una bodega y su vecina son el mismo cuadro gris; en la
 * foto se ve el portón. Es la solución gratuita mientras la empresa saca su
 * llave de Google Maps, que es el siguiente paso acordado.
 *
 * Al cambiar de vista se pone o se quita `mc-mapa-satelite` en el contenedor:
 * el CSS atenúa las teselas claras de OSM para el tema oscuro, y a una foto
 * aérea ese filtro solo la ensucia.
 *
 * ⚠️ Los dominios de aquí van también en la CSP de next.config.mjs (img-src).
 * Las atribuciones son obligatorias por las condiciones de uso de cada uno.
 */
export function agregarCapasBase(L, mapa) {
  const calles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; colaboradores de <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  });

  const esri = "https://server.arcgisonline.com/ArcGIS/rest/services";
  const satelite = L.layerGroup([
    L.tileLayer(`${esri}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, {
      attribution: "Imágenes &copy; Esri, Maxar, Earthstar Geographics",
      maxZoom: 19,
    }),
    // Nombres de calles y colonias sobre la foto: sin ellos, en satélite
    // nadie sabe en qué cuadra está.
    L.tileLayer(`${esri}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 19 }),
    L.tileLayer(`${esri}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 19 }),
  ]);

  calles.addTo(mapa);
  L.control.layers({ Mapa: calles, "Satélite": satelite }, null, { position: "topright" }).addTo(mapa);

  mapa.on("baselayerchange", (e) => {
    mapa.getContainer().classList.toggle("mc-mapa-satelite", e.layer === satelite);
  });
}
