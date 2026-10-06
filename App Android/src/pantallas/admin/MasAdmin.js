import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../../tema";
import { Tarjeta } from "../../ui";
import { IconoMenu } from "../../iconos-menu";
import { usePerfilSesion, iniciales } from "../../mi-perfil";
import { haySupabase } from "../../supabase";
import { VERSION_APP } from "../../version";

// Ver la nota del mismo menu del cliente (`pantallas/Mas.js`). Los dibujos
// son los del menú de la administración web (`AdminShell.js`).
// Los subtitulos dicen lo que la pantalla hace CON la base: el alta de
// clientes y los auxiliares solo existen en el modo de demostracion.
const MENU = [
  { pantalla: "Clientes", dibujo: "clientes", titulo: "Clientes", sub: "Altas, acceso al portal y sectores" },
  { pantalla: "Servicios", dibujo: "servicios", titulo: "Servicios", sub: "Agenda y comprobante del chofer" },
  { pantalla: "ReportesAdmin", dibujo: "reportes", titulo: "Reportes del negocio", sub: "Ingresos y desempeño" },
  { pantalla: "Usuarios", dibujo: "usuarios-y-roles", titulo: "Usuarios y roles", sub: "Invitar, activar y desactivar" },
  // equipo 3: cuentas y catálogo (6-oct-2026)
  { pantalla: "Altas", dibujo: "altas-de-clientes", titulo: "Altas de clientes", sub: "Activar cuentas y ver el alta firmada" },
  { pantalla: "Puntos", dibujo: "cobertura", titulo: "Puntos de recolección", sub: "Ubicación, referencias y ruta" },
  { pantalla: "ZonasPedidas", dibujo: "zonas-pedidas", titulo: "Zonas pedidas", sub: "Fuera de cobertura" },
  { pantalla: "Unidades", dibujo: "unidades", titulo: "Unidades", sub: "Camiones: activa, taller o baja" },
];

export default function MasAdmin({ navigation, onLogout }) {
  // Quien entró, no un perfil de ejemplo. Esta tarjeta saludaba a
  // "Ing. Ramón Cázares · admin@morcast.mx" entrara quien entrara.
  const { perfil, cargando } = usePerfilSesion("admin");
  const nombre = perfil?.nombre || (cargando ? "Leyendo tu sesión…" : "Sin sesión");
  const linea = perfil ? [perfil.rol, perfil.correo].filter(Boolean).join(" · ") : " ";

  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.fondo }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text style={s.h1}>Más</Text>
      <Text style={s.sub}>Administración y sesión.</Text>

      <Tarjeta>
        <View style={s.perfil}>
          <View style={s.avatar}><Text style={s.avatarTxt}>{perfil ? iniciales(perfil.nombre) : "·"}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.nombre} numberOfLines={1}>{nombre}</Text>
            <Text style={s.rol} numberOfLines={1}>{linea}</Text>
          </View>
        </View>
      </Tarjeta>

      <Tarjeta style={{ padding: 6 }}>
        {MENU.map((m, i) => (
          <Pressable key={m.pantalla} onPress={() => navigation.navigate(m.pantalla)} style={[s.item, i < MENU.length - 1 && s.borde]}>
            {({ pressed }) => (
              <>
                <View style={s.ico}><IconoMenu nombre={m.dibujo} activo={pressed} tam={32} /></View>
                <View style={{ flex: 1 }}><Text style={s.itemTit}>{m.titulo}</Text><Text style={s.itemSub}>{m.sub}</Text></View>
                <Feather name="chevron-right" size={20} color={T.gris} />
              </>
            )}
          </Pressable>
        ))}
      </Tarjeta>

      <Pressable
        onPress={onLogout}
        accessibilityRole="button"
        style={({ pressed }) => [s.salir, { marginTop: 4, opacity: pressed ? 0.85 : 1 }]}
      >
        <IconoMenu nombre="cerra-sesion" tam={24} />
        <Text style={s.salirTxt}>Cerrar sesión</Text>
      </Pressable>

      <Text style={s.version}>Morcast del Norte · Admin v{VERSION_APP}{haySupabase() ? "" : " (demo)"}</Text>
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
  ico: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  // Ver la nota de `salir` en `pantallas/Mas.js`.
  salir: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 11, borderWidth: 1, borderColor: T.linea, minHeight: 48 },
  salirTxt: { color: T.tinta, fontSize: 14.5, fontWeight: "700" },
  itemTit: { color: T.tinta, fontSize: 14.5, fontWeight: "700" },
  itemSub: { color: T.gris, fontSize: 12, marginTop: 2 },
  version: { color: T.grisClaro, fontSize: 11.5, textAlign: "center", marginTop: 18 },
});
