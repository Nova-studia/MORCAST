import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { T } from "../../tema";
import { Boton } from "../../ui";
import { comprobarPase, mandarCodigo, verificarCodigo } from "../../pase-admin";
import { limpiarCodigo, codigoCompleto, correoOculto } from "../../segundo-paso.mjs";

/**
 * LA PUERTA DE LA ADMINISTRACIÓN: código por correo.
 *
 * Se pinta ANTES del panel cada vez que entra un dueño o administrador
 * (pedido de los dueños, 4-oct-2026). Primero pregunta al servidor si el
 * pase guardado en el llavero sigue valiendo; si sí, pasa directo y ni se
 * nota. Si no, manda un código al correo de la cuenta y lo pide.
 *
 * 🔴 Sin comprobar no se entra: si no hay señal para preguntar, se ofrece
 * reintentar, pero el panel NO se abre "por si acaso". Un candado que se
 * abre solo cuando falla la red no es un candado.
 */
export default function SegundoPaso({ onListo, onSalir }) {
  // revisando → (listo) | pidiendo | sinRed
  const [etapa, setEtapa] = useState("revisando");
  const [correo, setCorreo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [espera, setEspera] = useState(0);
  const reloj = useRef(null);

  useEffect(() => () => clearInterval(reloj.current), []);

  const contar = (segundos) => {
    clearInterval(reloj.current);
    setEspera(segundos);
    reloj.current = setInterval(() => {
      setEspera((s) => {
        if (s <= 1) { clearInterval(reloj.current); return 0; }
        return s - 1;
      });
    }, 1000);
  };

  const mandar = async () => {
    setOcupado(true);
    setError("");
    const r = await mandarCodigo();
    setOcupado(false);
    if (r.ok) {
      setCorreo(r.correo);
      contar(r.espera || 60);
    } else {
      setError(r.motivo);
      if (r.espera) contar(r.espera);
    }
  };

  const revisar = async () => {
    setEtapa("revisando");
    setError("");
    const r = await comprobarPase();
    if (r.valido) { onListo(); return; }
    if (r.sinRed) { setEtapa("sinRed"); return; }
    setEtapa("pidiendo");
    // El código se manda solo: si el dueño ya está aquí es para entrar, y
    // un botón de más es un paso de más.
    mandar();
  };

  useEffect(() => { revisar(); }, []);

  const verificar = async () => {
    if (!codigoCompleto(codigo) || ocupado) return;
    setOcupado(true);
    setError("");
    const r = await verificarCodigo(codigo);
    setOcupado(false);
    if (r.ok) { onListo(); return; }
    setError(r.motivo);
    setCodigo("");
  };

  if (etapa === "revisando") {
    return (
      <View style={s.centro}>
        <ActivityIndicator size="large" color={T.accionTxt} />
        <Text style={s.revisando}>Comprobando tu acceso…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.fondo }} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.chip}><Text style={s.chipTxt}>ADMINISTRACIÓN</Text></View>
          <View style={s.ico}><Feather name="shield" size={26} color={T.accionTxt} /></View>

          {etapa === "sinRed" ? (
            <>
              <Text style={s.h1}>No pudimos comprobar tu acceso</Text>
              <Text style={s.p}>
                Para abrir la administración hay que confirmar tu acceso con Morcast, y no hay
                conexión. Revisa tu señal e inténtalo otra vez.
              </Text>
              <Boton onPress={revisar} style={{ marginTop: 18 }}>Reintentar</Boton>
            </>
          ) : (
            <>
              <Text style={s.h1}>Escribe el código de tu correo</Text>
              <Text style={s.p}>
                {correo
                  ? `Te mandamos un código de 6 dígitos a ${correoOculto(correo)}. Vence en 10 minutos.`
                  : "Te mandamos un código de 6 dígitos al correo de tu cuenta. Vence en 10 minutos."}
                {" "}Así nadie entra a la administración solo con tu contraseña.
              </Text>

              {error ? (
                <View style={s.error}><Feather name="alert-circle" size={16} color={T.error} /><Text style={s.errorTxt}>{error}</Text></View>
              ) : null}

              <TextInput
                style={s.input}
                value={codigo}
                onChangeText={(v) => { setCodigo(limpiarCodigo(v)); setError(""); }}
                onSubmitEditing={verificar}
                placeholder="000000"
                placeholderTextColor={T.grisClaro}
                keyboardType="number-pad"
                // iOS ofrece el código del correo arriba del teclado.
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
                accessibilityLabel="Código de 6 dígitos"
              />

              <Boton onPress={verificar} disabled={!codigoCompleto(codigo) || ocupado} style={{ marginTop: 16 }}>
                {ocupado ? "Revisando…" : "Entrar a la administración"}
              </Boton>

              <Pressable onPress={mandar} disabled={espera > 0 || ocupado} style={s.link} hitSlop={8}>
                <Text style={[s.linkTxt, (espera > 0 || ocupado) && { color: T.grisClaro }]}>
                  {espera > 0 ? `Pedir otro código en ${espera} s` : "Mandar otro código"}
                </Text>
              </Pressable>
            </>
          )}

          <Pressable onPress={onSalir} style={s.volver} hitSlop={8}>
            <Feather name="log-out" size={15} color={T.gris} />
            <Text style={s.volverTxt}>Salir</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  centro: { flex: 1, backgroundColor: T.fondo, alignItems: "center", justifyContent: "center", padding: 24 },
  revisando: { color: T.gris, marginTop: 14, fontSize: 14 },
  scroll: { padding: 24, paddingTop: 40, flexGrow: 1, justifyContent: "center" },
  chip: { alignSelf: "flex-start", backgroundColor: "rgba(219,101,45,0.16)", borderColor: "rgba(219,101,45,0.5)", borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 16 },
  chipTxt: { color: T.adminTxt, fontSize: 11, fontWeight: "800", letterSpacing: 0.6 },
  ico: { width: 52, height: 52, borderRadius: 14, backgroundColor: T.accionTinte, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  h1: { color: T.tinta, fontSize: 22, fontWeight: "800", letterSpacing: -0.3 },
  p: { color: T.gris, fontSize: 14, marginTop: 8, lineHeight: 20 },
  error: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(217,119,107,0.14)", borderRadius: 10, padding: 11, marginTop: 14 },
  errorTxt: { color: T.error, fontSize: 13, flex: 1 },
  input: {
    backgroundColor: T.panel2, borderWidth: 1, borderColor: T.linea, borderRadius: 12,
    paddingVertical: 14, marginTop: 18, color: T.tinta, fontSize: 28, fontWeight: "700",
    letterSpacing: 10, textAlign: "center",
  },
  link: { alignItems: "center", marginTop: 16, padding: 6 },
  linkTxt: { color: T.accionTxt, fontSize: 14, fontWeight: "600" },
  volver: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 22, padding: 8 },
  volverTxt: { color: T.gris, fontSize: 13 },
});
