import { View, Text, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../../tema";

/**
 * La barra de arriba del modo "Explorar sin cuenta".
 *
 * No es el encabezado nativo de la pila a propósito: el flujo de login vive
 * dentro de un `SafeAreaView` que ya respeta el notch, y el encabezado nativo
 * de iOS vuelve a sumar ese margen. Una barra propia se ve igual en los dos
 * sistemas.
 */
export default function BarraVolver({ navigation, titulo }) {
  return (
    <View style={s.barra}>
      <Pressable
        onPress={() => navigation.goBack()}
        hitSlop={10}
        style={({ pressed }) => [s.volver, pressed && { opacity: 0.6 }]}
        accessibilityRole="button"
        accessibilityLabel="Volver"
      >
        <Feather name="chevron-left" size={22} color={T.accionTxt} />
        <Text style={s.volverTxt}>Volver</Text>
      </Pressable>
      {titulo ? <Text style={s.titulo} numberOfLines={1}>{titulo}</Text> : null}
      <View style={s.lado} />
    </View>
  );
}

const s = StyleSheet.create({
  barra: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 10, height: 48, backgroundColor: T.panel,
    borderBottomWidth: 1, borderBottomColor: T.linea,
  },
  volver: { flexDirection: "row", alignItems: "center", width: 90 },
  volverTxt: { color: T.accionTxt, fontSize: 15, fontWeight: "600" },
  titulo: { color: T.tinta, fontSize: 16, fontWeight: "700", flex: 1, textAlign: "center" },
  lado: { width: 90 },
});
