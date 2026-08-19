import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../../tema";
import { Tarjeta, Boton } from "../../ui";
import { ADMIN_PERFIL } from "../../datos-admin";

const MENU = [
  { pantalla: "Clientes", icono: "users", titulo: "Clientes", sub: "Cuentas, saldos y alta", color: "#6fce69" },
  { pantalla: "Servicios", icono: "truck", titulo: "Servicios", sub: "Agenda y comprobante del chofer", color: "#4fc0c5" },
  { pantalla: "ReportesAdmin", icono: "bar-chart-2", titulo: "Reportes del negocio", sub: "Ingresos y desempeño", color: "#f0895c" },
  { pantalla: "Usuarios", icono: "shield", titulo: "Usuarios y roles", sub: "Equipo, auxiliares y choferes", color: "#db982d" },
];

export default function MasAdmin({ navigation, onLogout }) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.fondo }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text style={s.h1}>Más</Text>
      <Text style={s.sub}>Administración y sesión.</Text>

      <Tarjeta>
        <View style={s.perfil}>
          <View style={s.avatar}><Text style={s.avatarTxt}>RC</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.nombre}>{ADMIN_PERFIL.nombre}</Text>
            <Text style={s.rol}>{ADMIN_PERFIL.rol} · {ADMIN_PERFIL.correo}</Text>
          </View>
        </View>
      </Tarjeta>

      <Tarjeta style={{ padding: 6 }}>
        {MENU.map((m, i) => (
          <Pressable key={m.pantalla} onPress={() => navigation.navigate(m.pantalla)} style={[s.item, i < MENU.length - 1 && s.borde]}>
            <View style={[s.ico, { backgroundColor: m.color + "22" }]}><Feather name={m.icono} size={18} color={m.color} /></View>
            <View style={{ flex: 1 }}><Text style={s.itemTit}>{m.titulo}</Text><Text style={s.itemSub}>{m.sub}</Text></View>
            <Feather name="chevron-right" size={20} color={T.gris} />
          </Pressable>
        ))}
      </Tarjeta>

      <Boton variante="linea" onPress={onLogout} style={{ marginTop: 4 }}>
        <Feather name="log-out" size={16} color={T.tinta} />
        <Text style={{ color: T.tinta, fontWeight: "700" }}>  Cerrar sesión</Text>
      </Boton>

      <Text style={s.version}>Morcast del Norte · Admin v1.0 (demo)</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  h1: { color: T.tinta, fontSize: 22, fontWeight: "800" },
  sub: { color: T.gris, fontSize: 13.5, marginTop: 3, marginBottom: 14 },
  perfil: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 12, backgroundColor: T.naranja, alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: "#0d1211", fontWeight: "800", fontSize: 16 },
  nombre: { color: T.tinta, fontSize: 15, fontWeight: "700" },
  rol: { color: T.gris, fontSize: 12.5, marginTop: 2 },
  item: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  borde: { borderBottomWidth: 1, borderBottomColor: T.linea },
  ico: { width: 40, height: 40, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  itemTit: { color: T.tinta, fontSize: 14.5, fontWeight: "700" },
  itemSub: { color: T.gris, fontSize: 12, marginTop: 2 },
  version: { color: T.grisClaro, fontSize: 11.5, textAlign: "center", marginTop: 18 },
});
