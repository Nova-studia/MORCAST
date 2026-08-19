import { useState } from "react";
import { View, TextInput, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "./tema";

/**
 * Campo de contraseña con el ojito para mostrarla.
 *
 * Existe porque escribir una contraseña a ciegas en un teclado de teléfono,
 * de pie y a veces con guantes, es la forma más fácil de equivocarse tres
 * veces seguidas y pensar que la clave está mal.
 *
 * Recibe el mismo `style` que traía el TextInput de cada pantalla, para que
 * se vea igual que el campo del correo que va justo arriba.
 */
export default function CampoClave({ value, onChangeText, style, placeholder = "••••••••", onSubmitEditing }) {
  const [ver, setVer] = useState(false);

  return (
    <View style={s.caja}>
      <TextInput
        style={[style, s.input]}
        placeholder={placeholder}
        placeholderTextColor={T.grisClaro}
        secureTextEntry={!ver}
        autoCapitalize="none"
        autoCorrect={false}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
      />
      <Pressable
        onPress={() => setVer((v) => !v)}
        style={s.ojo}
        hitSlop={12}
        accessibilityLabel={ver ? "Ocultar contraseña" : "Mostrar contraseña"}
      >
        <Feather name={ver ? "eye-off" : "eye"} size={19} color={T.gris} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  caja: { position: "relative", justifyContent: "center" },
  // Espacio a la derecha para que el texto no se meta debajo del ojo.
  input: { paddingRight: 46 },
  ojo: { position: "absolute", right: 12, padding: 4 },
});
