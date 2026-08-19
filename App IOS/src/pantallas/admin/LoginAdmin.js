import { useState } from "react";
import { View, Text, TextInput, Image, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../../tema";
import { Boton } from "../../ui";
import CampoClave from "../../CampoClave";
import { entrar as entrarSesion } from "../../sesion";

export default function LoginAdmin({ navigation, onLogin }) {
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const [entrando, setEntrando] = useState(false);

  const entrar = async () => {
    if (entrando) return;
    setEntrando(true);
    setError("");
    const r = await entrarSesion("admin", correo, password);
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
          <Image source={require("../../../assets/logo-morcast.png")} style={s.logo} resizeMode="contain" />
        </View>

        <View style={s.chip}><Text style={s.chipTxt}>ADMINISTRACIÓN</Text></View>
        <Text style={s.h1}>Panel de administración</Text>
        <Text style={s.p}>Gestiona solicitudes, clientes, saldos, servicios, reportes y tu equipo.</Text>

        {error ? (
          <View style={s.error}><Feather name="alert-circle" size={16} color="#f0895c" /><Text style={s.errorTxt}>{error}</Text></View>
        ) : null}

        <Text style={s.label}>Correo electrónico</Text>
        <TextInput style={s.input} placeholder="Tu correo de administración" placeholderTextColor={T.grisClaro} autoCapitalize="none" keyboardType="email-address" value={correo} onChangeText={setCorreo} />

        <Text style={s.label}>Contraseña</Text>
        <CampoClave style={s.input} value={password} onChangeText={setPassword} onSubmitEditing={entrar} />

        <Boton variante="naranja" onPress={entrar} style={{ marginTop: 20 }}>Entrar al panel</Boton>

        <Pressable onPress={() => navigation.goBack()} style={s.volver}>
          <Feather name="arrow-left" size={15} color={T.gris} />
          <Text style={s.volverTxt}>Volver al portal de clientes</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 24, paddingTop: 40, flexGrow: 1, justifyContent: "center", paddingBottom: 40 },
  hero: { alignItems: "center", marginBottom: 24 },
  logo: { width: 210, height: 88 },
  chip: { alignSelf: "flex-start", backgroundColor: "rgba(219,101,45,0.16)", borderColor: "rgba(219,101,45,0.5)", borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 10 },
  chipTxt: { color: T.naranjaClaro, fontSize: 11, fontWeight: "800", letterSpacing: 0.06 },
  h1: { color: T.tinta, fontSize: 24, fontWeight: "800", letterSpacing: -0.4 },
  p: { color: T.gris, fontSize: 14, marginTop: 6, marginBottom: 20, lineHeight: 20 },
  label: { color: T.tinta, fontSize: 13, fontWeight: "700", marginBottom: 7, marginTop: 12 },
  input: { backgroundColor: T.panel2, borderWidth: 1, borderColor: T.linea, borderRadius: 11, paddingHorizontal: 14, paddingVertical: 13, color: T.tinta, fontSize: 15 },
  error: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(219,101,45,0.14)", borderRadius: 10, padding: 11, marginBottom: 6 },
  errorTxt: { color: "#f0895c", fontSize: 13, flex: 1 },
  volver: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 16, padding: 8 },
  volverTxt: { color: T.gris, fontSize: 13 },
});
