import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../tema";
import { Tarjeta, TituloTarjeta } from "../ui";
import { SERVICIOS_CLIENTE, CLIENTE, fechaLarga } from "../datos";
import { misServicios } from "../datos-remoto";
import { descargarManifiesto, descargarConstancia } from "../pdf";

export default function Documentos() {
  const [bajando, setBajando] = useState(null);
  const [servicios, setServicios] = useState(null);

  useEffect(() => {
    let vivo = true;
    misServicios().then((l) => { if (vivo) setServicios(l); });
    return () => { vivo = false; };
  }, []);

  // Mientras carga se ven los de ejemplo, para que la pantalla no salga vacia.
  const lista = servicios && servicios.length ? servicios : SERVICIOS_CLIENTE;
  const manifiestos = lista.filter((x) => x.manifiesto);

  const conConstancia = async () => {
    setBajando("csf");
    try { await descargarConstancia(); }
    catch (e) { Alert.alert("Error", String(e?.message || e)); }
    finally { setBajando(null); }
  };
  const conManifiesto = async (x) => {
    setBajando(x.folio);
    try { await descargarManifiesto(x, CLIENTE); }
    catch (e) { Alert.alert("Error", String(e?.message || e)); }
    finally { setBajando(null); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.fondo }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text style={s.h1}>Documentos</Text>
      <Text style={s.sub}>Descarga tu constancia fiscal y los manifiestos de cada servicio.</Text>

      <Tarjeta>
        <TituloTarjeta>Fiscales</TituloTarjeta>
        <Fila
          icono="file-text" color={T.tealClaro}
          titulo="Constancia de Situación Fiscal"
          sub="Datos fiscales de Morcast del Norte"
          cargando={bajando === "csf"}
          onPress={conConstancia}
        />
      </Tarjeta>

      <Tarjeta>
        <TituloTarjeta>Manifiestos ({manifiestos.length})</TituloTarjeta>
        {manifiestos.map((x, i) => (
          <Fila
            key={x.folio}
            icono="file" color={T.verdeClaro}
            titulo={x.manifiesto}
            sub={`${x.tipo} · ${fechaLarga(x.fecha)}`}
            cargando={bajando === x.folio}
            onPress={() => conManifiesto(x)}
            borde={i < manifiestos.length - 1}
          />
        ))}
      </Tarjeta>
    </ScrollView>
  );
}

function Fila({ icono, color, titulo, sub, onPress, cargando, borde }) {
  return (
    <Pressable onPress={onPress} disabled={cargando} style={[s.fila, borde && s.borde]}>
      <View style={[s.ico, { backgroundColor: color + "22" }]}><Feather name={icono} size={17} color={color} /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.filaTit}>{titulo}</Text>
        <Text style={s.filaSub}>{sub}</Text>
      </View>
      <Feather name={cargando ? "loader" : "download"} size={19} color={T.verdeClaro} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  h1: { color: T.tinta, fontSize: 22, fontWeight: "800" },
  sub: { color: T.gris, fontSize: 13.5, marginTop: 3, marginBottom: 14, lineHeight: 19 },
  fila: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11 },
  borde: { borderBottomWidth: 1, borderBottomColor: T.linea },
  ico: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  filaTit: { color: T.tinta, fontSize: 14, fontWeight: "700" },
  filaSub: { color: T.gris, fontSize: 12, marginTop: 2 },
});
