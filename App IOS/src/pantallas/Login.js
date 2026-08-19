import { useState } from "react";
import { View, Text, TextInput, Image, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../tema";
import { Boton } from "../ui";
import CampoClave from "../CampoClave";
import { entrar as entrarSesion } from "../sesion";

export default function Login({ onLogin, navigation }) {
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const [entrando, setEntrando] = useState(false);

  const entrar = async () => {
    if (entrando) return;
    setEntrando(true);
    setError("");
    const r = await entrarSesion("cliente", correo, password);
    if (!r.ok) {
      setError(r.mensaje);
      setEntrando(false);
      return;
    }
    onLogin(r.perfil);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: T.fondo }}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.hero}>
          <Image source={require("../../assets/logo-morcast.png")} style={s.logo} resizeMode="contain" />
        </View>

        <Text style={s.h1}>Portal de clientes</Text>
        <Text style={s.p}>Consulta tu saldo, servicios, reportes y agrega saldo desde tu teléfono.</Text>

        {error ? (
          <View style={s.error}>
            <Feather name="alert-circle" size={16} color="#f0895c" />
            <Text style={s.errorTxt}>{error}</Text>
          </View>
        ) : null}

        <Text style={s.label}>Correo electrónico</Text>
        <TextInput
          style={s.input}
          placeholder="tu@empresa.com"
          placeholderTextColor={T.grisClaro}
          autoCapitalize="none"
          keyboardType="email-address"
          value={correo}
          onChangeText={setCorreo}
        />

        <Text style={s.label}>Contraseña</Text>
        <CampoClave style={s.input} value={password} onChangeText={setPassword} onSubmitEditing={entrar} />

        <Boton onPress={entrar} style={{ marginTop: 20 }}>
          Entrar al portal
        </Boton>

        <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
          <Pressable onPress={() => navigation.navigate("LoginAdmin")} style={s.acceso}>
            <Feather name="shield" size={15} color={T.gris} />
            <Text style={s.accesoTxt}>Administración</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate("LoginChofer")} style={s.acceso}>
            <Feather name="truck" size={15} color={T.gris} />
            <Text style={s.accesoTxt}>Chofer</Text>
          </Pressable>
        </View>

        <Text style={s.pie}>© 2026 Morcast del Norte, S.A. de C.V.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 24, paddingTop: 40, flexGrow: 1, justifyContent: "center", paddingBottom: 40 },
  hero: { alignItems: "center", marginBottom: 28 },
  logo: { width: 230, height: 96 },
  h1: { color: T.tinta, fontSize: 26, fontWeight: "800", letterSpacing: -0.4 },
  p: { color: T.gris, fontSize: 14, marginTop: 6, marginBottom: 22, lineHeight: 20 },
  label: { color: T.tinta, fontSize: 13, fontWeight: "700", marginBottom: 7, marginTop: 12 },
  input: {
    backgroundColor: T.panel2, borderWidth: 1, borderColor: T.linea, borderRadius: 11,
    paddingHorizontal: 14, paddingVertical: 13, color: T.tinta, fontSize: 15,
  },
  error: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(219,101,45,0.14)", borderRadius: 10, padding: 11, marginBottom: 6 },
  errorTxt: { color: "#f0895c", fontSize: 13, flex: 1 },
  acceso: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1, borderColor: T.linea, borderRadius: 10, paddingVertical: 11 },
  accesoTxt: { color: T.gris, fontSize: 13.5, fontWeight: "600" },
  pie: { color: T.grisClaro, fontSize: 12, textAlign: "center", marginTop: 24 },
});
