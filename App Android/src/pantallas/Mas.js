import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Alert, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../tema";
import { Tarjeta } from "../ui";
import { IconoMenu } from "../iconos-menu";
import { useMiEmpresa } from "../mi-empresa";
import { haySupabase } from "../supabase";
import { VERSION_APP } from "../version";
import { HAY_DATOS_FISCALES } from "../datos";
import { eliminarMiCuenta } from "../eliminar-cuenta";
import { BandaSuspendido } from "../TarjetaSoporte";

// Cada entrada lleva el MISMO dibujo que en el menú del portal web
// (`PortalShell.js`): `dibujo` es el nombre del archivo allá. Antes eran
// iconos de línea en un cuadrito de color; los dibujos ya traen sus colores
// y se distinguen solos, así que van sin cuadro (igual que en la web).
const MENU = [
  // Apps al 100% (9-oct-2026): sus datos, los de su empresa, sus puntos,
  // su contraseña y soporte, como /portal/cuenta.
  { pantalla: "MiCuenta", dibujo: "usuarios-y-roles", titulo: "Mi cuenta", sub: "Tus datos, tu empresa, tus puntos y tu contraseña" },
  { pantalla: "Cobertura", dibujo: "cobertura", titulo: "Cobertura", sub: "¿Pasamos por tu zona?" },
  { pantalla: "Agendar", dibujo: "agendar", titulo: "Agendar recolección", sub: "Pide tu servicio del día de tu ruta" },
  { pantalla: "Reportes", dibujo: "reportes", titulo: "Reportes", sub: "Peso recolectado por periodo" },
  // Sin el RFC real de Morcast no hay constancia que ofrecer (ver Documentos.js).
  { pantalla: "Documentos", dibujo: "documentos", titulo: "Documentos", sub: HAY_DATOS_FISCALES ? "Constancia fiscal y manifiestos" : "Manifiestos de tus servicios" },
  { pantalla: "Cotizador", dibujo: "cotizar", titulo: "Cotizador", sub: "Arma y descarga una cotización" },
];

export default function Mas({ navigation, onLogout }) {
  // Los datos son los de SU empresa. Antes esta tarjeta enseñaba una de
  // ejemplo, la misma para todos los que entraran.
  const { empresa: cliente } = useMiEmpresa();
  const [eliminando, setEliminando] = useState(false);

  /**
   * ELIMINAR MI CUENTA (guía 5.1.1(v) de Apple): se inicia aquí, se confirma
   * con un diálogo que dice qué se borra y qué se conserva, y se borra de
   * verdad en el servidor (ver `eliminar-cuenta.js`). Esta pantalla sólo la
   * ve el rol cliente: el personal y los choferes tienen su propio menú, y a
   * ellos los da de baja Morcast desde el panel.
   */
  const eliminar = async () => {
    if (eliminando) return;
    setEliminando(true);
    const r = await eliminarMiCuenta();
    if (!r.ok) {
      setEliminando(false);
      Alert.alert("No se eliminó tu cuenta", r.mensaje);
      return;
    }
    // Primero se cierra la sesión (la app vuelve al inicio) y luego se avisa,
    // para que el mensaje quede sobre la pantalla de entrada y no sobre una
    // cuenta que ya no existe.
    try { await onLogout(); } catch { /* la sesión local ya no sirve de nada */ }
    Alert.alert(
      "Cuenta eliminada",
      "Tu cuenta de Morcast se eliminó y ya no podrás entrar con ese correo. Gracias por usar la app."
    );
  };

  const confirmarEliminar = () =>
    Alert.alert(
      "¿Eliminar tu cuenta?",
      "Se borrará tu acceso a Morcast: tu usuario, tu contraseña y tu perfil. " +
        "Ya no podrás entrar con este correo ni en la app ni en morcast.mx.\n\n" +
        "Por obligación legal, fiscal y ambiental, Morcast conserva el historial de " +
        "servicios de tu empresa, los manifiestos de residuos y los comprobantes de pago. " +
        "Tu empresa sigue siendo cliente: para cancelar el contrato, escríbenos.\n\n" +
        "Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Eliminar cuenta", style: "destructive", onPress: eliminar },
      ]
    );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.fondo }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      {/* Cuenta suspendida (apps al 100%): la banda roja, arriba de todo. */}
      <BandaSuspendido />
      <Text style={s.h1}>Más</Text>
      <Text style={s.sub}>Tu cuenta y más opciones.</Text>

      {/* Perfil */}
      <Tarjeta>
        <View style={s.perfil}>
          <View style={s.avatar}><Text style={s.avatarTxt}>{iniciales(cliente.empresa)}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.empresa}>{cliente.empresa}</Text>
            <Text style={s.dato}>{cliente.id}</Text>
          </View>
        </View>
        <Info icono="user" v={cliente.contacto} />
        <Info icono="mail" v={cliente.correo} />
        <Info icono="phone" v={cliente.telefono} />
        <Info icono="briefcase" v={cliente.cuenta} ultimo />
      </Tarjeta>

      {/* Menú */}
      <Tarjeta style={{ padding: 6 }}>
        {MENU.map((m, i) => (
          <Pressable key={m.pantalla} onPress={() => navigation.navigate(m.pantalla)} style={[s.item, i < MENU.length - 1 && s.borde]}>
            {/* Como en la web: quieto va un poco apagado y a color pleno
                mientras el dedo lo tiene presionado. */}
            {({ pressed }) => (
              <>
                <View style={s.ico}><IconoMenu nombre={m.dibujo} activo={pressed} tam={32} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.itemTit}>{m.titulo}</Text>
                  <Text style={s.itemSub}>{m.sub}</Text>
                </View>
                <Feather name="chevron-right" size={20} color={T.gris} />
              </>
            )}
          </Pressable>
        ))}
      </Tarjeta>

      {/* El mismo dibujo de "Cerrar sesión" del menú web. */}
      <Pressable
        onPress={onLogout}
        disabled={eliminando}
        accessibilityRole="button"
        style={({ pressed }) => [s.salir, { marginTop: 4, opacity: eliminando ? 0.5 : pressed ? 0.85 : 1 }]}
      >
        <IconoMenu nombre="cerra-sesion" tam={24} />
        <Text style={s.salirTxt}>Cerrar sesión</Text>
      </Pressable>

      {/* Discreto a propósito (texto en rojo, sin relleno): es una salida
          para quien la busca, no una invitación. */}
      <Pressable
        onPress={confirmarEliminar}
        disabled={eliminando}
        accessibilityRole="button"
        style={({ pressed }) => [s.eliminar, { opacity: eliminando ? 0.6 : pressed ? 0.7 : 1 }]}
      >
        {eliminando
          ? <ActivityIndicator size="small" color={T.error} />
          : <Feather name="trash-2" size={15} color={T.error} />}
        <Text style={s.eliminarTxt}>{eliminando ? "Eliminando tu cuenta…" : "Eliminar mi cuenta"}</Text>
      </Pressable>

      {/* "(demo)" solo sin base. Con la base real lo decía igual, y le hacía
          creer al cliente que nada de lo que veía era de verdad. */}
      <Text style={s.version}>Morcast del Norte · App v{VERSION_APP}{haySupabase() ? "" : " (demo)"}</Text>
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
  // El avatar es MARCA, no una accion: no se pulsa. Va el verde.
  avatar: { width: 46, height: 46, borderRadius: 12, backgroundColor: T.verdeMarca, alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: "#fff", fontWeight: "800", fontSize: 16 },
  empresa: { color: T.tinta, fontSize: 15, fontWeight: "700" },
  dato: { color: T.gris, fontSize: 12.5, marginTop: 2 },
  infoFila: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  infoTxt: { color: T.tinta, fontSize: 13.5, flex: 1 },
  item: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  borde: { borderBottomWidth: 1, borderBottomColor: T.linea },
  ico: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  // Mismo trazo que <Boton variante="linea">, pero armado aquí: el Boton
  // mete a sus hijos dentro de un <Text>, y un dibujo (<Image>) ahí adentro
  // se alinea distinto en cada sistema.
  salir: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 11, borderWidth: 1, borderColor: T.linea, minHeight: 48 },
  salirTxt: { color: T.tinta, fontSize: 14.5, fontWeight: "700" },
  itemTit: { color: T.tinta, fontSize: 14.5, fontWeight: "700" },
  itemSub: { color: T.gris, fontSize: 12, marginTop: 2 },
  eliminar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, marginTop: 8, minHeight: 44 },
  eliminarTxt: { color: T.error, fontSize: 14, fontWeight: "700" },
  version: { color: T.grisClaro, fontSize: 11.5, textAlign: "center", marginTop: 18 },
});
