import { View, Text, Pressable, StyleSheet } from "react-native";
import { T, BADGE, radio } from "./tema";
import { Feather } from "@expo/vector-icons";
import { enHold, HOLD } from "./estado-sistema";

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

/**
 * Botón. La variante por defecto es la ACCIÓN principal (azul).
 *
 * 🔴 El texto de encima NO es siempre el mismo, y antes sí lo era: todas las
 * variantes escribían en `#0d1211`. Sobre el relleno de acción eso da 3.26:1
 * y no alcanza; sobre el naranja del modo chofer, en cambio, el casi negro
 * es lo correcto (5.32:1) y el blanco fallaría (3.55:1). O sea que cada
 * relleno pide su propia tinta, y por eso esto es una tabla y no una
 * constante.
 */
const TINTA_BOTON = {
  verde: "#fff",      // sobre la acción azul: 5.80:1
  naranja: "#0d1211", // sobre el naranja de campo: 5.32:1
  teal: "#0d1211",    // sobre el azul claro de tinta: pasa holgado
};

export function Boton({ children, onPress, variante = "verde", disabled, style }) {
  const fondo =
    variante === "verde" ? T.accion :
    variante === "naranja" ? T.naranja :
    variante === "teal" ? T.tealClaro :
    "transparent";
  const borde = variante === "linea" ? T.linea : "transparent";
  const color = variante === "linea" ? T.tinta : (TINTA_BOTON[variante] || "#fff");
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

/**
 * La banda de "sistema en preparación".
 *
 * Va en toda pantalla del CLIENTE donde antes salía una cifra y ahora sale un
 * guion. Sin ella el guion no se entiende: parece que la app falló o que la
 * cuenta está vacía, cuando lo que pasa es que Morcast todavía no cobra.
 * La web la tiene desde el 1-sep; aquí faltaba.
 *
 * No se pinta nada si el Hold está apagado.
 */
export function AvisoHold({ style }) {
  if (!enHold()) return null;
  return (
    <View style={[s.hold, style]}>
      <Feather name="alert-triangle" size={15} color={T.alerta} />
      <Text style={s.holdTxt}>
        <Text style={{ fontWeight: "700" }}>{HOLD.titulo}. </Text>
        {HOLD.motivo}
      </Text>
    </View>
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
  hold: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "rgba(214,164,74,0.12)",
    borderWidth: 1, borderColor: "rgba(214,164,74,0.38)",
    borderRadius: 10, padding: 11, marginBottom: 14,
  },
  holdTxt: { flex: 1, color: T.alerta, fontSize: 12.5, lineHeight: 18 },
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
