import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../tema";
import { Tarjeta, Boton } from "../ui";
import { CLIENTE } from "../datos";

const MENU = [
  { pantalla: "Cobertura", icono: "map", titulo: "Cobertura", sub: "¿Pasamos por tu zona?", color: "#7cc576" },
  { pantalla: "Agendar", icono: "calendar", titulo: "Agendar recolección", sub: "Pide tu servicio del día de tu ruta", color: "#4eb34a" },
  { pantalla: "Reportes", icono: "bar-chart-2", titulo: "Reportes", sub: "Volumen y monto por periodo", color: "#4fc0c5" },
  { pantalla: "Documentos", icono: "file-text", titulo: "Documentos", sub: "Constancia fiscal y manifiestos", color: "#6fce69" },
  { pantalla: "Cotizador", icono: "file-plus", titulo: "Cotizador", sub: "Arma y descarga una cotización", color: "#f0895c" },
];

export default function Mas({ navigation, onLogout }) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.fondo }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text style={s.h1}>Más</Text>
      <Text style={s.sub}>Tu cuenta y más opciones.</Text>

      {/* Perfil */}
      <Tarjeta>
        <View style={s.perfil}>
          <View style={s.avatar}><Text style={s.avatarTxt}>{iniciales(CLIENTE.empresa)}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.empresa}>{CLIENTE.empresa}</Text>
            <Text style={s.dato}>{CLIENTE.id}</Text>
          </View>
        </View>
        <Info icono="user" v={CLIENTE.contacto} />
        <Info icono="mail" v={CLIENTE.correo} />
        <Info icono="phone" v={CLIENTE.telefono} />
        <Info icono="briefcase" v={CLIENTE.cuenta} ultimo />
      </Tarjeta>

      {/* Menú */}
      <Tarjeta style={{ padding: 6 }}>
        {MENU.map((m, i) => (
          <Pressable key={m.pantalla} onPress={() => navigation.navigate(m.pantalla)} style={[s.item, i < MENU.length - 1 && s.borde]}>
            <View style={[s.ico, { backgroundColor: m.color + "22" }]}><Feather name={m.icono} size={18} color={m.color} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.itemTit}>{m.titulo}</Text>
              <Text style={s.itemSub}>{m.sub}</Text>
            </View>
            <Feather name="chevron-right" size={20} color={T.gris} />
          </Pressable>
        ))}
      </Tarjeta>

      <Boton variante="linea" onPress={onLogout} style={{ marginTop: 4 }}>
        <Feather name="log-out" size={16} color={T.tinta} />
        <Text style={{ color: T.tinta, fontWeight: "700" }}>  Cerrar sesión</Text>
      </Boton>

      <Text style={s.version}>Morcast del Norte · App v1.0 (demo)</Text>
    </ScrollView>
  );
}

function Info({ icono, v, ultimo }) {
  return (
    <View style={[s.infoFila, !ultimo && { borderBottomWidth: 1, borderBottomColor: T.linea }]}>
      <Feather name={icono} size={15} color={T.gris} />
      <Text style={s.infoTxt}>{v}</Text>
    </View>
  );
}

function iniciales(nombre) {
  return nombre.replace(/[^A-Za-zÁÉÍÓÚÑ ]/g, "").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

const s = StyleSheet.create({
  h1: { color: T.tinta, fontSize: 22, fontWeight: "800" },
  sub: { color: T.gris, fontSize: 13.5, marginTop: 3, marginBottom: 14 },
  perfil: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  avatar: { width: 46, height: 46, borderRadius: 12, backgroundColor: T.verde, alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: "#0d1211", fontWeight: "800", fontSize: 16 },
  empresa: { color: T.tinta, fontSize: 15, fontWeight: "700" },
  dato: { color: T.gris, fontSize: 12.5, marginTop: 2 },
  infoFila: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  infoTxt: { color: T.tinta, fontSize: 13.5, flex: 1 },
  item: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  borde: { borderBottomWidth: 1, borderBottomColor: T.linea },
  ico: { width: 40, height: 40, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  itemTit: { color: T.tinta, fontSize: 14.5, fontWeight: "700" },
  itemSub: { color: T.gris, fontSize: 12, marginTop: 2 },
  version: { color: T.grisClaro, fontSize: 11.5, textAlign: "center", marginTop: 18 },
});
