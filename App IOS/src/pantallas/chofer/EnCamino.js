import { useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../../tema";
import { avisarParada } from "../../datos-remoto";
import { textoEnCamino } from "../../web/chofer-cierre.mjs";

/**
 * "EN CAMINO": el chofer sale hacia la parada y el CLIENTE se entera (correo
 * y notificación, los manda la web). Pedido de Luis (6-oct-2026).
 *
 * Antes ninguna pantalla de la app pasaba la parada a "En ruta": el cliente
 * veía su recolección "Programada" hasta que ya estaba hecha. Ahora el
 * servidor (`/api/app/parada-aviso`) la cambia de `confirmada` a `en-ruta` y
 * avisa en el mismo paso; si el chofer toca dos veces o se reintenta, el
 * cliente no recibe dos avisos.
 *
 * Se usa en la lista de la ruta y en la parada. Solo se pinta si la parada
 * está `confirmada` (el botón) o `en-ruta` (la línea de "En camino"); en la
 * ruta de demostración, sin estado, no sale nada.
 *
 * `onEnRuta(parada, avisado)` le dice a quien la usa que cambie su copia de
 * la parada: la lista no se vuelve a leer de la base por esto.
 *
 * 9-oct-2026: "el cliente ya fue avisado" SOLO si el servidor contestó
 * `avisado: true` (`textoEnCamino`). Antes salía siempre, aunque el cliente
 * no tuviera correo ni la app y nadie se hubiera enterado. Si se cargó ya en
 * camino no se sabe, y no se promete nada.
 */
export default function EnCamino({ parada, onEnRuta, style }) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  // Por si quien la usa no pasa `onEnRuta`: que la línea salga igual.
  const [listo, setListo] = useState(false);
  const [avisadoAqui, setAvisadoAqui] = useState(undefined);

  const enRuta = parada?.estado === "en-ruta" || listo;
  if (!enRuta && parada?.estado !== "confirmada") return null;

  if (enRuta) {
    const avisado = avisadoAqui !== undefined ? avisadoAqui : parada?.clienteAvisado;
    const texto = textoEnCamino(avisado);
    return (
      <View style={[s.linea, style]} accessible accessibilityLabel={texto}>
        <Feather name="truck" size={15} color={T.ruta} />
        <Text style={s.lineaTxt}>
          <Text style={{ fontWeight: "800" }}>En camino</Text>
          {texto.slice("En camino".length)}
        </Text>
      </View>
    );
  }

  const avisar = async () => {
    if (enviando) return;
    setEnviando(true);
    setError("");
    const r = await avisarParada(parada.id, "en-camino");
    setEnviando(false);
    if (!r.ok) {
      setError(r.motivo || "No se pudo avisar al cliente. Inténtalo otra vez.");
      return;
    }
    // `avisado` undefined = ya estaba en camino (no se sabe si se avisó).
    const avisado = typeof r.avisado === "boolean" ? r.avisado : undefined;
    setAvisadoAqui(avisado);
    setListo(true);
    onEnRuta?.(parada, avisado);
  };

  return (
    <View style={style}>
      <Pressable
        onPress={avisar}
        disabled={enviando}
        accessibilityRole="button"
        accessibilityLabel={`En camino a ${parada.cliente || "esta parada"}. Le avisa al cliente.`}
        accessibilityState={{ disabled: enviando, busy: enviando }}
        style={({ pressed }) => [s.boton, { opacity: enviando ? 0.6 : pressed ? 0.85 : 1 }]}
      >
        {enviando ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="truck" size={18} color="#fff" />}
        <Text style={s.botonTxt}>{enviando ? "Avisando al cliente…" : "En camino"}</Text>
      </Pressable>
      {error ? (
        <View style={s.error} accessibilityLiveRegion="polite">
          <Feather name="alert-circle" size={14} color={T.error} style={{ marginTop: 1 }} />
          <Text style={s.errorTxt}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  // La acción principal de una parada confirmada: el azul de acción con
  // texto blanco (5.80:1), y alto de sobra para tocarlo con guantes.
  boton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, minHeight: 50, borderRadius: 11, backgroundColor: T.accion, paddingHorizontal: 16 },
  botonTxt: { color: "#fff", fontSize: 15.5, fontWeight: "800" },
  error: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 8 },
  errorTxt: { color: T.error, fontSize: 12.5, lineHeight: 17, flex: 1 },
  linea: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 9, paddingHorizontal: 11, borderRadius: 10, backgroundColor: "rgba(224,149,95,0.12)" },
  lineaTxt: { color: T.ruta, fontSize: 13, flex: 1 },
});
