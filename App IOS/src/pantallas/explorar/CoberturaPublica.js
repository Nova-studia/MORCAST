import { View, Text, StyleSheet } from "react-native";
import { T } from "../../tema";
import { Tarjeta, Boton } from "../../ui";
import Cobertura from "../Cobertura";
import BarraVolver from "./BarraVolver";

/**
 * El mapa de Cobertura del cliente, abierto a quien todavía no tiene cuenta.
 * Es la MISMA pantalla: sin sesión, `zonasDeCobertura()` cae al contorno
 * público de Matamoros, que es lo que también enseña la web. Abajo va el
 * paso siguiente, que el cliente ya no necesita: pedir la cotización.
 */
export default function CoberturaPublica({ navigation }) {
  return (
    <View style={{ flex: 1, backgroundColor: T.fondo }}>
      <BarraVolver navigation={navigation} titulo="Cobertura" />
      <Cobertura
        pie={
          <Tarjeta>
            <Text style={s.tit}>¿Te interesa el servicio?</Text>
            <Text style={s.txt}>Cuéntanos qué residuos generas y te mandamos la cotización.</Text>
            <Boton onPress={() => navigation.navigate("ExplorarCotizar")} style={{ marginTop: 12 }}>
              Cotizar por WhatsApp
            </Boton>
          </Tarjeta>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  tit: { color: T.tinta, fontSize: 15, fontWeight: "700" },
  txt: { color: T.gris, fontSize: 13, marginTop: 4, lineHeight: 19 },
});
