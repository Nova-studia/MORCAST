import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Linking, Alert, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../../tema";
import { enlaceComoLlegar, tieneUbicacion, revisarLectura } from "../../mapas.mjs";
import { leerUbicacion, avisarSinPermiso } from "../../gps";
import { fijarUbicacionPunto } from "../../datos-remoto";

/**
 * ¿DÓNDE ES? La dirección completa, cómo llegar y, si al punto le falta el
 * pin, el botón para guardarlo (pedido de los dueños, 4-oct-2026). Es el
 * gemelo de `Web/components/chofer/ChoferDondeEs.js`.
 *
 * `compacto` es para la tarjeta de la lista de paradas: solo la dirección,
 * las referencias y "Cómo llegar". En la pantalla de la recolección va
 * completo, con el botón del GPS.
 */
export default function DondeEs({ parada, compacto = false, onUbicacionGuardada }) {
  const [guardando, setGuardando] = useState(false);
  const punto = parada?.punto || null;
  const conPin = tieneUbicacion(punto);
  const direccion = parada?.direccionCompleta || parada?.direccion || "";

  const comoLlegar = () => {
    if (!punto && !direccion) {
      Alert.alert("Sin dirección", "Esta parada no tiene domicilio registrado. Llama a la oficina.");
      return;
    }
    const url = enlaceComoLlegar(punto || { calle: direccion });
    // `https://` lo abre la app de Google Maps si está instalada; si no,
    // Safari con el mapa. No hace falta preguntar `canOpenURL`.
    Linking.openURL(url).catch(() =>
      Alert.alert("No se pudo abrir el mapa", "Revisa que tengas Google Maps o Safari disponible.")
    );
  };

  const guardarUbicacion = () => {
    Alert.alert(
      "Guardar la ubicación de este punto",
      "Párate en la ENTRADA del punto (el portón o la puerta por donde se entra), al aire libre, y toca Guardar.\n\nLa ubicación se queda para los choferes que vengan después: que sea la de la entrada, no la de donde está el camión.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Guardar", onPress: leerYGuardar },
      ]
    );
  };

  const leerYGuardar = async () => {
    setGuardando(true);
    const r = await leerUbicacion({ alta: true });
    if (!r.ok) {
      setGuardando(false);
      if (r.sinPermiso) avisarSinPermiso(r.motivo);
      else Alert.alert("No se pudo leer el GPS", r.motivo);
      return;
    }
    const v = revisarLectura(r.lectura);
    if (!v.ok) {
      setGuardando(false);
      Alert.alert("Ubicación no guardada", v.motivo);
      return;
    }
    const g = await fijarUbicacionPunto(parada.id, { lat: v.lat, lng: v.lng });
    setGuardando(false);
    if (!g.ok) {
      Alert.alert("Ubicación no guardada", g.motivo);
      return;
    }
    onUbicacionGuardada?.({ lat: v.lat, lng: v.lng });
    Alert.alert("Ubicación guardada ✅", `Quedó el pin de la entrada (precisión ±${v.precision_m} m). Los siguientes choferes llegarán directo.`);
  };

  return (
    <View>
      {direccion ? (
        <Text style={s.dir}>
          <Feather name="map-pin" size={12} color={T.gris} /> {direccion}
        </Text>
      ) : null}
      {parada?.referencias ? (
        <Text style={s.ref}>
          <Text style={{ fontWeight: "700", color: T.tinta }}>Referencias: </Text>
          {parada.referencias}
        </Text>
      ) : null}

      <View style={[s.botones, compacto && { marginTop: 8 }]}>
        <Pressable onPress={comoLlegar} style={({ pressed }) => [s.boton, s.llegar, pressed && { opacity: 0.85 }]} accessibilityRole="button" hitSlop={4}>
          <Feather name="navigation" size={15} color="#0d1211" />
          <Text style={s.llegarTxt}>Cómo llegar</Text>
        </Pressable>
        {!compacto && !conPin && punto ? (
          <Pressable onPress={guardarUbicacion} disabled={guardando} style={({ pressed }) => [s.boton, s.pin, (pressed || guardando) && { opacity: 0.8 }]} accessibilityRole="button">
            {guardando ? <ActivityIndicator size="small" color={T.tinta} /> : <Feather name="crosshair" size={15} color={T.tinta} />}
            <Text style={s.pinTxt}>{guardando ? "Leyendo el GPS…" : "Guardar la ubicación de este punto"}</Text>
          </Pressable>
        ) : null}
      </View>
      {!compacto && !conPin && punto ? (
        <Text style={s.ayuda}>Este punto todavía no tiene pin: "Cómo llegar" busca la dirección escrita.</Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  dir: { color: T.gris, fontSize: 12.5, marginTop: 3, lineHeight: 18 },
  ref: { color: T.gris, fontSize: 12.5, marginTop: 5, lineHeight: 18 },
  botones: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  boton: { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 13, minHeight: 44 },
  // Naranja de campo: el modo chofer se usa en la calle, con sol y guantes.
  llegar: { backgroundColor: T.campo },
  llegarTxt: { color: "#0d1211", fontWeight: "800", fontSize: 13.5 },
  pin: { backgroundColor: T.panel2, borderWidth: 1, borderColor: T.linea, flexShrink: 1 },
  pinTxt: { color: T.tinta, fontWeight: "700", fontSize: 13, flexShrink: 1 },
  ayuda: { color: T.grisClaro, fontSize: 11.5, marginTop: 6 },
});
