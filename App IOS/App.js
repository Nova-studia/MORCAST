import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { T } from "./src/tema";
// Cliente
import Login from "./src/pantallas/Login";
import Inicio from "./src/pantallas/Inicio";
import Historial from "./src/pantallas/Historial";
import AgregarSaldo from "./src/pantallas/AgregarSaldo";
import Mas from "./src/pantallas/Mas";
import Reportes from "./src/pantallas/Reportes";
import Documentos from "./src/pantallas/Documentos";
import Cotizador from "./src/pantallas/Cotizador";
import Cobertura from "./src/pantallas/Cobertura";
import Agendar from "./src/pantallas/Agendar";
// Chofer
import LoginChofer from "./src/pantallas/chofer/LoginChofer";
import RutaChofer from "./src/pantallas/chofer/RutaChofer";
import Recoleccion from "./src/pantallas/chofer/Recoleccion";
import { RUTA_HOY } from "./src/datos-chofer";
import { rutaDelDia, cerrarRecoleccion } from "./src/datos-remoto";
import { sesionActiva, salir as salirDeSesion } from "./src/sesion";
import { haySupabase } from "./src/supabase";
// Admin
import LoginAdmin from "./src/pantallas/admin/LoginAdmin";
import PanelAdmin from "./src/pantallas/admin/PanelAdmin";
import Solicitudes from "./src/pantallas/admin/Solicitudes";
import Saldos from "./src/pantallas/admin/Saldos";
import Servicios from "./src/pantallas/admin/Servicios";
import Clientes from "./src/pantallas/admin/Clientes";
import ReportesAdmin from "./src/pantallas/admin/ReportesAdmin";
import Usuarios from "./src/pantallas/admin/Usuarios";
import MasAdmin from "./src/pantallas/admin/MasAdmin";

const Tab = createBottomTabNavigator();
const AdminTab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const AuthStack = createNativeStackNavigator();

const temaNav = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: T.fondo, card: T.panel, text: T.tinta, border: T.linea, primary: T.verde },
};

const tabBar = (color, insets) => ({
  tabBarInactiveTintColor: T.gris,
  tabBarActiveTintColor: color,
  tabBarStyle: {
    backgroundColor: T.panel,
    borderTopColor: T.linea,
    height: 60 + (insets?.bottom || 0),      // respeta el home indicator de iOS
    paddingBottom: 8 + (insets?.bottom || 0),
    paddingTop: 6,
  },
  tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
  headerShown: false,
});

/* ---------- Autenticación ---------- */
function AuthFlow({ onCliente, onAdmin, onChofer }) {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: T.fondo } }}>
      <AuthStack.Screen name="LoginCliente">
        {(props) => <Login {...props} onLogin={onCliente} />}
      </AuthStack.Screen>
      <AuthStack.Screen name="LoginAdmin">
        {(props) => <LoginAdmin {...props} onLogin={onAdmin} />}
      </AuthStack.Screen>
      <AuthStack.Screen name="LoginChofer">
        {(props) => <LoginChofer {...props} onLogin={onChofer} />}
      </AuthStack.Screen>
    </AuthStack.Navigator>
  );
}

/* ---------- Chofer ---------- */
function AppChofer({ onLogout }) {
  const [ruta, setRuta] = useState(haySupabase() ? [] : RUTA_HOY);

  const recargarRuta = () =>
    rutaDelDia().then((paradas) => {
      // Si no hay base configurada se queda la ruta de ejemplo, para que la
      // pantalla no salga vacia en modo demostracion.
      if (haySupabase()) setRuta(paradas);
    });

  useEffect(() => {
    let vivo = true;
    recargarRuta().then(() => { if (!vivo) return; });
    return () => { vivo = false; };
  }, []);

  /**
   * Cierra la parada contra la base: sube las fotos, guarda la evidencia y
   * marca el servicio como completado. Devuelve { ok } para que la pantalla
   * sepa si de verdad quedo guardado antes de cantar victoria.
   */
  const completar = async (parada, datos) => {
    if (!haySupabase()) {
      setRuta((r) => r.map((sv) => (sv.folio === parada.folio ? { ...sv, estatus: "completado", evidencia: datos } : sv)));
      return { ok: true, demo: true };
    }

    const r = await cerrarRecoleccion({
      solicitudId: parada.id,
      qr: datos.qr,
      pesoKg: datos.pesoKg,
      uriAntes: datos.antes,
      uriDespues: datos.despues,
      rutaAntes: datos.rutaAntes,
      rutaDespues: datos.rutaDespues,
    });
    if (r.ok) await recargarRuta();
    return r;
  };
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: T.panel }, headerTintColor: T.tealClaro, headerTitleStyle: { fontWeight: "700", color: T.tinta }, headerShadowVisible: false, contentStyle: { backgroundColor: T.fondo } }}>
      <Stack.Screen name="Ruta" options={{ headerShown: false }}>
        {(props) => <RutaChofer {...props} ruta={ruta} onLogout={onLogout} />}
      </Stack.Screen>
      <Stack.Screen name="Recoleccion" options={{ title: "Recolección" }}>
        {(props) => <Recoleccion {...props} completar={completar} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

/* ---------- Cliente ---------- */
const ICONOS_CLI = { Inicio: "home", Historial: "clock", Saldo: "plus-circle", Mas: "grid" };

function TabsCliente({ onLogout }) {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.fondo }} edges={["top"]}>
      <Tab.Navigator screenOptions={({ route }) => ({ ...tabBar(T.verde, insets), tabBarIcon: ({ color, size }) => <Feather name={ICONOS_CLI[route.name]} size={size - 2} color={color} /> })}>
        <Tab.Screen name="Inicio" component={Inicio} />
        <Tab.Screen name="Historial" component={Historial} />
        <Tab.Screen name="Saldo" component={AgregarSaldo} options={{ title: "Saldo" }} />
        <Tab.Screen name="Mas" options={{ title: "Más" }}>
          {(props) => <Mas {...props} onLogout={onLogout} />}
        </Tab.Screen>
      </Tab.Navigator>
    </SafeAreaView>
  );
}

function AppCliente({ onLogout }) {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: T.panel }, headerTintColor: T.tinta, headerTitleStyle: { fontWeight: "700" }, headerShadowVisible: false, contentStyle: { backgroundColor: T.fondo } }}>
      <Stack.Screen name="TabsCliente" options={{ headerShown: false }}>
        {(props) => <TabsCliente {...props} onLogout={onLogout} />}
      </Stack.Screen>
      <Stack.Screen name="Reportes" component={Reportes} options={{ title: "Reportes" }} />
      <Stack.Screen name="Documentos" component={Documentos} options={{ title: "Documentos" }} />
      <Stack.Screen name="Cotizador" component={Cotizador} options={{ title: "Cotizador" }} />
      <Stack.Screen name="Cobertura" component={Cobertura} options={{ title: "Cobertura" }} />
      <Stack.Screen name="Agendar" component={Agendar} options={{ title: "Agendar" }} />
    </Stack.Navigator>
  );
}

/* ---------- Admin ---------- */
const ICONOS_ADM = { Panel: "grid", Solicitudes: "inbox", Saldos: "dollar-sign", MasA: "menu" };

function TabsAdmin({ onLogout }) {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.fondo }} edges={["top"]}>
      <AdminTab.Navigator screenOptions={({ route }) => ({ ...tabBar(T.naranja, insets), tabBarIcon: ({ color, size }) => <Feather name={ICONOS_ADM[route.name]} size={size - 2} color={color} /> })}>
        <AdminTab.Screen name="Panel" component={PanelAdmin} />
        <AdminTab.Screen name="Solicitudes" component={Solicitudes} />
        <AdminTab.Screen name="Saldos" component={Saldos} />
        <AdminTab.Screen name="MasA" options={{ title: "Más" }}>
          {(props) => <MasAdmin {...props} onLogout={onLogout} />}
        </AdminTab.Screen>
      </AdminTab.Navigator>
    </SafeAreaView>
  );
}

function AppAdmin({ onLogout }) {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: T.panel }, headerTintColor: T.naranjaClaro, headerTitleStyle: { fontWeight: "700", color: T.tinta }, headerShadowVisible: false, contentStyle: { backgroundColor: T.fondo } }}>
      <Stack.Screen name="TabsAdmin" options={{ headerShown: false }}>
        {(props) => <TabsAdmin {...props} onLogout={onLogout} />}
      </Stack.Screen>
      <Stack.Screen name="Clientes" component={Clientes} options={{ title: "Clientes" }} />
      <Stack.Screen name="Servicios" component={Servicios} options={{ title: "Servicios" }} />
      <Stack.Screen name="ReportesAdmin" component={ReportesAdmin} options={{ title: "Reportes" }} />
      <Stack.Screen name="Usuarios" component={Usuarios} options={{ title: "Usuarios y roles" }} />
    </Stack.Navigator>
  );
}

export default function App() {
  const [sesion, setSesion] = useState(null); // null | "cliente" | "admin" | "chofer"
  const [revisando, setRevisando] = useState(true);

  /**
   * Al abrir la app se busca una sesión guardada y se entra directo.
   *
   * Supabase ya guardaba la sesión en el teléfono, pero la app nunca la
   * consultaba al arrancar: por eso pedía la contraseña cada vez aunque
   * siguiera vigente.
   *
   * Se prueban los tres modos porque la sesión guardada no dice a qué
   * pantalla pertenece; el rol lo decide `sesionActiva`.
   */
  useEffect(() => {
    let vivo = true;
    (async () => {
      for (const modo of ["admin", "chofer", "cliente"]) {
        const p = await sesionActiva(modo);
        if (p) {
          if (vivo) setSesion(modo);
          break;
        }
      }
      if (vivo) setRevisando(false);
    })();
    return () => { vivo = false; };
  }, []);

  const salir = async () => {
    await salirDeSesion();
    setSesion(null);
  };

  // Pantalla en el color del tema mientras se revisa, para que no parpadee el
  // login un instante antes de entrar.
  if (revisando) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <View style={{ flex: 1, backgroundColor: T.fondo }} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer theme={temaNav}>
        {sesion === "admin" ? (
          <AppAdmin onLogout={salir} />
        ) : sesion === "chofer" ? (
          <AppChofer onLogout={salir} />
        ) : sesion === "cliente" ? (
          <AppCliente onLogout={salir} />
        ) : (
          <SafeAreaView style={{ flex: 1, backgroundColor: T.fondo }} edges={["top"]}>
            <AuthFlow onCliente={() => setSesion("cliente")} onAdmin={() => setSesion("admin")} onChofer={() => setSesion("chofer")} />
          </SafeAreaView>
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
