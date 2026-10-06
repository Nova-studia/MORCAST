import { View, Text, Pressable, StyleSheet } from "react-native";
import { T } from "./tema";
import { abrirEnNavegador, URL_RECUPERAR } from "./enlaces-web";

/**
 * "¿OLVIDASTE TU CONTRASEÑA?" — abre morcast.mx/portal/recuperar dentro de
 * la app. La web manda el enlace por correo y ahí se escribe la nueva
 * (`/portal/nueva-clave`); la app no repite ese flujo.
 *
 * Sirve también para CREAR una contraseña: quien se registró con Google o
 * Apple no tiene, y con ese mismo enlace se pone una para entrar con su
 * correo. Por eso en el login de clientes (`paraClientes`) dice las dos cosas.
 *
 * ⚠️ ESTE ARCHIVO ESTÁ DUPLICADO en las dos apps, idéntico.
 */
export default function OlvideClave({ paraClientes = false }) {
  return (
    <View style={s.caja}>
      <Pressable onPress={() => abrirEnNavegador(URL_RECUPERAR)} accessibilityRole="link" hitSlop={8}>
        <Text style={s.enlace}>
          {paraClientes ? "¿Olvidaste tu contraseña? / Crear mi contraseña" : "¿Olvidaste tu contraseña?"}
        </Text>
      </Pressable>
      {paraClientes ? (
        <Text style={s.pista}>Si te registraste con Google, aquí puedes crear una contraseña para entrar con tu correo.</Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  caja: { alignItems: "center", marginTop: 14 },
  enlace: { color: T.accionTxt, fontSize: 13.5, fontWeight: "600", textAlign: "center" },
  pista: { color: T.grisClaro, fontSize: 12, lineHeight: 17, textAlign: "center", marginTop: 5, paddingHorizontal: 8 },
});
