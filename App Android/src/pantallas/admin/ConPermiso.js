import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../../tema";
import { Boton } from "../../ui";
import { useMisPermisos } from "../../mis-permisos";
import { puedeVer } from "../../permisos-app.mjs";

/**
 * EL GUARDIA DE CADA PANTALLA DE ADMINISTRACIÓN (apps al 100%, fase A).
 *
 * El menú ya esconde lo que el rol no incluye, pero a una pantalla también
 * se llega tocando una notificación (una solicitud nueva, un incidente). Sin
 * esto, una cajera que tocara "Recolección pedida" abriría la pantalla y solo
 * vería errores de permiso. Aquí se dice qué pasa, con las mismas palabras
 * que el servidor.
 *
 * Mientras llegan los permisos se espera; sin señal, se ofrece reintentar.
 */
export function ConPermiso({ pantalla, children }) {
  const { yo, estado, reintentar } = useMisPermisos();
  if (puedeVer(yo, pantalla)) return children;
  if (!yo && estado !== "listo") {
    return (
      <View style={s.centro}>
        {estado === "sinRed" ? (
          <>
            <Feather name="wifi-off" size={28} color={T.gris} />
            <Text style={s.tit}>Sin conexión</Text>
            <Text style={s.txt}>Todavía no sabemos qué secciones incluye tu rol.</Text>
            <Boton variante="linea" onPress={reintentar} style={{ marginTop: 14 }}>Reintentar</Boton>
          </>
        ) : (
          <ActivityIndicator color={T.gris} />
        )}
      </View>
    );
  }
  return (
    <View style={s.centro}>
      <Feather name="lock" size={28} color={T.gris} />
      <Text style={s.tit}>Tu rol no incluye esta sección</Text>
      <Text style={s.txt}>Pídesela al dueño desde Usuarios y roles.</Text>
    </View>
  );
}

/** Envuelve el componente de una pantalla de la pila con su guardia. */
export const conPermiso = (pantalla, Componente) => {
  function Guardada(props) {
    return (
      <ConPermiso pantalla={pantalla}>
        <Componente {...props} />
      </ConPermiso>
    );
  }
  Guardada.displayName = `ConPermiso(${pantalla})`;
  return Guardada;
};

const s = StyleSheet.create({
  centro: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, backgroundColor: T.fondo },
  tit: { color: T.tinta, fontSize: 17, fontWeight: "800", marginTop: 12, textAlign: "center" },
  txt: { color: T.gris, fontSize: 13.5, marginTop: 6, textAlign: "center", lineHeight: 19 },
});
