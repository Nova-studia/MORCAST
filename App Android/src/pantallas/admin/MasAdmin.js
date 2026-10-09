import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../../tema";
import { Tarjeta } from "../../ui";
import { IconoMenu } from "../../iconos-menu";
import { usePerfilSesion, iniciales } from "../../mi-perfil";
import { haySupabase } from "../../supabase";
import { VERSION_APP } from "../../version";
import { useMisPermisos } from "../../mis-permisos";
import { pantallasVisibles } from "../../permisos-app.mjs";
import { herramientasVisibles } from "../../puente-admin.mjs";
import { abrirPanelWeb } from "../../datos-rutas-admin";
import AvisoResultado from "../../AvisoResultado";

// Ver la nota del mismo menu del cliente (`pantallas/Mas.js`). Los dibujos
// son los del menú de la administración web (`AdminShell.js`).
// Los subtitulos dicen lo que la pantalla hace CON la base: el alta de
// clientes y los auxiliares solo existen en el modo de demostracion.
const MENU = [
  // equipo 1: la operación del día desde el teléfono (6-oct-2026).
  { pantalla: "Recolecciones", dibujo: "programados", titulo: "Recolecciones", sub: "Confirmar, reagendar y asignar chofer" },
  { pantalla: "Incidentes", dibujo: "incidentes", titulo: "Incidentes", sub: "Lo que reporta el chofer desde la calle" },
  { pantalla: "Clientes", dibujo: "clientes", titulo: "Clientes", sub: "Altas, acceso al portal y sectores" },
  { pantalla: "Servicios", dibujo: "servicios", titulo: "Servicios", sub: "Agenda y comprobante del chofer" },
  { pantalla: "ReportesAdmin", dibujo: "reportes", titulo: "Reportes del negocio", sub: "Ingresos y desempeño" },
  { pantalla: "Usuarios", dibujo: "usuarios-y-roles", titulo: "Usuarios y roles", sub: "Invitar, activar y desactivar" },
  // equipo 2: comunicación y cobranza (6-oct-2026)
  { pantalla: "AvisosAdmin", dibujo: "avisos-a-clientes", titulo: "Avisos a clientes", sub: "Retrasos, reagendas y avisos generales" },
  { pantalla: "BitacoraAdmin", dibujo: "documentos", titulo: "Bitácora", sub: "Quién hizo qué y cuándo, por día" },
  // equipo 3: cuentas y catálogo (6-oct-2026)
  { pantalla: "Altas", dibujo: "altas-de-clientes", titulo: "Altas de clientes", sub: "Activar cuentas y ver el alta firmada" },
  { pantalla: "Puntos", dibujo: "cobertura", titulo: "Puntos de recolección", sub: "Ubicación, referencias y ruta" },
  // Apps al 100% (9-oct-2026): el chofer de cada ruta.
  { pantalla: "Rutas", dibujo: "servicios", titulo: "Rutas", sub: "Quién maneja cada ruta" },
  { pantalla: "ZonasPedidas", dibujo: "zonas-pedidas", titulo: "Zonas pedidas", sub: "Fuera de cobertura" },
  { pantalla: "Unidades", dibujo: "unidades", titulo: "Unidades", sub: "Camiones: activa, taller o baja" },
  // De todo el personal: nombre, teléfono y contraseña.
  { pantalla: "MiCuenta", dibujo: "usuarios-y-roles", titulo: "Mi cuenta", sub: "Tu nombre, tu teléfono y tu contraseña" },
];

export default function MasAdmin({ navigation, onLogout }) {
  // Quien entró, no un perfil de ejemplo. Esta tarjeta saludaba a
  // "Ing. Ramón Cázares · admin@morcast.mx" entrara quien entrara.
  const { perfil, cargando } = usePerfilSesion("admin");
  const nombre = perfil?.nombre || (cargando ? "Leyendo tu sesión…" : "Sin sesión");
  const linea = perfil ? [perfil.rol, perfil.correo].filter(Boolean).join(" · ") : " ";

  // Apps al 100%: solo las secciones del rol (mis-permisos, al pasar el
  // segundo paso). Mientras no llegan, solo lo que no pide sección.
  const { yo, estado, reintentar } = useMisPermisos();
  const menu = MENU.filter((m) => pantallasVisibles(yo, [m.pantalla]).length);
  const herramientas = herramientasVisibles(yo);
  const [abriendo, setAbriendo] = useState("");
  const [resWeb, setResWeb] = useState(null);
  const abrirWeb = async (h) => {
    if (abriendo) return;
    setAbriendo(h.id);
    setResWeb(null);
    const r = await abrirPanelWeb(h.destino);
    setAbriendo("");
    if (!r.ok) setResWeb({ ...r, reintentar: () => abrirWeb(h) });
  };

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
            {yo?.rol === "admin" && <Text style={s.rol} numberOfLines={1}>Rol: {yo.rolNombre || "sin rol (solo el Panel)"}</Text>}
          </View>
        </View>
      </Tarjeta>

      {estado === "sinRed" && !yo && (
        <AvisoResultado r={{ ok: false, sinRed: true }} onReintentar={reintentar} style={{ marginTop: 0, marginBottom: 12 }} />
      )}
      {estado === "cargando" && !yo && <Text style={[s.sub, { marginTop: 0 }]}>Leyendo las secciones de tu rol…</Text>}

      <Tarjeta style={{ padding: 6 }}>
        {menu.map((m, i) => (
          <Pressable key={m.pantalla} onPress={() => navigation.navigate(m.pantalla, m.pantalla === "MiCuenta" ? { modo: "admin" } : undefined)} style={[s.item, i < menu.length - 1 && s.borde]}>
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

      {/* FASE D: lo que en un teléfono no cabe se abre en el panel web, YA
          con la sesión iniciada (enlace de un solo uso, 2 minutos). */}
      {herramientas.length > 0 && (
        <>
          <Text style={s.seccion}>En la web</Text>
          <Tarjeta style={{ padding: 6 }}>
            {herramientas.map((h, i) => (
              <Pressable
                key={h.id}
                onPress={() => abrirWeb(h)}
                disabled={!!abriendo}
                style={({ pressed }) => [s.item, i < herramientas.length - 1 && s.borde, { opacity: pressed ? 0.85 : 1 }]}
                accessibilityRole="link"
                accessibilityLabel={`${h.titulo}, se abre en la web`}
              >
                <View style={s.ico}><Feather name={h.icono} size={22} color={T.accionTxt} /></View>
                <View style={{ flex: 1 }}><Text style={s.itemTit}>{h.titulo}</Text><Text style={s.itemSub}>{h.sub}</Text></View>
                {abriendo === h.id ? <ActivityIndicator size="small" color={T.gris} /> : <Feather name="external-link" size={18} color={T.gris} />}
              </Pressable>
            ))}
          </Tarjeta>
          {resWeb && <AvisoResultado r={resWeb} onReintentar={resWeb.reintentar} style={{ marginTop: -6, marginBottom: 14 }} />}
        </>
      )}

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
  seccion: { color: T.gris, fontSize: 11, letterSpacing: 0.5, marginTop: 4, marginBottom: 8, textTransform: "uppercase", fontWeight: "700" },
});
