import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Image, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useHeaderHeight } from "@react-navigation/elements";
import { T } from "../../tema";
import { Tarjeta, Boton } from "../../ui";
import { MOTIVOS_NO_PROCEDIO, validarNoProcedio, LIMITES_REPORTE } from "../../chofer-reportes.mjs";
import { marcarNoProcedio, subirEvidencia, avisarParada } from "../../datos-remoto";

/**
 * "NO PROCEDIÓ": el chofer llegó y no se pudo recoger (el residuo no es el
 * que se agendó, estaba cerrado, el contenedor no estaba…). La parada se
 * cierra SIN COBRO y con el motivo, que es el respaldo ante el cliente.
 * Pedido de los dueños (4-oct-2026); gemelo de la web
 * (`Web/components/chofer/ChoferNoProcedio.js`).
 *
 * La foto es opcional pero vale oro cuando el cliente reclama: "el residuo
 * no era el agendado" con foto no se discute. Se sube a la carpeta de la
 * parada en `evidencias`, como `no-procedio-<hora>.jpg`.
 */
export default function NoProcedio({ route, navigation, recargarRuta }) {
  const parada = route.params.parada;
  const alturaEncabezado = useHeaderHeight();
  const [motivo, setMotivo] = useState("");
  const [detalle, setDetalle] = useState("");
  const [foto, setFoto] = useState(null);
  const [error, setError] = useState({});
  const [guardando, setGuardando] = useState(false);

  const tomarFoto = async () => {
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (!p.granted) { Alert.alert("Permiso de cámara", "Activa la cámara para tomar la foto."); return; }
    const r = await ImagePicker.launchCameraAsync({ quality: 0.5 });
    if (!r.canceled) setFoto(r.assets[0]);
  };

  const enviar = () => {
    const v = validarNoProcedio({ motivo, detalle });
    if (!v.ok) { setError({ [v.campo]: v.mensaje }); return; }
    setError({});
    Alert.alert(
      "¿Marcar como «No procedió»?",
      `${parada.cliente}\n\nLa parada se cierra sin recolección y NO se le cobra al cliente. La oficina verá el motivo.`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Sí, no procedió", style: "destructive", onPress: guardar },
      ]
    );
  };

  const guardar = async () => {
    setGuardando(true);
    // La foto primero: si falla, se avisa y el chofer decide si manda sin
    // ella. Al revés, la parada quedaría cerrada con una foto que nunca subió
    // y él se iría creyendo que dejó el respaldo.
    if (foto?.uri) {
      const subida = await subirEvidencia(parada.id, "no-procedio", foto.uri, foto.mimeType || "image/jpeg");
      if (!subida.ok) {
        setGuardando(false);
        Alert.alert("No se pudo subir la foto", `${subida.motivo || "Revisa tu señal."}\n\nPuedes quitar la foto y mandar el reporte sin ella.`);
        return;
      }
    }
    const r = await marcarNoProcedio(parada.id, { motivo, detalle });
    setGuardando(false);
    if (!r.ok) {
      if (r.campo) setError({ [r.campo]: r.motivo });
      else Alert.alert("No se pudo guardar", r.motivo || "Revisa tu señal e inténtalo otra vez.");
      return;
    }
    // El cliente se entera de que no se pudo recoger y por qué (correo y
    // push, desde la web). No se espera: la parada ya quedó cerrada.
    avisarParada(parada.id, "no-procedio").then((a) => {
      if (!a.ok) console.warn("No se pudo avisar al cliente del «No procedió»:", a.motivo);
    });
    await recargarRuta?.();
    Alert.alert("Listo", "Quedó como «No procedió». No se le cobra al cliente y la oficina ya ve el motivo.", [
      { text: "Volver a mi ruta", onPress: () => navigation.popToTop() },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: T.fondo }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? alturaEncabezado : 0}
    >
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Tarjeta style={{ padding: 14 }}>
          <Text style={s.cliente}>{parada.cliente}</Text>
          <Text style={s.sub}>{parada.folio} · {parada.tipo}</Text>
        </Tarjeta>

        <Text style={s.label}>¿Qué pasó?</Text>
        {MOTIVOS_NO_PROCEDIO.map((m) => (
          <Pressable key={m} onPress={() => { setMotivo(m); setError({}); }} style={[s.opcion, motivo === m && s.opcionOn]} accessibilityRole="radio" accessibilityState={{ selected: motivo === m }}>
            <Feather name={motivo === m ? "check-circle" : "circle"} size={18} color={motivo === m ? T.campo : T.gris} />
            <Text style={[s.opcionTxt, motivo === m && { color: T.tinta, fontWeight: "700" }]}>{m}</Text>
          </Pressable>
        ))}
        {error.motivo ? <Text style={s.error}>{error.motivo}</Text> : null}

        <Text style={s.label}>{motivo === "Otro" ? "Explica qué pasó (obligatorio)" : "Detalle (opcional)"}</Text>
        <TextInput
          style={[s.input, error.detalle && { borderColor: T.error }]}
          placeholder={motivo === "Otro" ? "Ej. El portón tenía candado y nadie abrió." : "Algo que la oficina deba saber"}
          placeholderTextColor={T.grisClaro}
          value={detalle}
          onChangeText={(v) => { setDetalle(v); setError({}); }}
          multiline
          maxLength={LIMITES_REPORTE.detalle}
        />
        {error.detalle ? <Text style={s.error}>{error.detalle}</Text> : null}

        <Text style={s.label}>Foto (opcional)</Text>
        {foto ? (
          <View style={s.fotoFila}>
            <Image source={{ uri: foto.uri }} style={s.thumb} />
            <Text style={s.fotoOk}>Foto lista ✓</Text>
            <Pressable onPress={() => setFoto(null)} hitSlop={8} style={{ padding: 6 }} accessibilityLabel="Quitar la foto">
              <Feather name="trash-2" size={18} color={T.gris} />
            </Pressable>
          </View>
        ) : (
          <Boton variante="linea" onPress={tomarFoto}>
            <Feather name="camera" size={16} color={T.tinta} />
            <Text style={{ color: T.tinta, fontWeight: "700" }}>  Tomar foto</Text>
          </Boton>
        )}

        <Boton variante="naranja" onPress={enviar} disabled={guardando} style={{ marginTop: 22 }}>
          {guardando ? "Guardando…" : "Marcar como «No procedió»"}
        </Boton>
        <Text style={s.nota}>No se le cobra al cliente. Si sí pudiste recoger, regresa y termina la recolección normal.</Text>
      </ScrollView>
      {guardando && (
        <View style={s.capa}><ActivityIndicator size="large" color={T.campo} /></View>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  cliente: { color: T.tinta, fontSize: 16, fontWeight: "800" },
  sub: { color: T.gris, fontSize: 12.5, marginTop: 3 },
  label: { color: T.tinta, fontSize: 13, fontWeight: "700", marginTop: 14, marginBottom: 8 },
  opcion: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: T.panel, borderWidth: 1, borderColor: T.linea, borderRadius: 11, paddingVertical: 13, paddingHorizontal: 13, marginBottom: 8, minHeight: 48 },
  opcionOn: { borderColor: T.campo, backgroundColor: "rgba(219,101,45,0.10)" },
  opcionTxt: { color: T.gris, fontSize: 14, flex: 1 },
  input: { backgroundColor: T.panel2, borderWidth: 1, borderColor: T.linea, borderRadius: 10, padding: 12, color: T.tinta, fontSize: 14.5, minHeight: 80, textAlignVertical: "top" },
  error: { color: T.error, fontSize: 12.5, marginTop: 4 },
  fotoFila: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: T.panel, borderRadius: 11, borderWidth: 1, borderColor: T.linea, padding: 10 },
  thumb: { width: 56, height: 70, borderRadius: 8, backgroundColor: "#000" },
  fotoOk: { color: T.ok, fontSize: 13, flex: 1 },
  nota: { color: T.grisClaro, fontSize: 12, marginTop: 10, textAlign: "center", lineHeight: 17 },
  capa: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(9,15,14,0.6)", alignItems: "center", justifyContent: "center" },
});
