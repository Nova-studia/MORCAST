import { View, Text, Pressable, StyleSheet } from "react-native";
import { T, BADGE, radio } from "./tema";

export function Tarjeta({ children, style }) {
  return <View style={[s.tarjeta, style]}>{children}</View>;
}

export function TituloTarjeta({ children, derecha }) {
  return (
    <View style={s.tituloFila}>
      <Text style={s.tituloTarjeta}>{children}</Text>
      {derecha}
    </View>
  );
}

export function Badge({ clase = "none", children }) {
  const c = BADGE[clase] || BADGE.none;
  return (
    <View style={[s.badge, { backgroundColor: c.bg }]}>
      <View style={[s.punto, { backgroundColor: c.fg }]} />
      <Text style={[s.badgeTxt, { color: c.fg }]}>{children}</Text>
    </View>
  );
}

export function Boton({ children, onPress, variante = "verde", disabled, style }) {
  const fondo =
    variante === "verde" ? T.verde :
    variante === "naranja" ? T.naranja :
    variante === "teal" ? T.tealClaro :
    "transparent";
  const borde = variante === "linea" ? T.linea : "transparent";
  const color = variante === "linea" ? T.tinta : "#0d1211";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.boton,
        { backgroundColor: fondo, borderColor: borde, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      <Text style={[s.botonTxt, { color: variante === "linea" ? T.tinta : color }]}>{children}</Text>
    </Pressable>
  );
}

export function EncabezadoPantalla({ titulo, sub }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.h1}>{titulo}</Text>
      {sub ? <Text style={s.sub}>{sub}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  tarjeta: {
    backgroundColor: T.panel,
    borderRadius: radio,
    borderWidth: 1,
    borderColor: T.linea,
    padding: 16,
    marginBottom: 14,
  },
  tituloFila: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  tituloTarjeta: { color: T.tinta, fontSize: 15, fontWeight: "700" },
  badge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, gap: 6 },
  punto: { width: 6, height: 6, borderRadius: 3 },
  badgeTxt: { fontSize: 11.5, fontWeight: "700" },
  boton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, paddingHorizontal: 18, borderRadius: 11, borderWidth: 1 },
  botonTxt: { fontSize: 14.5, fontWeight: "700" },
  h1: { color: T.tinta, fontSize: 22, fontWeight: "800", letterSpacing: -0.3 },
  sub: { color: T.gris, fontSize: 13.5, marginTop: 4, lineHeight: 19 },
});
