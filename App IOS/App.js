import { useCallback, useEffect, useRef, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { View, Text, ActivityIndicator } from "react-native";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { NavigationContainer, DefaultTheme, useNavigationContainerRef } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { T } from "./src/tema";
import { IconoMenu } from "./src/iconos-menu";
// Cliente
import Login from "./src/pantallas/Login";
import AltaPendiente from "./src/pantallas/AltaPendiente";
import Inicio from "./src/pantallas/Inicio";
import Historial from "./src/pantallas/Historial";
import AgregarSaldo from "./src/pantallas/AgregarSaldo";
import Mas from "./src/pantallas/Mas";
import Reportes from "./src/pantallas/Reportes";
import Documentos from "./src/pantallas/Documentos";
import Cotizador from "./src/pantallas/Cotizador";
import Cobertura from "./src/pantallas/Cobertura";
import Agendar from "./src/pantallas/Agendar";
// Explorar sin cuenta
import Explorar from "./src/pantallas/explorar/Explorar";
import CotizarWhatsApp from "./src/pantallas/explorar/CotizarWhatsApp";
import CoberturaPublica from "./src/pantallas/explorar/CoberturaPublica";
// Chofer
import LoginChofer from "./src/pantallas/chofer/LoginChofer";
import RutaChofer from "./src/pantallas/chofer/RutaChofer";
import Recoleccion from "./src/pantallas/chofer/Recoleccion";
import NoProcedio from "./src/pantallas/chofer/NoProcedio";
import ReportarProblema from "./src/pantallas/chofer/ReportarProblema";
import { RUTA_HOY } from "./src/datos-chofer";
import { rutaDelDia, cerrarRecoleccion, avisarParada } from "./src/datos-remoto";
import { sesionActiva, sesionPendiente, salir as salirDeSesion } from "./src/sesion";
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
import SegundoPaso from "./src/pantallas/admin/SegundoPaso";
// Notificaciones (1.1)
import PermisoNotificaciones from "./src/PermisoNotificaciones";
import { datosDeLaUltimaNotificacion, alTocarNotificacion } from "./src/notificaciones";
import { destinoDeNotificacion } from "./src/push-destino.mjs";

const Tab = createBottomTabNavigator();
const AdminTab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const AuthStack = createNativeStackNavigator();

// En iPhone el botón de regresar lleva el título de la pantalla anterior, y
// las pestañas (TabsCliente, TabsAdmin, Ruta) no tienen uno visible: salía su
// nombre interno, "TabsCliente". Por eso las tres pilas fijan `headerBackTitle`.
const temaNav = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: T.fondo, card: T.panel, text: T.tinta, border: T.linea, primary: T.verde },
};

/**
 * El icono de una pestaña. Las que tienen dibujo en la web (Panel, Historial,
 * Saldo, Solicitudes, Saldos) llevan el MISMO dibujo de Luis: apagado si no
 * es la pestaña activa, a color pleno si lo es, igual que el menú de
 * morcast.mx. "Más" no tiene equivalente en la web (allá el menú se ve
 * entero), así que se queda con su icono de línea, teñido como siempre.
 */
const iconoPestana = (iconos) => (route) => ({ focused, color, size }) => {
  const icono = iconos[route.name];
  if (icono.dibujo) return <IconoMenu nombre={icono.dibujo} activo={focused} tam={26} />;
  return <Feather name={icono.feather} size={size - 2} color={color} />;
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
// `onEntrar(modo)`: el login de clientes puede abrir cualquier modo cuando se
// entra con Google o Apple (ver Login.js); los otros dos, sólo el suyo.
function AuthFlow({ onEntrar, onAdmin, onChofer }) {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: T.fondo } }}>
      <AuthStack.Screen name="LoginCliente">
        {(props) => <Login {...props} onEntrar={onEntrar} />}
      </AuthStack.Screen>
      <AuthStack.Screen name="LoginAdmin">
        {(props) => <LoginAdmin {...props} onLogin={onAdmin} />}
      </AuthStack.Screen>
      <AuthStack.Screen name="LoginChofer">
        {(props) => <LoginChofer {...props} onLogin={onChofer} />}
      </AuthStack.Screen>
      {/* Explorar sin cuenta: lo que ve quien todavía no es cliente. */}
      <AuthStack.Screen name="Explorar" component={Explorar} />
      <AuthStack.Screen name="ExplorarCotizar" component={CotizarWhatsApp} />
      <AuthStack.Screen name="ExplorarCobertura" component={CoberturaPublica} />
    </AuthStack.Navigator>
  );
}

/* ---------- Chofer ---------- */
function AppChofer({ onLogout }) {
  const [ruta, setRuta] = useState(haySupabase() ? [] : RUTA_HOY);
  // Mientras se lee la ruta, la pantalla no puede decir "no tienes ruta":
  // todavía no lo sabe.
  const [cargandoRuta, setCargandoRuta] = useState(haySupabase());

  const recargarRuta = () =>
    rutaDelDia()
      .then((paradas) => {
        // Si no hay base configurada se queda la ruta de ejemplo, para que la
        // pantalla no salga vacia en modo demostracion.
        if (haySupabase()) setRuta(paradas);
      })
      .finally(() => setCargandoRuta(false));

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
      // Cuándo y dónde se tomó cada foto (6-oct-2026): el sello del
      // comprobante, como en la web. Sin GPS van null y se cierra igual.
      horaAntes: datos.horaAntesISO || null,
      horaDespues: datos.horaDespuesISO || null,
      ubicacionAntes: datos.ubicacionAntes || null,
      ubicacionDespues: datos.ubicacionDespues || null,
    });
    if (r.ok) {
      // El cliente se entera de que ya pasamos (correo y push, desde la web).
      // No se espera: el servicio ya quedó guardado, que es lo importante, y
      // la señal de la calle no debe detener al chofer en esta pantalla.
      avisarParada(parada.id, "completada").then((a) => {
        if (!a.ok) console.warn("No se pudo avisar al cliente de la recolección:", a.motivo);
      });
      await recargarRuta();
    }
    return r;
  };

  /**
   * "En camino" ya quedó en la base (y el cliente avisado): se cambia la copia
   * local de la parada sin volver a leer toda la ruta.
   */
  const enRutaLocal = (parada) =>
    setRuta((r) => r.map((sv) => (sv.folio === parada.folio ? { ...sv, estado: "en-ruta", clienteAvisado: true } : sv)));
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: T.panel }, headerTintColor: T.tealClaro, headerTitleStyle: { fontWeight: "700", color: T.tinta }, headerShadowVisible: false, headerBackTitle: "Atrás", contentStyle: { backgroundColor: T.fondo } }}>
      <Stack.Screen name="Ruta" options={{ headerShown: false }}>
        {(props) => <RutaChofer {...props} ruta={ruta} cargandoRuta={cargandoRuta} onLogout={onLogout} recargarRuta={recargarRuta} onEnRuta={enRutaLocal} />}
      </Stack.Screen>
      <Stack.Screen name="Recoleccion" options={{ title: "Recolección" }}>
        {(props) => <Recoleccion {...props} completar={completar} onEnRuta={enRutaLocal} />}
      </Stack.Screen>
      {/* 1.1 · lo que el chofer reporta desde la calle (pedidos de los dueños). */}
      <Stack.Screen name="NoProcedio" options={{ title: "No procedió" }}>
        {(props) => <NoProcedio {...props} recargarRuta={recargarRuta} />}
      </Stack.Screen>
      <Stack.Screen name="ReportarProblema" options={{ title: "Reportar un problema" }}>
        {(props) => <ReportarProblema {...props} ruta={ruta} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

/* ---------- Cliente ---------- */
// Los nombres de los dibujos son los del menú del portal (PortalShell.js).
const ICONOS_CLI = {
  Inicio: { dibujo: "panel" },
  Historial: { dibujo: "historial-de-servicios" },
  Saldo: { dibujo: "agregar-saldo" },
  Mas: { feather: "grid" },
};
const iconoCliente = iconoPestana(ICONOS_CLI);

function TabsCliente({ onLogout }) {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.fondo }} edges={["top"]}>
      <Tab.Navigator screenOptions={({ route }) => ({ ...tabBar(T.verde, insets), tabBarIcon: iconoCliente(route) })}>
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
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: T.panel }, headerTintColor: T.tinta, headerTitleStyle: { fontWeight: "700" }, headerShadowVisible: false, headerBackTitle: "Atrás", contentStyle: { backgroundColor: T.fondo } }}>
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

function AppClienteConAvisos({ onLogout }) {
  return (
    <>
      <AppCliente onLogout={onLogout} />
      {/* Explica para qué se avisa ANTES de que iOS pregunte (ver el archivo). */}
      <PermisoNotificaciones modo="cliente" />
    </>
  );
}

/* ---------- Admin ---------- */
// Los del menú de la administración web (AdminShell.js): "Saldos de
// clientes" allá lleva el dibujo `por-pagar`.
const ICONOS_ADM = {
  Panel: { dibujo: "panel" },
  Solicitudes: { dibujo: "solicitudes" },
  Saldos: { dibujo: "por-pagar" },
  MasA: { feather: "menu" },
};
const iconoAdmin = iconoPestana(ICONOS_ADM);

function TabsAdmin({ onLogout }) {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.fondo }} edges={["top"]}>
      <AdminTab.Navigator screenOptions={({ route }) => ({ ...tabBar(T.naranja, insets), tabBarIcon: iconoAdmin(route) })}>
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
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: T.panel }, headerTintColor: T.naranjaClaro, headerTitleStyle: { fontWeight: "700", color: T.tinta }, headerShadowVisible: false, headerBackTitle: "Atrás", contentStyle: { backgroundColor: T.fondo } }}>
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

/**
 * La administración detrás del SEGUNDO PASO (código por correo, pedido de
 * los dueños el 4-oct-2026). Mientras no haya un pase válido comprobado con
 * el servidor, no se monta nada del panel: ni las pestañas ni sus consultas.
 */
function AdminConPuerta({ onLogout, alAbrir }) {
  const [abierta, setAbierta] = useState(false);

  useEffect(() => {
    if (abierta) alAbrir?.();
  }, [abierta]);

  if (!abierta) return <SegundoPaso onListo={() => setAbierta(true)} onSalir={onLogout} />;
  return (
    <>
      <AppAdmin onLogout={onLogout} />
      <PermisoNotificaciones modo="admin" />
    </>
  );
}

export default function App() {
  // "pendiente": entró con Google o Apple y Morcast todavía no activa su alta.
  const [sesion, setSesion] = useState(null); // null | "cliente" | "admin" | "chofer" | "pendiente"
  const [revisando, setRevisando] = useState(true);

  /**
   * EL TOQUE DE UNA NOTIFICACIÓN. Puede llegar antes de que haya a dónde ir:
   * con la app cerrada (se abre en frío, todavía buscando la sesión) o con
   * el admin en la pantalla del código. Por eso se guarda como PENDIENTE y
   * se intenta cada vez que cambia la navegación, hasta que la pantalla de
   * destino exista. `push-destino.mjs` decide cuál es según el modo.
   */
  const navRef = useNavigationContainerRef();
  const pendiente = useRef(null);
  const sesionRef = useRef(null);
  sesionRef.current = sesion;

  const intentarNavegar = useCallback(() => {
    const datos = pendiente.current;
    if (!datos || !navRef.isReady()) return;
    const destino = destinoDeNotificacion(datos, sesionRef.current);
    if (!destino) {
      // Con sesión y sin destino, el aviso no es para este modo: se descarta.
      // Sin sesión se guarda para cuando entre.
      if (sesionRef.current) pendiente.current = null;
      return;
    }
    const pantallas = navRef.getRootState()?.routeNames || [];
    if (!pantallas.includes(destino.pantalla)) return;
    pendiente.current = null;
    navRef.navigate(destino.pantalla, destino.params);
  }, [navRef]);

  useEffect(() => {
    const enFrio = datosDeLaUltimaNotificacion();
    if (enFrio) pendiente.current = enFrio;
    return alTocarNotificacion((datos) => {
      pendiente.current = datos;
      intentarNavegar();
    });
  }, [intentarNavegar]);

  useEffect(() => {
    // Un respiro para que el navegador de la sesión nueva termine de montar.
    const t = setTimeout(intentarNavegar, 0);
    return () => clearTimeout(t);
  }, [sesion, intentarNavegar]);

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

    /**
     * RED DE SEGURIDAD DEL ARRANQUE.
     *
     * Buscar la sesión guardada es una comodidad, no un requisito: si tarda o
     * falla, lo peor que puede pasar es que el usuario escriba su contraseña.
     * Quedarse en la pantalla de carga, en cambio, deja la app inservible sin
     * explicar por qué — que es exactamente lo que pasaba.
     *
     * Así que a los 5 segundos se abre el login pase lo que pase. Si la
     * sesión aparece después, ya no se usa: `vivo` corta el paso.
     */
    const salvavidas = setTimeout(() => {
      if (vivo) setRevisando(false);
    }, 5000);

    (async () => {
      try {
        let encontrada = false;
        for (const modo of ["admin", "chofer", "cliente"]) {
          const p = await sesionActiva(modo);
          if (p) {
            if (vivo) setSesion(modo);
            encontrada = true;
            break;
          }
        }
        // Una cuenta de Google o Apple sin alta activada: a su sala de espera,
        // no al login con la sesión viva por debajo.
        if (!encontrada && (await sesionPendiente())) {
          if (vivo) setSesion("pendiente");
        }
      } catch (e) {
        // Un fallo buscando la sesión no puede dejar la app sin abrir.
        console.warn("No se pudo recuperar la sesión guardada:", e?.message || e);
      }
      clearTimeout(salvavidas);
      if (vivo) setRevisando(false);
    })();

    return () => { vivo = false; clearTimeout(salvavidas); };
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
        <View style={{ flex: 1, backgroundColor: T.fondo, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <ActivityIndicator size="large" color={T.verde} />
          <Text style={{ color: T.tinta, marginTop: 20, fontSize: 16, fontWeight: "700" }}>Morcast</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer theme={temaNav} ref={navRef} onReady={intentarNavegar} onStateChange={intentarNavegar}>
        {sesion === "admin" ? (
          <AdminConPuerta onLogout={salir} alAbrir={() => setTimeout(intentarNavegar, 0)} />
        ) : sesion === "chofer" ? (
          <AppChofer onLogout={salir} />
        ) : sesion === "pendiente" ? (
          <SafeAreaView style={{ flex: 1, backgroundColor: T.fondo }} edges={["top"]}>
            <AltaPendiente onActivo={(modo) => setSesion(modo)} onSalir={salir} />
          </SafeAreaView>
        ) : sesion === "cliente" ? (
          <AppClienteConAvisos onLogout={salir} />
        ) : (
          <SafeAreaView style={{ flex: 1, backgroundColor: T.fondo }} edges={["top"]}>
            <AuthFlow onEntrar={(modo) => setSesion(modo)} onAdmin={() => setSesion("admin")} onChofer={() => setSesion("chofer")} />
          </SafeAreaView>
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
