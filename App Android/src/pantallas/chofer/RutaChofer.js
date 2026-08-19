import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Modal, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { T } from "../../tema";
import { Tarjeta, Badge } from "../../ui";
import { CHOFER_PERFIL } from "../../datos-chofer";

export default function RutaChofer({ navigation, ruta, onLogout }) {
  const [verComp, setVerComp] = useState(null);
  const pendientes = ruta.filter((s) => s.estatus === "pendiente");
  const completados = ruta.filter((s) => s.estatus === "completado");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.fondo }} edges={["top"]}>
      {/* Barra superior */}
      <View style={s.topbar}>
        <View style={{ flex: 1 }}>
          <Text style={s.hola}>Hola, {CHOFER_PERFIL.nombre.split(" ")[0]}</Text>
          <Text style={s.unidad}>Unidad {CHOFER_PERFIL.unidad}</Text>
        </View>
        <Pressable onPress={onLogout} hitSlop={10} style={s.salir}><Feather name="log-out" size={18} color={T.gris} /></Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {/* Resumen */}
        <View style={s.resumen}>
          <View style={s.resItem}><Text style={s.resNum}>{pendientes.length}</Text><Text style={s.resLbl}>Pendientes</Text></View>
          <View style={s.resDiv} />
          <View style={s.resItem}><Text style={[s.resNum, { color: T.verdeClaro }]}>{completados.length}</Text><Text style={s.resLbl}>Completados</Text></View>
          <View style={s.resDiv} />
          <View style={s.resItem}><Text style={s.resNum}>{ruta.length}</Text><Text style={s.resLbl}>Total hoy</Text></View>
        </View>

        <Text style={s.seccion}>Por recolectar</Text>
        {pendientes.length === 0 ? (
          <Tarjeta><Text style={s.vacio}>¡Ruta completada! No quedan servicios pendientes. 🎉</Text></Tarjeta>
        ) : pendientes.map((sv) => (
          <Pressable key={sv.folio} onPress={() => navigation.navigate("Recoleccion", { servicio: sv })}>
            <Tarjeta style={{ padding: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={s.hora}><Text style={s.horaTxt}>{sv.hora}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cliente}>{sv.cliente}</Text>
                  <Text style={s.dir}><Feather name="map-pin" size={11} color={T.gris} /> {sv.direccion}</Text>
                  <Text style={s.cont}>{sv.contenedor} · {sv.tipo}</Text>
                </View>
                <Feather name="chevron-right" size={20} color={T.gris} />
              </View>
              <View style={s.scanHint}><Feather name="maximize" size={13} color={T.tealClaro} /><Text style={s.scanHintTxt}>Toca para escanear el QR y recolectar</Text></View>
            </Tarjeta>
          </Pressable>
        ))}

        {completados.length > 0 && (
          <>
            <Text style={s.seccion}>Completados hoy</Text>
            {completados.map((sv) => (
              <Pressable key={sv.folio} onPress={() => setVerComp(sv)}>
                <Tarjeta style={{ padding: 14 }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={[s.hora, { backgroundColor: "rgba(78,179,74,0.14)" }]}><Feather name="check" size={16} color={T.verdeClaro} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cliente}>{sv.cliente}</Text>
                      <Text style={s.cont}>{sv.contenedor}{sv.evidencia?.peso ? ` · ${sv.evidencia.peso}` : ""}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 6 }}>
                      <Badge clase="ok">Recolectado</Badge>
                      <Text style={s.verFotos}><Feather name="camera" size={11} color={T.tealClaro} /> Ver fotos</Text>
                    </View>
                  </View>
                </Tarjeta>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>

      {/* Detalle de servicio completado — comprobante fotográfico */}
      <Modal visible={!!verComp} animationType="slide" transparent onRequestClose={() => setVerComp(null)}>
        <View style={s.modalFondo}>
          <View style={s.modal}>
            {verComp && (
              <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 30 }}>
                <View style={s.modalCab}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.modalCli}>{verComp.cliente}</Text>
                    <Text style={s.modalFolio}>{verComp.folio} · {verComp.contenedor}</Text>
                  </View>
                  <Pressable onPress={() => setVerComp(null)} hitSlop={10}><Feather name="x" size={22} color={T.gris} /></Pressable>
                </View>

                <View style={s.evCab}><Feather name="camera" size={15} color={T.tealClaro} /><Text style={s.evCabTxt}>Comprobante de la recolección</Text></View>
                <View style={s.fotos}>
                  <FotoComp etiqueta="Antes" hora={verComp.evidencia?.horaAntes} uri={verComp.evidencia?.antes} color="#e0a94d" />
                  <FotoComp etiqueta="Después" hora={verComp.evidencia?.horaDespues} uri={verComp.evidencia?.despues} color={T.verdeClaro} />
                </View>

                <View style={s.evDatos}>
                  <Dato k="Peso recolectado" v={verComp.evidencia?.peso || "—"} />
                  <Dato k="Contenedor (QR)" v={verComp.evidencia?.qr || verComp.qr} />
                  <Dato k="Estatus" v="Recolectado ✓" ok />
                </View>
                <Text style={s.nota}>Este comprobante también lo ven el cliente y el administrador.</Text>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function FotoComp({ etiqueta, hora, uri, color }) {
  return (
    <View style={s.fotoBox}>
      <View style={[s.fotoTag, { backgroundColor: color }]}><Text style={s.fotoTagTxt}>{etiqueta}</Text></View>
      {uri ? (
        <Image source={{ uri }} style={s.fotoImg} resizeMode="cover" />
      ) : (
        <View style={s.fotoPlaceholder}><Feather name="camera" size={24} color={T.grisClaro} /><Text style={s.fotoPlTxt}>Foto registrada</Text></View>
      )}
      {hora ? <View style={s.fotoHora}><Feather name="clock" size={10} color="#fff" /><Text style={s.fotoHoraTxt}>{hora}</Text></View> : null}
    </View>
  );
}

function Dato({ k, v, ok }) {
  return <View style={s.datoFila}><Text style={s.datoK}>{k}</Text><Text style={[s.datoV, ok && { color: T.verdeClaro }]}>{v}</Text></View>;
}

const s = StyleSheet.create({
  topbar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: T.linea },
  hola: { color: T.tinta, fontSize: 18, fontWeight: "800" },
  unidad: { color: T.gris, fontSize: 12.5, marginTop: 1 },
  salir: { width: 40, height: 40, borderRadius: 10, backgroundColor: T.panel, alignItems: "center", justifyContent: "center" },
  resumen: { flexDirection: "row", backgroundColor: T.panel, borderWidth: 1, borderColor: T.linea, borderRadius: 14, paddingVertical: 14, marginBottom: 18 },
  resItem: { flex: 1, alignItems: "center" },
  resDiv: { width: 1, backgroundColor: T.linea },
  resNum: { color: T.tinta, fontSize: 22, fontWeight: "800" },
  resLbl: { color: T.gris, fontSize: 11.5, marginTop: 2 },
  seccion: { color: T.gris, fontSize: 11.5, letterSpacing: 0.05, textTransform: "uppercase", marginBottom: 8, marginTop: 6 },
  vacio: { color: T.gris, textAlign: "center", paddingVertical: 8, lineHeight: 20 },
  hora: { width: 52, height: 44, borderRadius: 10, backgroundColor: T.panel2, alignItems: "center", justifyContent: "center", marginRight: 12 },
  horaTxt: { color: T.tealClaro, fontSize: 13, fontWeight: "700" },
  cliente: { color: T.tinta, fontSize: 15, fontWeight: "700" },
  dir: { color: T.gris, fontSize: 12, marginTop: 2 },
  cont: { color: T.gris, fontSize: 12, marginTop: 2 },
  scanHint: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: T.linea },
  scanHintTxt: { color: T.tealClaro, fontSize: 12, fontWeight: "600" },
  verFotos: { color: T.tealClaro, fontSize: 11, fontWeight: "600" },
  modalFondo: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modal: { backgroundColor: T.fondo, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: "90%", borderWidth: 1, borderColor: T.linea },
  modalCab: { flexDirection: "row", alignItems: "center" },
  modalCli: { color: T.tinta, fontSize: 16, fontWeight: "800" },
  modalFolio: { color: T.gris, fontSize: 12, marginTop: 2 },
  evCab: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16 },
  evCabTxt: { color: T.tinta, fontSize: 13, fontWeight: "600" },
  fotos: { flexDirection: "row", gap: 10, marginTop: 10 },
  fotoBox: { flex: 1, aspectRatio: 0.82, borderRadius: 12, borderWidth: 1, borderColor: T.linea, overflow: "hidden", backgroundColor: "#0d1211" },
  fotoTag: { position: "absolute", top: 8, left: 8, zIndex: 2, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 2 },
  fotoTagTxt: { color: "#0d1211", fontSize: 10.5, fontWeight: "700" },
  fotoImg: { width: "100%", height: "100%" },
  fotoPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6 },
  fotoPlTxt: { color: T.grisClaro, fontSize: 11 },
  fotoHora: { position: "absolute", bottom: 8, left: 8, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  fotoHoraTxt: { color: "#fff", fontSize: 10.5 },
  evDatos: { marginTop: 16 },
  datoFila: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: T.linea },
  datoK: { color: T.gris, fontSize: 13 },
  datoV: { color: T.tinta, fontSize: 13, fontWeight: "600" },
  nota: { color: T.grisClaro, fontSize: 11.5, marginTop: 12 },
});
