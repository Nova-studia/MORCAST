import { useState } from "react";
import { View, Text, TextInput, Image, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../tema";
import { Boton } from "../ui";
import CampoClave from "../CampoClave";
import { entrar as entrarSesion } from "../sesion";
import BotonesSociales from "../BotonesSociales";
import OlvideClave from "../OlvideClave";
import { abrirEnNavegador, URL_ALTA } from "../enlaces-web";
import { tomarAvisoSalida } from "../aviso-salida";

/**
 * `onEntrar(modo)` abre la app en el modo que le toca a la cuenta:
 * "cliente" con contraseña; con Google o Apple puede ser también "admin",
 * "chofer" o "pendiente" (la sala de espera de quien todavía no tiene alta).
 */
export default function Login({ onEntrar, navigation }) {
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  // Si la app acaba de sacar a alguien (cuenta dada de baja, sesión que ya
  // no vale), aquí se dice por qué (aviso-salida.js, 9-oct-2026).
  const [error, setError] = useState(() => tomarAvisoSalida() || "");

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
    onEntrar(r.modo || "cliente");
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
          onChangeText={(v) => { setCorreo(v); setError(""); }}
        />

        <Text style={s.label}>Contraseña</Text>
        <CampoClave style={s.input} value={password} onChangeText={(v) => { setPassword(v); setError(""); }} onSubmitEditing={entrar} />

        <Boton onPress={entrar} style={{ marginTop: 20 }}>
          Entrar al portal
        </Boton>

        <OlvideClave paraClientes />

        {/* "o" + Google (las dos apps) + Apple (sólo iPhone). Si no se pueden
            ofrecer en este teléfono, no se pinta nada (ver el archivo). */}
        <BotonesSociales
          deshabilitado={entrando}
          onEntrar={(r) => onEntrar(r.modo)}
          onError={setError}
        />

        {/* Para quien todavía no es cliente: darse de alta (en morcast.mx,
            dentro de la app: el formulario con mapa y firma vive en la web)
            o cotizar y ver la cobertura sin cuenta (pantallas/explorar). */}
        <Text style={s.noCliente}>¿Aún no eres cliente?</Text>
        <Pressable
          onPress={() => abrirEnNavegador(URL_ALTA)}
          style={({ pressed }) => [s.explorar, pressed && { opacity: 0.8 }]}
          accessibilityRole="link"
          accessibilityLabel="Date de alta en morcast.mx"
        >
          <Feather name="user-plus" size={17} color={T.accionTxt} />
          <Text style={s.explorarTxt}>Date de alta</Text>
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate("Explorar")}
          style={({ pressed }) => [s.explorar, s.explorarSec, pressed && { opacity: 0.8 }]}
          accessibilityRole="button"
        >
          <Feather name="compass" size={17} color={T.gris} />
          <Text style={[s.explorarTxt, { color: T.tinta }]}>Explorar sin cuenta</Text>
        </Pressable>

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
  noCliente: { color: T.gris, fontSize: 13, textAlign: "center", marginTop: 18, marginBottom: 8 },
  explorar: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderWidth: 1, borderColor: T.accion, backgroundColor: T.accionTinte,
    borderRadius: 11, paddingVertical: 13, marginBottom: 6,
  },
  explorarTxt: { color: T.accionTxt, fontSize: 14.5, fontWeight: "700" },
  explorarSec: { borderColor: T.linea, backgroundColor: "transparent", marginTop: 4 },
  acceso: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1, borderColor: T.linea, borderRadius: 10, paddingVertical: 11 },
  accesoTxt: { color: T.gris, fontSize: 13.5, fontWeight: "600" },
  pie: { color: T.grisClaro, fontSize: 12, textAlign: "center", marginTop: 24 },
});
