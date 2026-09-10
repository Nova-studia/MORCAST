import { Linking, Alert } from "react-native";

/**
 * Abre un chat de WhatsApp con un número mexicano de 10 dígitos.
 *
 * Primero la app (`whatsapp://`), porque `https://wa.me/…` en Android lo
 * atrapa el navegador cuando el enlace de app no está verificado: en el
 * teléfono de pruebas abría `api.whatsapp.com` en Chrome y se quedaba en
 * blanco. Si no hay WhatsApp instalado, cae a `wa.me` (que en un teléfono sin
 * la app enseña la página de descarga) y, si ni eso, avisa con el número.
 */
export async function abrirWhatsApp(telefono, texto) {
  const tel = String(telefono || "").replace(/\D/g, "");
  const msg = encodeURIComponent(texto || "");
  try {
    await Linking.openURL(`whatsapp://send?phone=52${tel}&text=${msg}`);
  } catch {
    try {
      await Linking.openURL(`https://wa.me/52${tel}?text=${msg}`);
    } catch {
      Alert.alert("No se pudo abrir WhatsApp", `Escríbenos al ${telefono}.`);
    }
  }
}
