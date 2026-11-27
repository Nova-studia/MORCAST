import { useEffect, useRef, useState } from "react";
import { View, Text, Image, StyleSheet, Animated, Easing, AccessibilityInfo, useWindowDimensions } from "react-native";
import { T } from "./tema";
import { escucharBienvenida, terminarBienvenida } from "./bienvenida-evento";

/**
 * BIENVENIDA AL ENTRAR CON EL GAFETE (pedido de Morcast; diseño aprobado por
 * Andrei el 27-nov-2026 sobre la vista previa "Vista previa bienvenida
 * Morcast.mp4"). Va ENCIMA de toda la app (App.js); el panel se arma detrás.
 *
 *   0.00–0.60 s  franjas del gafete (verde azulado y naranja) en diagonal
 *   0.25–1.15 s  el logo aparece y lo recorre un destello
 *   1.20–1.70 s  el logo sube y se achica
 *   1.30–2.25 s  entra la TARJETA tipo gafete: foto, nombre completo, puesto
 *   2.05–2.85 s  "¡Hola, Oscar!" letra por letra y "Tu panel está listo"
 *   … la tarjeta se queda ~2 s más (Andrei) …
 *   5.00–5.60 s  todo se va y aparece el panel
 *
 * Una sola línea de tiempo (`t`, en ms) y todo sale de ella con interpolate:
 * mismos números que la vista previa en HTML. Las curvas se muestrean en
 * puntos (el driver nativo no acepta `easing` dentro de interpolate). Solo
 * transform y opacity. En iPhone espera a que se cierre la ventanita del NFC.
 * ⚠️ Igual en App Android y App IOS.
 */
const DURACION = 5600;
const VERDE = "#044D57";
const NARANJA = "#F77B39";
const LOGO = require("../assets/logo-morcast.png");

const outCubic = (x) => 1 - (1 - x) ** 3;
const inCubic = (x) => x ** 3;
const outBack = (x) => 1 + 2.6 * (x - 1) ** 3 + 1.6 * (x - 1) ** 2;

/** De `a` a `b` ms, de `desde` a `hasta`, siguiendo la curva `f` (muestreada). */
function tramo(t, a, b, desde, hasta, f = (x) => x) {
  const n = 12;
  const entrada = [];
  const salida = [];
  for (let i = 0; i <= n; i++) {
    entrada.push(a + ((b - a) * i) / n);
    salida.push(desde + (hasta - desde) * f(i / n));
  }
  return t.interpolate({ inputRange: entrada, outputRange: salida, extrapolate: "clamp" });
}

export default function Bienvenida() {
  const [datos, setDatos] = useState(null);
  const [fotoMala, setFotoMala] = useState(false);
  const t = useRef(new Animated.Value(0)).current;
  const { width: W } = useWindowDimensions();

  useEffect(() => escucharBienvenida((d) => { setFotoMala(false); setDatos(d); }), []);

  useEffect(() => {
    if (!datos) return undefined;
    let vivo = true;
    t.setValue(0);
    const terminar = () => { terminarBienvenida(); if (vivo) setDatos(null); };
    (async () => {
      // iPhone: que la ventanita del NFC termine de cerrarse (con tope).
      if (datos.esperar) await Promise.race([datos.esperar.catch(() => {}), new Promise((r) => setTimeout(r, 3500))]);
      const reducir = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
      if (!vivo) return;
      if (reducir) {
        t.setValue(2900);
        Animated.sequence([
          Animated.delay(2500),
          Animated.timing(t, { toValue: DURACION, duration: 600, easing: Easing.linear, useNativeDriver: true }),
        ]).start(terminar);
        return;
      }
      Animated.timing(t, { toValue: DURACION, duration: DURACION, easing: Easing.linear, useNativeDriver: true }).start(terminar);
    })();
    return () => { vivo = false; };
  }, [datos, t]);

  if (!datos) return null;

  const saleTodo = tramo(t, 5000, 5500, 1, 0, outCubic); // 1 → 0 al final
  const franja = (retraso) => ({
    opacity: tramo(t, 1300, 1900, 0.9, 0.5),
    transform: [
      { rotate: "-14deg" },
      { translateX: Animated.add(tramo(t, retraso, 600 + retraso, -900, 0, outCubic), tramo(t, 5000, 5450, 0, 900, inCubic)) },
    ],
  });
  const logoEscala = Animated.multiply(tramo(t, 250, 800, 0.82, 1, outBack), tramo(t, 1200, 1700, 1, 0.62, outCubic));
  const nombreCompleto = datos.completo || datos.nombre || "";
  const letras = [...(datos.saludo || "¡Hola!")];
  const xTarjeta = (W - TARJETA_W) / 2;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="auto" accessibilityViewIsModal>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: T.fondo, opacity: tramo(t, 5150, 5600, 1, 0, outCubic) }]} />
      <Animated.View style={[s.franja, { top: 222, height: 150, width: W + 900, backgroundColor: VERDE }, franja(0)]} />
      <Animated.View style={[s.franja, { top: 380, height: 24, width: W + 900, backgroundColor: NARANJA }, franja(90)]} />

      <Animated.View
        style={[s.logo, { left: (W - 250) / 2, opacity: Animated.multiply(tramo(t, 250, 600, 0, 1), saleTodo),
          transform: [{ translateY: tramo(t, 1200, 1700, 0, -180, outCubic) }, { scale: logoEscala }] }]}
      >
        <Image source={LOGO} style={{ width: 250, height: 73 }} resizeMode="contain" />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[s.brillo, { left: (W - 70) / 2,
          opacity: t.interpolate({ inputRange: [650, 900, 1150], outputRange: [0, 1, 0], extrapolate: "clamp" }),
          transform: [{ translateX: tramo(t, 650, 1150, -170, 170) }, { rotate: "18deg" }] }]}
      />

      <Animated.View
        style={[s.tarjeta, { left: xTarjeta, opacity: Animated.multiply(tramo(t, 1300, 1500, 0, 1), saleTodo),
          transform: [
            { translateY: Animated.add(tramo(t, 1300, 1950, 420, 0, outBack), tramo(t, 5000, 5500, 0, -36, outCubic)) },
            { rotate: tramo(t, 1300, 1950, -8, 0, outBack).interpolate({ inputRange: [-8, 0], outputRange: ["-8deg", "0deg"] }) },
            { scale: tramo(t, 5000, 5500, 1, 0.94, outCubic) },
          ] }]}
        accessible
        accessibilityLabel={`${datos.saludo}. ${nombreCompleto}. ${datos.puesto || ""}`}
      >
        <View style={[s.tf, { top: -40, height: 96, backgroundColor: VERDE }]} />
        <View style={[s.tf, { top: 58, height: 16, backgroundColor: NARANJA }]} />
        <Image source={LOGO} style={s.marca} resizeMode="contain" />
        <Animated.View style={[s.foto, { opacity: tramo(t, 1650, 1800, 0, 1),
          transform: [{ scale: tramo(t, 1650, 2050, 0.7, 1, outBack) },
            { rotate: tramo(t, 1650, 2050, 6, 0, outBack).interpolate({ inputRange: [0, 6], outputRange: ["0deg", "6deg"] }) }] }]}>
          {datos.foto && !fotoMala ? (
            <Image source={{ uri: datos.foto }} style={s.fotoImg} onError={() => setFotoMala(true)} />
          ) : (
            <Text style={s.inicial}>{(datos.nombre || "?").charAt(0).toUpperCase()}</Text>
          )}
        </Animated.View>
        <Animated.Text numberOfLines={2} style={[s.nombre, { opacity: tramo(t, 1800, 2050, 0, 1),
          transform: [{ translateY: tramo(t, 1800, 2050, 8, 0, outCubic) }] }]}>
          {nombreCompleto}
        </Animated.Text>
        {datos.puesto ? (
          <Animated.View style={[s.puesto, { opacity: tramo(t, 1950, 2250, 0, 1, outCubic),
            transform: [{ translateX: tramo(t, 1950, 2250, -30, 0, outCubic) }] }]}>
            <Text style={s.puestoTxt}>{datos.puesto.toUpperCase()}</Text>
          </Animated.View>
        ) : null}
      </Animated.View>

      <View style={s.saludo} pointerEvents="none">
        {letras.map((c, i) => (
          <Animated.Text
            key={i}
            style={[s.letra, { opacity: Animated.multiply(tramo(t, 2050 + i * 40, 2300 + i * 40, 0, 1, outCubic), saleTodo),
              transform: [{ translateY: tramo(t, 2050 + i * 40, 2300 + i * 40, 12, 0, outCubic) }] }]}
          >
            {c}
          </Animated.Text>
        ))}
      </View>
      <Animated.Text style={[s.sub, { opacity: Animated.multiply(tramo(t, 2550, 2850, 0, 1, outCubic), saleTodo),
        transform: [{ translateY: tramo(t, 2550, 2850, 10, 0, outCubic) }] }]}>
        Tu panel está listo
      </Animated.Text>
    </View>
  );
}

const TARJETA_W = 262;
const s = StyleSheet.create({
  franja: { position: "absolute", left: -260 },
  logo: { position: "absolute", top: 262, width: 250, height: 73 },
  brillo: { position: "absolute", top: 232, width: 70, height: 140, backgroundColor: "rgba(255,255,255,0.4)", borderRadius: 30 },
  tarjeta: {
    position: "absolute", top: 168, width: TARJETA_W, height: 282, borderRadius: 18, backgroundColor: "#F4F7F6", overflow: "hidden",
    shadowColor: "#000", shadowOpacity: 0.45, shadowRadius: 20, shadowOffset: { width: 0, height: 18 }, elevation: 14,
  },
  tf: { position: "absolute", left: -60, width: 420, transform: [{ rotate: "-18deg" }] },
  marca: { position: "absolute", right: 16, top: 18, width: 92, height: 27 },
  foto: {
    position: "absolute", left: 22, top: 44, width: 104, height: 128, borderWidth: 4, borderColor: "#fff", borderRadius: 10,
    overflow: "hidden", backgroundColor: "#dfe6e4", alignItems: "center", justifyContent: "center",
  },
  fotoImg: { width: "100%", height: "100%" },
  inicial: { color: VERDE, fontSize: 46, fontWeight: "800" },
  nombre: { position: "absolute", left: 22, right: 18, top: 186, color: "#0f1a1b", fontWeight: "800", fontSize: 17, lineHeight: 20 },
  puesto: { position: "absolute", left: 22, top: 236, backgroundColor: NARANJA, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 5, maxWidth: 220 },
  puestoTxt: { color: "#000", fontWeight: "700", fontSize: 12, letterSpacing: 0.4 },
  saludo: { position: "absolute", left: 0, right: 0, top: 470, flexDirection: "row", justifyContent: "center" },
  letra: { color: T.tinta, fontSize: 32, fontWeight: "800", letterSpacing: -0.6 },
  sub: { position: "absolute", left: 0, right: 0, top: 516, textAlign: "center", color: T.gris, fontSize: 15 },
});
