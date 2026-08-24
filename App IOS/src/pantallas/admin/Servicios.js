import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Modal, Image } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../../tema";
import { Tarjeta, Badge } from "../../ui";
import { fechaLarga } from "../../datos-admin";
import { agendaServicios } from "../../datos-remoto";
import { estatusInfo } from "../../datos";

const FILTROS = [
  { id: "todos", texto: "Todos" },
  { id: "programado", texto: "Programados" },
  { id: "en-ruta", texto: "En ruta" },
  { id: "completado", texto: "Completados" },
];

export default function Servicios() {
  // La agenda sale de las paradas reales. Antes era una lista de ejemplo con
  // clientes y unidades que no existen.
  const [agenda, setAgenda] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    agendaServicios().then((a) => {
      if (!vivo) return;
      setAgenda(a);
      setCargando(false);
    });
    return () => { vivo = false; };
  }, []);

  const [filtro, setFiltro] = useState("todos");
  const [ver, setVer] = useState(null);
  const filas = agenda.filter((x) => filtro === "todos" || x.estatus === filtro).sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.fondo }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text style={s.h1}>Agenda de servicios</Text>
      <Text style={s.sub}>Toca un servicio completado para ver el comprobante fotográfico del chofer.</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }} contentContainerStyle={{ gap: 8 }}>
        {FILTROS.map((f) => (
          <Pressable key={f.id} onPress={() => setFiltro(f.id)} style={[s.chip, filtro === f.id && s.chipOn]}>
            <Text style={[s.chipTxt, filtro === f.id && { color: "#0d1211" }]}>{f.texto}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {!cargando && filas.length === 0 && (
        <Text style={s.vacio}>
          {agenda.length === 0
            ? "Todavía no hay recolecciones agendadas. Aparecen aquí en cuanto se confirma la primera."
            : "No hay servicios en este filtro."}
        </Text>
      )}

      {filas.map((x) => {
        const est = estatusInfo(x.estatus);
        const conEvi = !!x.evidencia;
        return (
          <Pressable key={x.folio} onPress={() => conEvi && setVer(x)} disabled={!conEvi}>
            <Tarjeta style={{ padding: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.folio}>{x.folio} · {fechaLarga(x.fecha)}</Text>
                  <Text style={s.cli}>{x.cliente}</Text>
                  <Text style={s.det}>{x.tipo} · {x.unidad} · {x.operador}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 6 }}>
                  <Badge clase={est.clase}>{est.texto}</Badge>
                  {conEvi && <Feather name="camera" size={15} color={T.verdeClaro} />}
                </View>
              </View>
            </Tarjeta>
          </Pressable>
        );
      })}

      <Modal visible={!!ver} animationType="slide" transparent onRequestClose={() => setVer(null)}>
        <View style={s.modalFondo}>
          <View style={s.modal}>
            {ver && (
              <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 30 }}>
                <View style={s.modalCab}>
                  <View><Text style={s.modalCli}>{ver.cliente}</Text><Text style={s.modalFolio}>{ver.folio} · Chofer {ver.operador}</Text></View>
                  <Pressable onPress={() => setVer(null)} hitSlop={10}><Feather name="x" size={22} color={T.gris} /></Pressable>
                </View>

                <View style={s.evCab}><Feather name="camera" size={16} color={T.verdeClaro} /><Text style={s.evCabTxt}>{ver.evidencia.contenedor}</Text></View>

                <View style={s.fotos}>
                  <Foto tipo="antes" dato={ver.evidencia.antes} />
                  <Foto tipo="despues" dato={ver.evidencia.despues} />
                </View>

                <View style={s.evDatos}>
                  <Dato k="Peso recolectado" v={ver.evidencia.despues.peso} />
                  <Dato k="Firma del operador" v={ver.evidencia.despues.firma} />
                  <Dato k="Ubicación (GPS)" v={ver.evidencia.gps} />
                  <Dato k="Estatus" v="Servicio concretado" ok />
                </View>
                <Text style={s.nota}>Este comprobante también lo ve el cliente en su reporte.</Text>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

/**
 * La foto que subio el chofer.
 *
 * Este recuadro nunca enseñaba la imagen: pintaba un fondo de color con un
 * icono de camara, y ahí se quedaba. El enlace firmado ya venía en `dato.url`
 * —lo arma `agendaServicios()`— pero nadie lo usaba, así que el admin no tenía
 * forma de comprobar desde el teléfono lo que hizo su gente. En la web sí se
 * ve desde la auditoría; esta pantalla se quedó atras.
 *
 * Sin enlace se mantiene el recuadro de antes: un servicio puede estar
 * agendado y todavía sin fotos.
 */
function Foto({ tipo, dato }) {
  const antes = tipo === "antes";
  const url = dato?.url;

  return (
    <View style={[s.foto, { backgroundColor: antes ? "#3a2f1c" : "#143024" }]}>
      {url ? (
        <Image source={{ uri: url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={s.fotoHueco}>
          <Feather name="camera" size={26} color="rgba(255,255,255,0.7)" />
          <Text style={s.fotoEtq}>{dato?.etiqueta || (antes ? "Contenedor lleno" : "Contenedor vacío")}</Text>
        </View>
      )}
      <View style={[s.fotoTag, { backgroundColor: antes ? "rgba(219,152,45,0.92)" : "rgba(78,179,74,0.92)" }]}>
        <Text style={s.fotoTagTxt}>{antes ? "Antes" : "Después"}</Text>
      </View>
      <View style={s.fotoSello}><Feather name="clock" size={11} color="#fff" /><Text style={s.fotoSelloTxt}>{dato?.hora || "—"}</Text><Feather name="map-pin" size={11} color="#fff" /><Text style={s.fotoSelloTxt}>GPS</Text></View>
    </View>
  );
}

function Dato({ k, v, ok }) {
  return <View style={s.datoFila}><Text style={s.datoK}>{k}</Text><Text style={[s.datoV, ok && { color: T.verdeClaro }]}>{v}</Text></View>;
}

const s = StyleSheet.create({
  vacio: { color: T.gris, fontSize: 13.5, lineHeight: 19, marginTop: 6 },
  h1: { color: T.tinta, fontSize: 22, fontWeight: "800" },
  sub: { color: T.gris, fontSize: 13.5, marginTop: 3, marginBottom: 14, lineHeight: 19 },
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: T.linea, backgroundColor: T.panel },
  chipOn: { backgroundColor: T.naranja, borderColor: T.naranja },
  chipTxt: { color: T.gris, fontSize: 12.5, fontWeight: "600" },
  folio: { color: T.gris, fontSize: 11.5 },
  cli: { color: T.tinta, fontSize: 14.5, fontWeight: "700", marginTop: 3 },
  det: { color: T.gris, fontSize: 12, marginTop: 2 },
  modalFondo: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modal: { backgroundColor: T.fondo, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: "92%", borderWidth: 1, borderColor: T.linea },
  modalCab: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalCli: { color: T.tinta, fontSize: 16, fontWeight: "800" },
  modalFolio: { color: T.gris, fontSize: 12, marginTop: 2 },
  evCab: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
  evCabTxt: { color: T.tinta, fontSize: 13, fontWeight: "600" },
  fotos: { flexDirection: "row", gap: 10, marginTop: 10 },
  foto: { flex: 1, aspectRatio: 0.85, borderRadius: 12, borderWidth: 1, borderColor: T.linea, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  fotoTag: { position: "absolute", top: 8, left: 8, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  fotoTagTxt: { color: "#fff", fontSize: 10, fontWeight: "700" },
  fotoHueco: { alignItems: "center", justifyContent: "center", gap: 2 },
  fotoEtq: { color: "rgba(255,255,255,0.72)", fontSize: 11, marginTop: 6 },
  fotoSello: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: "rgba(0,0,0,0.5)" },
  fotoSelloTxt: { color: "#fff", fontSize: 10, marginRight: 4 },
  evDatos: { marginTop: 14 },
  datoFila: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: T.linea },
  datoK: { color: T.gris, fontSize: 13 },
  datoV: { color: T.tinta, fontSize: 13, fontWeight: "600" },
  nota: { color: T.grisClaro, fontSize: 11.5, marginTop: 10 },
});
