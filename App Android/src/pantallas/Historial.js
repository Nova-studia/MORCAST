import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../tema";
import { Tarjeta, Badge } from "../ui";
import { SERVICIOS_CLIENTE, fechaLarga, estatusInfo } from "../datos";
import { misServicios } from "../datos-remoto";
import { haySupabase } from "../supabase";
import { useMiEmpresa, avisoSinEmpresa } from "../mi-empresa";
import { descargarManifiesto } from "../pdf";
import { textoNoProcedio } from "../solicitudes.js";

const FILTROS = [
  { id: "todos", texto: "Todos" },
  { id: "completado", texto: "Completados" },
  { id: "programado", texto: "Programados" },
  { id: "en-ruta", texto: "En ruta" },
  { id: "no-procedio", texto: "No procedió" },
];

export default function Historial() {
  const [filtro, setFiltro] = useState("todos");
  const [abierto, setAbierto] = useState(null);
  const [bajando, setBajando] = useState(null);
  const { empresa, puedeImprimir, cargando } = useMiEmpresa();

  const bajarManifiesto = async (x) => {
    if (!puedeImprimir) {
      const [t, m] = avisoSinEmpresa(cargando);
      Alert.alert(t, m);
      return;
    }
    setBajando(x.folio);
    try {
      await descargarManifiesto(x, empresa);
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

  // Con base conectada la lista es la REAL aunque venga vacía. Antes, si el
  // cliente no tenía servicios, se le enseñaban los de ejemplo (folios
  // SRV-2026-07xx, chofer "J. Medina"): una empresa recién dada de alta veía
  // recolecciones que nunca le hicieron. Los de ejemplo sólo valen sin base.
  const cargandoLista = haySupabase() && servicios === null;
  const lista = servicios || (haySupabase() ? [] : SERVICIOS_CLIENTE);

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

      {filas.length === 0 && (
        <Text style={s.vacio}>
          {cargandoLista
            ? "Leyendo tus servicios…"
            : lista.length === 0
              ? "Todavía no tienes servicios registrados. Cuando Morcast programe tu primera recolección aparecerá aquí."
              : "Sin servicios en este filtro."}
        </Text>
      )}

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
                <Dato k="Peso" v={x.peso} />
                <Dato k="Operador" v={x.operador} />
                {/* El chofer fue y no se pudo recoger: el porqué y que no se
                    cobra, con las mismas palabras que el portal. */}
                {x.estatus === "no-procedio" ? (
                  <Text style={s.noProcedio}>{textoNoProcedio(x)}</Text>
                ) : x.manifiesto ? (
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
  chipTxtOn: { color: "#fff" },
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
  noProcedio: { color: T.error, fontSize: 13, lineHeight: 19, marginTop: 8, backgroundColor: "rgba(217,119,107,0.10)", borderRadius: 9, padding: 10 },
  vacio: { color: T.gris, textAlign: "center", paddingVertical: 24 },
});
