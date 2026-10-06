import { useEffect, useState } from "react";
import { View, Text, Modal, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../tema";
import { Boton } from "../ui";
import { hayQuePreguntar, recordarAhoraNo, pedirPermisoYRegistrar, registrarSiHayPermiso } from "../push";

/**
 * EXPLICACIÓN ANTES DEL PERMISO DE NOTIFICACIONES.
 *
 * Android solo deja pedir el permiso una o dos veces; si la persona dice que
 * no al diálogo del sistema sin saber para qué era, ya no hay forma de
 * volver a preguntarle desde la app. Por eso primero se explica con
 * nuestras palabras qué le vamos a mandar (y qué NO), y solo si dice "Sí"
 * se abre el diálogo del sistema.
 *
 * Si ya había dado el permiso (otra sesión, otra cuenta) no se pregunta
 * nada: solo se registra este teléfono para la cuenta que entró.
 *
 * `modo` cambia el texto: el cliente recibe avisos de sus recolecciones; el
 * personal, los incidentes que reportan los choferes. Mismos textos que la
 * app de iPhone (`PermisoNotificaciones.js`).
 */
const TEXTOS = {
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

export default function PermisoPush({ modo = "cliente" }) {
  const [visible, setVisible] = useState(false);
  const [pidiendo, setPidiendo] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      // Primero lo silencioso: si ya hay permiso, solo se registra.
      const r = await registrarSiHayPermiso();
      if (!vivo || r.ok) return;
      if (await hayQuePreguntar()) {
        // Un respiro para que la persona vea primero su pantalla y no un
        // diálogo encima en cuanto entra.
        setTimeout(() => { if (vivo) setVisible(true); }, 1200);
      }
    })().catch(() => {});
    return () => { vivo = false; };
  }, []);

  const si = async () => {
    setPidiendo(true);
    await pedirPermisoYRegistrar();
    setPidiendo(false);
    setVisible(false);
  };

  const ahoraNo = async () => {
    await recordarAhoraNo();
    setVisible(false);
  };

  const t = TEXTOS[modo] || TEXTOS.cliente;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={ahoraNo}>
      <View style={s.fondo}>
        <View style={s.caja}>
          <View style={s.icono}><Feather name="bell" size={24} color={T.accionTxt} /></View>
          <Text style={s.titulo}>{t.titulo}</Text>
          {t.puntos.map((p) => (
            <View key={p.texto} style={s.punto}>
              <Feather name={p.icono} size={16} color={T.accionTxt} style={{ marginTop: 2 }} />
              <Text style={s.puntoTxt}>{p.texto}</Text>
            </View>
          ))}
          <Text style={s.nota}>{t.pie}</Text>
          <Boton onPress={si} disabled={pidiendo} style={{ marginTop: 18, alignSelf: "stretch" }}>
            {pidiendo ? "Un momento…" : "Sí, avísenme"}
          </Boton>
          <Boton variante="linea" onPress={ahoraNo} disabled={pidiendo} style={{ marginTop: 10, alignSelf: "stretch" }}>
            Ahora no
          </Boton>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 24 },
  caja: { backgroundColor: T.panel, borderRadius: 16, borderWidth: 1, borderColor: T.linea, padding: 22, alignItems: "center", width: "100%", maxWidth: 420 },
  icono: { width: 52, height: 52, borderRadius: 14, backgroundColor: T.accionTinte, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  titulo: { color: T.tinta, fontSize: 18, fontWeight: "800", textAlign: "center", marginBottom: 12 },
  punto: { flexDirection: "row", alignItems: "flex-start", gap: 10, alignSelf: "stretch", marginBottom: 9 },
  puntoTxt: { flex: 1, color: T.tinta, fontSize: 14, lineHeight: 20 },
  nota: { color: T.gris, fontSize: 12.5, textAlign: "center", marginTop: 6, lineHeight: 18 },
});
