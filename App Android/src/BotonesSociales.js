import { useMemo, useState } from "react";
import { View, Text, Image, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { T } from "./tema";
import { googleDisponible, entrarConGoogle } from "./entrar-social";
import { useAppleDisponible, BotonApple, entrarConApple } from "./entrar-apple";

/**
 * "o" + CONTINUAR CON GOOGLE + CONTINUAR CON APPLE (sólo iPhone), debajo del
 * formulario de correo y contraseña del login de clientes. Como en la web.
 *
 * Si ninguno de los dos se puede ofrecer (Expo Go, faltan los IDs de Google,
 * modo demostración sin base) no se pinta nada, ni siquiera la "o".
 *
 * `onEntrar({ modo, perfil })` recibe a dónde va la cuenta; `onError(texto)`
 * el mensaje para la persona. Cancelar la ventana de Google o de Apple no es
 * un error: no se avisa nada.
 *
 * ⚠️ ESTE ARCHIVO ESTÁ DUPLICADO en las dos apps, idéntico. En Android
 * `entrar-apple.js` es de mentiras y el botón de Apple nunca sale.
 */
export default function BotonesSociales({ onEntrar, onError, deshabilitado }) {
  const hayGoogle = useMemo(() => googleDisponible(), []);
  const hayApple = useAppleDisponible();
  const [entrando, setEntrando] = useState(null); // null | "google" | "apple"

  if (!hayGoogle && !hayApple) return null;

  const entrar = async (proveedor) => {
    if (entrando || deshabilitado) return;
    setEntrando(proveedor);
    onError?.("");
    const r = proveedor === "google" ? await entrarConGoogle() : await entrarConApple();
    if (r.ok) {
      // No se apaga `entrando`: la pantalla se desmonta al cambiar de modo.
      onEntrar?.(r);
      return;
    }
    setEntrando(null);
    if (!r.cancelado) onError?.(r.mensaje);
  };

  return (
    <View style={s.caja}>
      <View style={s.division}>
        <View style={s.raya} />
        <Text style={s.o}>o</Text>
        <View style={s.raya} />
      </View>

      {hayGoogle ? (
        // El botón "claro" de las guías de marca de Google: fondo blanco,
        // borde gris, la "G" de cuatro colores y el texto casi negro.
        <Pressable
          onPress={() => entrar("google")}
          disabled={Boolean(entrando)}
          style={({ pressed }) => [s.google, (pressed || entrando === "google") && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel="Continuar con Google"
        >
          {entrando === "google" ? (
            <ActivityIndicator color="#1f1f1f" />
          ) : (
            <>
              <Image source={require("../assets/google-g.png")} style={s.g} />
              <Text style={s.googleTxt}>Continuar con Google</Text>
            </>
          )}
        </Pressable>
      ) : null}

      {hayApple ? (
        <View style={{ marginTop: hayGoogle ? 10 : 0, opacity: entrando === "apple" ? 0.6 : 1, pointerEvents: entrando ? "none" : "auto" }}>
          <BotonApple onPress={() => entrar("apple")} />
        </View>
      ) : null}

      {entrando ? <Text style={s.entrando}>Entrando…</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  caja: { marginTop: 18 },
  division: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  raya: { flex: 1, height: 1, backgroundColor: T.linea },
  o: { color: T.gris, fontSize: 13 },
  google: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    height: 48, borderRadius: 11, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#747775",
  },
  g: { width: 20, height: 20 },
  googleTxt: { color: "#1f1f1f", fontSize: 15, fontWeight: "600" },
  entrando: { color: T.gris, fontSize: 13, textAlign: "center", marginTop: 8 },
});
