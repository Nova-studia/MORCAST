import { useEffect, useRef, useState } from "react";
import { View, Text, Image, StyleSheet, Animated, Easing, AccessibilityInfo, useWindowDimensions } from "react-native";
import { T } from "./tema";
import { escucharBienvenida, terminarBienvenida } from "./bienvenida-evento";

/**
 * "¡HOLA, OSCAR!" — la bienvenida al entrar con el gafete (pedido de Morcast,
 * 27-nov-2026). Va ENCIMA de toda la app (montada en App.js): mientras se ve,
 * el panel ya se arma y carga sus datos detrás, así que la animación también
 * tapa la espera.
 *
 *   0 ms     se oscurece la pantalla; la foto entra con resorte
 *   ~200 ms  el anillo naranja empieza a girar alrededor de la foto
 *   ~250 ms  sube el saludo y el puesto
 *   0.2–2.4 s el anillo entra girando despacio; 2.7–3.2 s regresa girando
 *   ~3.0–3.34 s la tarjeta se encoge y se desvanece; aparece el panel
 *
 * Va en la parte de ARRIBA de la pantalla: en iPhone arranca con la
 * ventanita del NFC todavía abierta abajo y no debe taparla. (Se probó una
 * versión larga con logo y tarjeta tipo gafete; Luis prefirió esta.)
 *
 * Solo transform y opacity con el driver nativo (fluido en teléfonos
 * modestos). Con "Reducir movimiento" solo aparece y desaparece.
 * ⚠️ Igual en App Android y App IOS.
 */
// El anillo entra girando DESPACIO y en el último medio segundo regresa
// girando hacia atrás: entrada y salida (Andrei y Luis, 27-nov; vista previa
// "Vista previa bienvenida Morcast (sencilla).mp4").
const ANILLO_ENTRA_MS = 2200; // empieza a los 200 ms
const ANILLO_REGRESA_EN = 2700; // ms desde el inicio
const ANILLO_REGRESA_MS = 500;
const ESPERA_MS = 2800; // "Reducir movimiento": cuánto se queda quieta

export default function Bienvenida() {
  const [datos, setDatos] = useState(null);
  const { height: alto } = useWindowDimensions();
  const [fotoMala, setFotoMala] = useState(false);
  const fondo = useRef(new Animated.Value(0)).current;
  const foto = useRef(new Animated.Value(0)).current;
  const anillo = useRef(new Animated.Value(0)).current;
  const texto = useRef(new Animated.Value(0)).current;
  const salida = useRef(new Animated.Value(0)).current;

  useEffect(() => escucharBienvenida((d) => { setFotoMala(false); setDatos(d); }), []);

  useEffect(() => {
    if (!datos) return undefined;
    let vivo = true;
    [fondo, foto, anillo, texto, salida].forEach((v) => v.setValue(0));
    const nativo = { useNativeDriver: true };
    const terminar = () => { terminarBienvenida(); if (vivo) setDatos(null); };

    AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then((reducir) => {
      if (!vivo) return;
      if (reducir) {
        foto.setValue(1); anillo.setValue(1); texto.setValue(1);
        Animated.sequence([
          Animated.timing(fondo, { toValue: 1, duration: 150, ...nativo }),
          Animated.delay(ESPERA_MS),
          Animated.timing(salida, { toValue: 1, duration: 200, ...nativo }),
        ]).start(terminar);
        return;
      }
      Animated.sequence([
        Animated.parallel([
          Animated.timing(fondo, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), ...nativo }),
          Animated.spring(foto, { toValue: 1, friction: 6, tension: 90, ...nativo }),
          Animated.sequence([
            Animated.delay(200),
            Animated.timing(anillo, { toValue: 1, duration: ANILLO_ENTRA_MS, easing: Easing.out(Easing.cubic), ...nativo }),
          ]),
          Animated.sequence([
            Animated.delay(250),
            Animated.timing(texto, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), ...nativo }),
          ]),
        ]),
        Animated.delay(ANILLO_REGRESA_EN - 200 - ANILLO_ENTRA_MS),
        Animated.parallel([
          // El anillo deshace su giro (mismo camino de la entrada, al revés)…
          Animated.timing(anillo, { toValue: 0, duration: ANILLO_REGRESA_MS, easing: Easing.in(Easing.cubic), ...nativo }),
          // …y a la mitad empieza a desvanecerse todo.
          Animated.sequence([
            Animated.delay(300),
            Animated.timing(salida, { toValue: 1, duration: 340, easing: Easing.in(Easing.cubic), ...nativo }),
          ]),
        ]),
      ]).start(terminar);
    });
    return () => { vivo = false; };
  }, [datos, fondo, foto, anillo, texto, salida]);

  if (!datos) return null;

  const inicial = (datos.nombre || "?").charAt(0).toUpperCase();
  const opacidadFondo = Animated.multiply(fondo, salida.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }));
  const tarjeta = {
    opacity: salida.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    transform: [{ scale: salida.interpolate({ inputRange: [0, 1], outputRange: [1, 0.88] }) }],
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="auto" accessibilityViewIsModal>
      <Animated.View style={[StyleSheet.absoluteFill, s.fondo, { opacity: opacidadFondo }]} />
      <Animated.View style={[s.centro, { paddingTop: alto * 0.14 }, tarjeta]} accessible accessibilityLabel={`${datos.saludo} ${datos.puesto || ""}`}>
        <View style={s.marco}>
          <Animated.View
            style={[s.anillo, {
              opacity: anillo,
              transform: [
                { rotate: anillo.interpolate({ inputRange: [0, 1], outputRange: ["-160deg", "0deg"] }) },
                { scale: anillo.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.82, 1.06, 1] }) },
              ],
            }]}
          />
          <Animated.View style={[s.foto, { opacity: foto, transform: [{ scale: foto.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]}>
            {datos.foto && !fotoMala ? (
              <Image source={{ uri: datos.foto }} style={s.fotoImg} onError={() => setFotoMala(true)} />
            ) : (
              <Text style={s.inicial}>{inicial}</Text>
            )}
          </Animated.View>
        </View>
        <Animated.View style={{ opacity: texto, transform: [{ translateY: texto.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
          <Text style={s.saludo}>{datos.saludo}</Text>
          {datos.puesto ? <Text style={s.puesto}>{datos.puesto}</Text> : null}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const TAM = 132;
const s = StyleSheet.create({
  fondo: { backgroundColor: T.fondo },
  // Arriba, fuera de la ventanita del NFC (ocupa la mitad de abajo en iPhone).
  centro: { flex: 1, alignItems: "center", justifyContent: "flex-start", paddingHorizontal: 24 },
  marco: { width: TAM + 28, height: TAM + 28, alignItems: "center", justifyContent: "center", marginBottom: 22 },
  // Arco naranja: tres lados de color y uno transparente, para que al girar
  // se vea como un trazo que se cierra alrededor de la foto.
  anillo: {
    position: "absolute", width: TAM + 28, height: TAM + 28, borderRadius: (TAM + 28) / 2, borderWidth: 3,
    borderColor: T.naranja, borderTopColor: "transparent",
  },
  foto: { width: TAM, height: TAM, borderRadius: TAM / 2, overflow: "hidden", backgroundColor: T.panel2, alignItems: "center", justifyContent: "center" },
  fotoImg: { width: TAM, height: TAM },
  inicial: { color: T.tinta, fontSize: 52, fontWeight: "800" },
  saludo: { color: T.tinta, fontSize: 30, fontWeight: "800", letterSpacing: -0.5, textAlign: "center" },
  puesto: { color: T.gris, fontSize: 15, marginTop: 6, textAlign: "center" },
});
