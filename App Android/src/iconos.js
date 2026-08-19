// Iconos a color del cliente (mismas ilustraciones que la web) para las
// categorías de servicio/residuo. Metro exige rutas estáticas en require(),
// por eso se mapean uno por uno. Los PNG viven en assets/iconos/.
const ICONOS = {
  "residuos-solidos-urbanos": require("../assets/iconos/residuos-solidos-urbanos.png"),
  "manejo-especial": require("../assets/iconos/manejo-especial.png"),
  "aguas-oleosas": require("../assets/iconos/aguas-oleosas.png"),
  "aguas-residuales": require("../assets/iconos/aguas-residuales.png"),
  "contenedores": require("../assets/iconos/contenedores.png"),
  "reciclaje": require("../assets/iconos/reciclaje.png"),
};

export default ICONOS;
