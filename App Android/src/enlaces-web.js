import { Linking, Alert } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { EMPRESA_COTIZACION } from "./cotizacion-datos";

/**
 * Páginas de morcast.mx que la app abre en el navegador.
 *
 * Lo que la app NO hace por su cuenta (crear o recuperar la contraseña,
 * capturar el alta con mapa y firma) vive en la web: se abre ahí en vez de
 * copiarlo a medias en el teléfono.
 *
 * ⚠️ ESTE ARCHIVO ESTÁ DUPLICADO en las dos apps (App IOS y App Android).
 */
const SITIO = EMPRESA_COTIZACION.sitio.replace(/\/+$/, "");

/** "¿Olvidaste tu contraseña?" y también "crear mi contraseña" (quien entró con Google). */
export const URL_RECUPERAR = `${SITIO}/portal/recuperar`;
/** El login del portal: desde ahí "Continuar con Google" lleva al alta. */
export const URL_PORTAL_LOGIN = `${SITIO}/portal/login`;
/**
 * El alta de cliente nuevo (datos, mapa del domicilio y firma; 6-oct-2026).
 * Se abre la web en vez de copiar el formulario: la firma y el PDF del alta
 * viven ahí y tienen que ser los mismos para todos.
 */
export const URL_ALTA = `${SITIO}/portal/alta`;

/**
 * Abre la página DENTRO de la app (Safari / pestaña de Chrome encima de la
 * app) y, si eso no se puede, en el navegador del teléfono. Nunca truena: lo
 * peor es un aviso con la dirección para escribirla a mano.
 */
export async function abrirEnNavegador(url) {
  try {
    await WebBrowser.openBrowserAsync(url);
    return;
  } catch {
    // Sin navegador dentro de la app (o el módulo no está en esta
    // compilación): se intenta con el del teléfono.
  }
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert("No se pudo abrir la página", `Ábrela en tu navegador: ${url}`);
  }
}
