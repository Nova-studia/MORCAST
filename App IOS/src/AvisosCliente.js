import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, AppState } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "./tema";
import { fechaLarga } from "./datos";
import { avisosParaMi, marcarAvisoLeido } from "./datos-remoto";
import { textoMotivo, fechaEnMatamoros } from "./avisos.mjs";

/**
 * AVISOS DE MORCAST arriba del Inicio del cliente (retrasos, reagendas).
 *
 * Los manda la administración desde el panel. Cuáles le tocan lo decide la
 * base; qué sigue vigente y qué ya leyó, `avisos.mjs`.
 *
 * Pedido de los dueños para la 1.1: la tarjeta NO se va hasta que el cliente
 * toca "Enterado" (no hay una ✕ para cerrarla de pasada). Así un "mañana no
 * pasa el camión" no se pierde con un toque por error, y la oficina sabe
 * quién se enteró (`avisos_lecturas`).
 *
 * Se vuelve a leer cada vez que la app regresa al frente: si el aviso llegó
 * por push y el cliente abre la app tocándolo, la tarjeta ya tiene que estar.
 */

/**
 * El color sigue al MOTIVO (DESIGN.md: los estados informan, no decoran).
 * Retraso en ámbar; reagenda en el azul de "programado"; el general, neutro.
 * Nunca naranja: en el portal el naranja es "en ruta".
 */
const TONO = {
  retraso: { icono: "clock", color: T.alerta, tinte: "rgba(214,164,74,0.14)" },
  reagenda: { icono: "calendar", color: T.accionTxt, tinte: T.accionTinte },
  general: { icono: "volume-2", color: T.gris, tinte: "rgba(255,255,255,0.06)" },
};

export default function AvisosCliente({ recarga = 0 }) {
  const [avisos, setAvisos] = useState([]);
  const [guardando, setGuardando] = useState(null);
  const [error, setError] = useState({});

  const leer = useCallback(() => {
    avisosParaMi()
      .then((l) => setAvisos(l || []))
      .catch(() => { /* sin avisos no se rompe el Inicio */ });
  }, []);

  useEffect(() => {
    leer();
  }, [leer, recarga]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (estado) => {
      if (estado === "active") leer();
    });
    return () => sub.remove();
  }, [leer]);

  const enterado = async (aviso) => {
    if (guardando) return;
    setGuardando(aviso.id);
    setError((e) => ({ ...e, [aviso.id]: "" }));
    const r = await marcarAvisoLeido(aviso.id);
    setGuardando(null);
    if (!r.ok) {
      // La tarjeta se queda: si se quitara sin guardarse, volvería a salir
      // en la próxima apertura y el cliente pensaría que la app falla.
      setError((e) => ({ ...e, [aviso.id]: r.motivo }));
      return;
    }
    setAvisos((l) => l.filter((a) => a.id !== aviso.id));
  };

  if (!avisos.length) return null;

  return (
    <View style={{ marginBottom: 4 }}>
      {avisos.map((a) => {
        const tono = TONO[a.motivo] || TONO.general;
        const dia = a.creado ? fechaLarga(fechaEnMatamoros(a.creado)) : "";
        return (
          <View key={a.id} style={[s.tarjeta, { borderLeftColor: tono.color }]} accessibilityRole="alert">
            <View style={s.cab}>
              <View style={[s.ico, { backgroundColor: tono.tinte }]}>
                <Feather name={tono.icono} size={17} color={tono.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.motivo, { color: tono.color }]}>
                  {textoMotivo(a.motivo).toUpperCase()}
                  {dia ? <Text style={s.dia}>{"   "}{dia}</Text> : null}
                </Text>
                <Text style={s.titulo}>{a.titulo}</Text>
              </View>
            </View>
            <Text style={s.mensaje}>{a.mensaje}</Text>
            {a.vigente_hasta ? <Text style={s.vigencia}>Aplica hasta el {fechaLarga(a.vigente_hasta)}</Text> : null}
            {error[a.id] ? <Text style={s.error}>{error[a.id]}</Text> : null}
            <Pressable
              onPress={() => enterado(a)}
              disabled={guardando === a.id}
              style={({ pressed }) => [s.boton, { opacity: guardando === a.id ? 0.6 : pressed ? 0.85 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel={`Enterado: ${a.titulo}`}
            >
              {guardando === a.id ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather name="check" size={16} color="#fff" />
              )}
              <Text style={s.botonTxt}>Enterado</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  tarjeta: {
    backgroundColor: T.panel,
    borderWidth: 1,
    borderColor: T.linea,
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  cab: { flexDirection: "row", alignItems: "flex-start", gap: 11 },
  ico: { width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  motivo: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2 },
  dia: { color: T.gris, fontSize: 11.5, fontWeight: "400", letterSpacing: 0 },
  titulo: { color: T.tinta, fontSize: 15, fontWeight: "700", marginTop: 3, lineHeight: 20 },
  mensaje: { color: T.gris, fontSize: 13.5, lineHeight: 20, marginTop: 8 },
  vigencia: { color: T.gris, fontSize: 12, marginTop: 6 },
  error: { color: T.error, fontSize: 12.5, marginTop: 8 },
  boton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: T.accion, borderRadius: 10, paddingVertical: 11, marginTop: 12,
  },
  botonTxt: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
