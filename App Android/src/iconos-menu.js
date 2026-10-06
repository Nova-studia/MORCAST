import { Image } from "react-native";

/**
 * ICONOS DEL MENÚ — los mismos dibujos de Luis que usa la web
 * ---------------------------------------------------------------------------
 * Son el primer cuadro quieto (PNG de 96 px, fondo transparente) de los
 * iconos de `Web/public/img/iconos-animados/`. Los nombres son los MISMOS que
 * en la web (`AdminShell.js` y `PortalShell.js`), para que un renglón lleve
 * el mismo dibujo en el teléfono y en morcast.mx. Si Luis cambia un dibujo,
 * se copia el PNG nuevo aquí con el mismo nombre en las DOS apps.
 *
 * Metro exige rutas estáticas en require(): por eso van uno por uno.
 *
 * POR QUÉ NO SE ANIMAN
 * En la web el renglón activo enseña el WebP animado. Aquí no: el <Image>
 * de React Native no lo reproduce igual en los dos sistemas sin `expo-image`,
 * y meter una dependencia nativa nueva solo para esto complicaba las
 * compilaciones de las tiendas. Queda la otra señal de la web: el apagado.
 */
const ICONOS_MENU = {
  "panel": require("../assets/iconos-menu/panel.png"),
  "historial-de-servicios": require("../assets/iconos-menu/historial-de-servicios.png"),
  "agregar-saldo": require("../assets/iconos-menu/agregar-saldo.png"),
  "cobertura": require("../assets/iconos-menu/cobertura.png"),
  "agendar": require("../assets/iconos-menu/agendar.png"),
  "reportes": require("../assets/iconos-menu/reportes.png"),
  "documentos": require("../assets/iconos-menu/documentos.png"),
  "cotizar": require("../assets/iconos-menu/cotizar.png"),
  "solicitudes": require("../assets/iconos-menu/solicitudes.png"),
  "por-pagar": require("../assets/iconos-menu/por-pagar.png"),
  "clientes": require("../assets/iconos-menu/clientes.png"),
  "servicios": require("../assets/iconos-menu/servicios.png"),
  "usuarios-y-roles": require("../assets/iconos-menu/usuarios-y-roles.png"),
  "programados": require("../assets/iconos-menu/programados.png"),
  // equipo 1: la bandeja de incidentes del chofer (6-oct-2026).
  "incidentes": require("../assets/iconos-menu/incidentes.png"),
  "cerra-sesion": require("../assets/iconos-menu/cerra-sesion.png"),
  // equipo 2: avisos a clientes (6-oct-2026).
  "avisos-a-clientes": require("../assets/iconos-menu/avisos-a-clientes.png"),
};

/**
 * Un icono del menú. Igual que en la web (`.mc-icono-anim` en portal.css),
 * quieto va un poco apagado (0.82) y el activo va a color pleno. Los dibujos
 * ya traen sus colores: NO se tiñen con el color de la pestaña; el color del
 * activo lo sigue diciendo la etiqueta de abajo.
 *
 * `activo` sin pasar = a color pleno (tarjetas, botones: no hay "activo").
 */
export function IconoMenu({ nombre, activo, tam = 28, style }) {
  const fuente = ICONOS_MENU[nombre];
  if (!fuente) return null;
  return (
    <Image
      source={fuente}
      // Acompaña a un texto que ya dice lo mismo: el lector de pantalla lo
      // saltaría de todos modos, y así no lee el renglón dos veces.
      accessible={false}
      importantForAccessibility="no"
      resizeMode="contain"
      style={[{ width: tam, height: tam, opacity: activo === false ? 0.82 : 1 }, style]}
    />
  );
}

export default ICONOS_MENU;
