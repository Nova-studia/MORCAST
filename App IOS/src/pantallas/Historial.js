import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../tema";
import { Tarjeta, Badge } from "../ui";
import { SERVICIOS_CLIENTE, CLIENTE, fechaLarga, estatusInfo } from "../datos";
import { misServicios } from "../datos-remoto";
import { descargarManifiesto } from "../pdf";

const FILTROS = [
  { id: "todos", texto: "Todos" },
  { id: "completado", texto: "Completados" },
  { id: "programado", texto: "Programados" },
  { id: "en-ruta", texto: "En ruta" },
];

export default function Historial() {
  const [filtro, setFiltro] = useState("todos");
  const [abierto, setAbierto] = useState(null);
  const [bajando, setBajando] = useState(null);

  const bajarManifiesto = async (x) => {
    setBajando(x.folio);
    try {
      await descargarManifiesto(x, CLIENTE);
    } catch (e) {
      Alert.alert("No se pudo generar el PDF", String(e?.message || e));
    } finally {
      setBajando(null);
    }
  };

  const [servicios, setServicios] = useState(null);

  // Los enlaces de las fotos vienen firmados y caducan, así que se piden al
  // abrir la pantalla y no se guardan.
  useEffect(() => {
    let vivo = true;
    misServicios().then((l) => {
      if (vivo) setServicios(l);
    });
    return () => {
      vivo = false;
    };
  }, []);

  // Mientras carga, o si todavía no hay base conectada, se ven los de ejemplo.
  const lista = servicios && servicios.length ? servicios : SERVICIOS_CLIENTE;

  const filas = lista
    .filter((x) => filtro === "todos" || x.estatus === filtro)
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.fondo }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text style={s.h1}>Historial de servicios</Text>
      <Text style={s.sub}>Consulta tus recolecciones y su detalle.</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }} contentContainerStyle={{ gap: 8 }}>
        {FILTROS.map((f) => (
          <Pressable key={f.id} onPress={() => setFiltro(f.id)} style={[s.chip, filtro === f.id && s.chipOn]}>
            <Text style={[s.chipTxt, filtro === f.id && s.chipTxtOn]}>{f.texto}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {filas.length === 0 && <Text style={s.vacio}>Sin servicios en este filtro.</Text>}

      {filas.map((x) => {
        const est = estatusInfo(x.estatus);
        const open = abierto === x.folio;
        return (
          <Tarjeta key={x.folio} style={{ padding: 0 }}>
            <Pressable onPress={() => setAbierto(open ? null : x.folio)} style={s.cab}>
              <View style={{ flex: 1 }}>
                <Text style={s.tipo}>{x.tipo}</Text>
                <Text style={s.folio}>{x.folio} · {fechaLarga(x.fecha)}</Text>
              </View>
              <Badge clase={est.clase}>{est.texto}</Badge>
              <Feather name={open ? "chevron-up" : "chevron-down"} size={18} color={T.gris} style={{ marginLeft: 8 }} />
            </Pressable>

            {open && (
              <View style={s.detalle}>
                <Dato k="Residuo" v={x.residuo} />
                <Dato k="Contenedor" v={x.contenedor} />
                <Dato k="Volumen" v={x.volumen} />
                <Dato k="Peso" v={x.peso} />
                <Dato k="Operador" v={x.operador} />
                {x.manifiesto ? (
                  <Pressable style={s.manif} onPress={() => bajarManifiesto(x)} disabled={bajando === x.folio}>
                    <Feather name={bajando === x.folio ? "loader" : "download"} size={15} color={T.verdeClaro} />
                    <Text style={s.manifTxt}>{bajando === x.folio ? "Generando…" : `Descargar manifiesto ${x.manifiesto}`}</Text>
                  </Pressable>
                ) : (
                  <Text style={s.pend}>Manifiesto pendiente</Text>
                )}
              </View>
            )}
          </Tarjeta>
        );
      })}
    </ScrollView>
  );
}

function Dato({ k, v }) {
  return (
    <View style={s.datoFila}>
      <Text style={s.datoK}>{k}</Text>
      <Text style={s.datoV}>{v}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  h1: { color: T.tinta, fontSize: 22, fontWeight: "800" },
  sub: { color: T.gris, fontSize: 13.5, marginTop: 3, marginBottom: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: T.linea, backgroundColor: T.panel },
  chipOn: { backgroundColor: T.verde, borderColor: T.verde },
  chipTxt: { color: T.gris, fontSize: 13, fontWeight: "600" },
  chipTxtOn: { color: "#0d1211" },
  cab: { flexDirection: "row", alignItems: "center", padding: 16 },
  tipo: { color: T.tinta, fontSize: 14.5, fontWeight: "700" },
  folio: { color: T.gris, fontSize: 12, marginTop: 3 },
  detalle: { borderTopWidth: 1, borderTopColor: T.linea, paddingHorizontal: 16, paddingVertical: 10 },
  datoFila: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
  datoK: { color: T.gris, fontSize: 13 },
  datoV: { color: T.tinta, fontSize: 13, fontWeight: "600" },
  manif: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 8, backgroundColor: "rgba(78,179,74,0.1)", borderRadius: 9, paddingVertical: 9, paddingHorizontal: 11 },
  manifTxt: { color: T.verdeClaro, fontSize: 13, fontWeight: "600" },
  pend: { color: T.grisClaro, fontSize: 12.5, marginTop: 8 },
  vacio: { color: T.gris, textAlign: "center", paddingVertical: 24 },
});
