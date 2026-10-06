import { useEffect, useState } from "react";
import { View, Text, Modal, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "./tema";
import { Boton } from "./ui";
import { convieneExplicar, posponerExplicacion, pedirPermisoYRegistrar, registrarToken } from "./notificaciones";

/**
 * LA EXPLICACIÓN ANTES DEL PERMISO de notificaciones.
 *
 * iOS pregunta "¿Permitir notificaciones?" UNA sola vez. Si se pregunta en
 * frío, al abrir la app, mucha gente dice que no por reflejo y ya no hay
 * vuelta (tendría que ir a Ajustes). Por eso primero se dice, en palabras de
 * Morcast, para qué se va a avisar, y el permiso del sistema sale solo si la
 * persona toca "Sí, avísenme".
 *
 * Si ya había permiso (otra sesión, otro día), no se enseña nada y solo se
 * registra el token de esta sesión.
 *
 * `modo` cambia el texto: al cliente se le avisa de su servicio; a la
 * oficina, de lo que reportan los choferes.
 */
const TEXTO = {
  cliente: {
    titulo: "¿Te avisamos de tu servicio?",
    puntos: [
      { icono: "clock", texto: "Si tu recolección va a llegar tarde." },
      { icono: "calendar", texto: "Si hay que cambiarla de día." },
      { icono: "volume-2", texto: "Avisos importantes de Morcast." },
    ],
    pie: "Sin publicidad. Puedes apagarlas cuando quieras en Ajustes.",
  },
  admin: {
    titulo: "¿Te avisamos de la operación?",
    puntos: [
      { icono: "alert-triangle", texto: "Cuando un chofer reporte un accidente, un retraso o una falla." },
      { icono: "box", texto: "Cuando un contenedor esté dañado, movido o no esté." },
      // equipo 1 (6-oct-2026): ahora también llega la recolección pedida.
      { icono: "inbox", texto: "Cuando un cliente pida una recolección." },
    ],
    pie: "Puedes apagarlas cuando quieras en Ajustes.",
  },
  // equipo 1 (6-oct-2026): el chofer también recibe avisos, de SU ruta.
  chofer: {
    titulo: "¿Te avisamos de tu ruta?",
    puntos: [
      { icono: "map-pin", texto: "Cuando la oficina te ponga una parada nueva." },
      { icono: "clock", texto: "Si te cambian el día o la hora de una parada, o te la quitan." },
    ],
    pie: "Tu ruta se actualiza sola al llegar el aviso. Puedes apagarlos en Ajustes.",
  },
};

export default function PermisoNotificaciones({ modo = "cliente" }) {
  const [visible, setVisible] = useState(false);
  const [pidiendo, setPidiendo] = useState(false);
  const t = TEXTO[modo] || TEXTO.cliente;

  useEffect(() => {
    let vivo = true;
    (async () => {
      // Con permiso ya dado, solo se registra el token de esta sesión.
      await registrarToken().catch(() => {});
      if (await convieneExplicar()) {
        // Un respiro para que primero se pinte la pantalla: un cuadro encima
        // de una pantalla en blanco parece un error.
        setTimeout(() => { if (vivo) setVisible(true); }, 1200);
      }
    })();
    return () => { vivo = false; };
  }, []);

  const si = async () => {
    setPidiendo(true);
    await pedirPermisoYRegistrar();
    setPidiendo(false);
    setVisible(false);
  };

  const ahoraNo = async () => {
    await posponerExplicacion();
    setVisible(false);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={ahoraNo}>
      <View style={s.fondo}>
        <View style={s.caja}>
          <View style={s.ico}><Feather name="bell" size={24} color={T.accionTxt} /></View>
          <Text style={s.titulo}>{t.titulo}</Text>
          {t.puntos.map((p) => (
            <View key={p.texto} style={s.punto}>
              <Feather name={p.icono} size={16} color={T.accionTxt} style={{ marginTop: 2 }} />
              <Text style={s.puntoTxt}>{p.texto}</Text>
            </View>
          ))}
          <Text style={s.pie}>{t.pie}</Text>
          <Boton onPress={si} disabled={pidiendo} style={{ marginTop: 16, alignSelf: "stretch" }}>
            {pidiendo ? "Un momento…" : "Sí, avísenme"}
          </Boton>
          <Pressable onPress={ahoraNo} style={s.ahoraNo} hitSlop={8} accessibilityRole="button">
            <Text style={s.ahoraNoTxt}>Ahora no</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 24 },
  caja: { width: "100%", maxWidth: 380, backgroundColor: T.panel, borderRadius: 18, borderWidth: 1, borderColor: T.linea, padding: 22, alignItems: "center" },
  ico: { width: 52, height: 52, borderRadius: 14, backgroundColor: T.accionTinte, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  titulo: { color: T.tinta, fontSize: 18, fontWeight: "800", textAlign: "center", marginBottom: 12 },
  punto: { flexDirection: "row", alignItems: "flex-start", gap: 10, alignSelf: "stretch", marginBottom: 9 },
  puntoTxt: { flex: 1, color: T.tinta, fontSize: 14, lineHeight: 20 },
  pie: { color: T.gris, fontSize: 12.5, textAlign: "center", marginTop: 6, lineHeight: 18 },
  ahoraNo: { marginTop: 12, padding: 6 },
  ahoraNoTxt: { color: T.gris, fontSize: 14, fontWeight: "600" },
});
