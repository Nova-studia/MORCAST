import { View, Text, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "./tema";

/**
 * CÓMO SE ENSEÑA UNA ACCIÓN QUE NO SALIÓ (apps al 100%, 9-oct-2026). La
 * regla es la misma en todas las pantallas nuevas:
 *
 *   · sin señal (`r.sinRed`): "Sin conexión" y un botón **Reintentar**. No se
 *     sabe si llegó; la persona decide volver a tocar.
 *   · el servidor dijo que no: su `motivo`, tal cual (ya viene escrito para
 *     personas: "Tu rol no incluye esta sección…").
 *
 * `r` es la respuesta `{ ok, motivo, sinRed }`; con `r.ok` no pinta nada.
 * También acepta `texto` suelto (un error de validación de la pantalla).
 */
export default function AvisoResultado({ r, texto, onReintentar, style }) {
  if (!texto && (!r || r.ok)) return null;
  const sinRed = !texto && Boolean(r?.sinRed);
  const mensaje = texto || r?.motivo || "No se pudo. Inténtalo otra vez.";
  return (
    <View style={[s.caja, style]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Feather name={sinRed ? "wifi-off" : "alert-circle"} size={15} color={T.error} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={s.txt}>
          {sinRed ? (
            <>
              <Text style={{ fontWeight: "800" }}>Sin conexión. </Text>
              Revisa tu señal e inténtalo otra vez.
            </>
          ) : mensaje}
        </Text>
        {sinRed && onReintentar ? (
          <Pressable onPress={onReintentar} style={s.btn} accessibilityRole="button" hitSlop={6}>
            <Feather name="refresh-cw" size={14} color={T.tinta} />
            <Text style={s.btnTxt}>Reintentar</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  caja: { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: "rgba(217,119,107,0.10)", borderWidth: 1, borderColor: "rgba(217,119,107,0.35)", borderRadius: 10, padding: 11, marginTop: 10 },
  txt: { color: T.tinta, fontSize: 13, lineHeight: 18 },
  btn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, borderColor: T.linea, backgroundColor: T.panel, minHeight: 40 },
  btnTxt: { color: T.tinta, fontSize: 13, fontWeight: "700" },
});
