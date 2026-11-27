import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform, AppState, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { T } from "./tema";
import { haySupabase } from "./supabase";
import { entrarConGafete } from "./sesion";
import { nfcDisponible, bloqueadoLocal, dejarDeLeer } from "./gafete";
import { opcionGafete, TEXTOS_GAFETE } from "./gafete-login.mjs";

/**
 * "INICIA SESIÓN ACERCANDO TU GAFETE" — la primera opción del inicio de
 * sesión del admin y del chofer (diseño 2026-11-27). Debajo sigue el correo.
 *
 * · iPhone: botón "Acercar gafete" que abre la hoja "Listo para escanear".
 * · Android: mientras la pantalla está abierta, basta con acercarlo.
 * · Sin NFC: no se pinta nada. NFC apagado: lo dice. Al 4.º intento fallido
 *   en este teléfono: pide entrar con correo (hasta que lo haga).
 *
 * `onEntrar(modo)`: el modo lo decide el rol de quien acercó el gafete.
 * ⚠️ Igual en App Android y App IOS (solo cambia lo que dice el texto).
 */
// Android: después de CUALQUIER respuesta del servidor que no sea entrar, la
// lectura automática se detiene y queda "Volver a intentar". Si siguiera sola,
// un gafete quieto gastaría los intentos y el freno en segundos (revisión final).

export default function BotonGafete({ onEntrar, color = T.tealClaro }) {
  const [opcion, setOpcion] = useState(null);
  const [leyendo, setLeyendo] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [pausado, setPausado] = useState(false);
  const vivo = useRef(true);
  // `onEntrar` llega nuevo en cada render (cada tecla del formulario): en un
  // ref para que la lectura de Android NO se reinicie con cada tecla.
  const alEntrar = useRef(onEntrar);
  alEntrar.current = onEntrar;
  const esIos = Platform.OS === "ios";

  const revisar = useCallback(async () => {
    if (!haySupabase()) { setOpcion("oculta"); return; }
    const nfc = await nfcDisponible();
    setOpcion(opcionGafete({ ...nfc, bloqueadoLocal: await bloqueadoLocal() }));
  }, []);

  useEffect(() => {
    vivo.current = true;
    revisar();
    // Volvió de Ajustes con el NFC encendido: se vuelve a revisar.
    const sub = AppState.addEventListener("change", (e) => { if (e === "active") revisar(); });
    return () => { vivo.current = false; sub.remove(); dejarDeLeer(); };
  }, [revisar]);

  const intentar = useCallback(async () => {
    setLeyendo(true);
    setMensaje("");
    const r = await entrarConGafete();
    if (!vivo.current) return { parar: true };
    setLeyendo(false);
    if (r.ok) { alEntrar.current(r.modo); return { parar: true }; }
    if (r.usaCorreo) { setOpcion("usaCorreo"); setMensaje(""); return { parar: true }; }
    if (r.cancelado) return { parar: true };
    setMensaje(r.mensaje || TEXTOS_GAFETE.noEntra);
    return { parar: true, fallo: true };
  }, []);

  // Android: lee solo mientras la pantalla está enfocada.
  useFocusEffect(
    useCallback(() => {
      if (esIos || opcion !== "lista" || pausado) return undefined;
      let seguir = true;
      (async () => {
        const { fallo } = await intentar();
        if (seguir && fallo) setPausado(true);
      })();
      return () => { seguir = false; dejarDeLeer(); };
    }, [esIos, opcion, pausado, intentar]),
  );

  if (!opcion || opcion === "oculta") return null;

  return (
    <View style={s.caja}>
      <View style={s.fila}>
        <Feather name="credit-card" size={20} color={color} />
        <Text style={s.titulo}>Inicia sesión acercando tu gafete</Text>
      </View>

      {opcion === "enciende" ? (
        <Text style={s.nota}>Enciende el NFC del teléfono para entrar con tu gafete.</Text>
      ) : opcion === "usaCorreo" ? (
        <Text style={s.aviso}>{TEXTOS_GAFETE.usaCorreo}</Text>
      ) : esIos ? (
        <Pressable
          onPress={() => { if (!leyendo) intentar(); }}
          style={({ pressed }) => [s.boton, { borderColor: color }, pressed && { opacity: 0.75 }]}
          accessibilityRole="button"
        >
          {leyendo ? <ActivityIndicator color={color} /> : <Text style={[s.botonTxt, { color }]}>Acercar gafete</Text>}
        </Pressable>
      ) : pausado ? (
        <Pressable
          onPress={() => { setMensaje(""); setPausado(false); }}
          style={({ pressed }) => [s.boton, { borderColor: color }, pressed && { opacity: 0.75 }]}
          accessibilityRole="button"
        >
          <Text style={[s.botonTxt, { color }]}>Volver a intentar</Text>
        </Pressable>
      ) : (
        <View style={s.fila}>
          {leyendo ? <ActivityIndicator size="small" color={color} /> : null}
          <Text style={s.nota}>Acerca tu gafete a la parte de atrás del teléfono.</Text>
        </View>
      )}

      {mensaje ? <Text style={s.aviso}>{mensaje}</Text> : null}

      <View style={s.separador}>
        <View style={s.linea} />
        <Text style={s.separadorTxt}>o entra con tu correo</Text>
        <View style={s.linea} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  caja: { marginBottom: 4 },
  fila: { flexDirection: "row", alignItems: "center", gap: 9 },
  titulo: { color: T.tinta, fontSize: 16, fontWeight: "800" },
  nota: { color: T.gris, fontSize: 14, marginTop: 10, lineHeight: 20, flexShrink: 1 },
  aviso: { color: "#f0895c", fontSize: 13, marginTop: 10, lineHeight: 19 },
  boton: { marginTop: 12, borderWidth: 1.5, borderRadius: 11, paddingVertical: 13, alignItems: "center", backgroundColor: T.panel2 },
  botonTxt: { fontSize: 15, fontWeight: "800" },
  separador: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 22, marginBottom: 4 },
  linea: { flex: 1, height: 1, backgroundColor: T.linea },
  separadorTxt: { color: T.gris, fontSize: 12 },
});
