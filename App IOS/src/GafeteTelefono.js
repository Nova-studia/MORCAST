import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Alert, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "./tema";
import { haySupabase } from "./supabase";
import { nfcDisponible, vincularGafete, desvincularEsteTelefono, telefonoConIdentidad, dejarDeLeer } from "./gafete";

/**
 * MI GAFETE EN ESTE TELÉFONO (Mi cuenta / Más del admin y del chofer).
 * Vincular (o volver a vincular) y desvincular este teléfono. El panel web
 * también desvincula (robo, teléfono nuevo). Sin NFC no se pinta.
 * ⚠️ Igual en App Android y App IOS.
 */
export default function GafeteTelefono() {
  const [hayNfc, setHayNfc] = useState(false);
  const [conIdentidad, setConIdentidad] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [leyendo, setLeyendo] = useState(false);

  const revisar = async () => {
    setHayNfc(haySupabase() && (await nfcDisponible()).hayNfc);
    setConIdentidad(await telefonoConIdentidad());
  };
  useEffect(() => { revisar(); }, []);

  if (!hayNfc) return null;

  const vincular = async () => {
    setOcupado(true);
    setLeyendo(true); // Android no enseña hoja propia: el aviso va aquí, con Cancelar
    const r = await vincularGafete();
    setLeyendo(false);
    setOcupado(false);
    if (r.cancelado) return;
    Alert.alert(r.ok ? "Gafete vinculado" : "No se pudo vincular", r.ok ? "Ya puedes entrar acercando tu gafete." : r.mensaje);
    revisar();
  };

  const desvincular = () =>
    Alert.alert("¿Desvincular este teléfono?", "Tu gafete ya no abrirá sesión aquí. Para volver a usarlo, entra con tu correo y vincúlalo otra vez.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Desvincular",
        style: "destructive",
        onPress: async () => {
          setOcupado(true);
          const r = await desvincularEsteTelefono();
          setOcupado(false);
          Alert.alert(r.ok ? "Teléfono desvinculado" : "No se pudo desvincular", r.ok ? "" : r.mensaje);
          revisar();
        },
      },
    ]);

  return (
    <View style={s.caja}>
      <Text style={s.titulo}>Mi gafete en este teléfono</Text>
      {leyendo && Platform.OS === "android" ? (
        <View style={s.leyendo}>
          <Text style={s.leyendoTxt}>Acerca tu gafete a la parte de atrás del teléfono…</Text>
          <Pressable onPress={dejarDeLeer} style={s.fila} accessibilityRole="button">
            <Feather name="x" size={18} color={T.gris} />
            <Text style={s.filaTxt}>Cancelar</Text>
          </Pressable>
        </View>
      ) : null}
      <Pressable onPress={vincular} disabled={ocupado} style={({ pressed }) => [s.fila, pressed && { opacity: 0.8 }]} accessibilityRole="button">
        <Feather name="credit-card" size={18} color={T.tealClaro} />
        <Text style={s.filaTxt}>{conIdentidad ? "Volver a vincular mi gafete" : "Vincular mi gafete"}</Text>
      </Pressable>
      {conIdentidad && (
        <Pressable onPress={desvincular} disabled={ocupado} style={({ pressed }) => [s.fila, pressed && { opacity: 0.8 }]} accessibilityRole="button">
          <Feather name="x-circle" size={18} color={T.gris} />
          <Text style={s.filaTxt}>Desvincular este teléfono</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  caja: { backgroundColor: T.panel2, borderColor: T.linea, borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12, gap: 4 },
  titulo: { color: T.gris, fontSize: 12, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 4 },
  fila: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  filaTxt: { color: T.tinta, fontSize: 15, fontWeight: "600" },
  leyendo: { borderColor: T.tealClaro, borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 6 },
  leyendoTxt: { color: T.tinta, fontSize: 14, lineHeight: 20 },
});
