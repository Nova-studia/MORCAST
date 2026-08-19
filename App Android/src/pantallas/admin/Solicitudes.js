import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Modal, TextInput, Linking } from "react-native";
import { Feather } from "@expo/vector-icons";
import { listarCotizaciones } from "../../datos-remoto";
import { T } from "../../tema";
import { Tarjeta, Badge, Boton } from "../../ui";
import { SOLICITUDES, ESTADOS_SOLICITUD, infoEstado, fechaLarga } from "../../datos-admin";

export default function Solicitudes() {
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    listarCotizaciones().then((l) => {
      if (!vivo) return;
      setLista(l);
      setCargando(false);
    });
    return () => { vivo = false; };
  }, []);
  const [filtro, setFiltro] = useState("todas");
  const [sel, setSel] = useState(null);
  const [act, setAct] = useState({}); // { [id]: {correo, password, activada} }

  const filas = lista.filter((x) => filtro === "todas" || x.estado === filtro).sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
  const conteo = (id) => (id === "todas" ? lista.length : lista.filter((x) => x.estado === id).length);

  const cambiar = (id, estado) => {
    setLista((l) => l.map((x) => (x.id === id ? { ...x, estado } : x)));
    setSel((x) => (x && x.id === id ? { ...x, estado } : x));
  };

  const a = sel ? (act[sel.id] || { correo: sel.correo, password: "", activada: false }) : null;
  const setA = (patch) => setAct((o) => ({ ...o, [sel.id]: { ...(o[sel.id] || { correo: sel.correo, password: "" }), ...patch } }));
  const genPass = () => {
    const c = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let p = ""; for (let i = 0; i < 10; i++) p += c[Math.floor(Math.random() * c.length)];
    setA({ password: p });
  };
  const abrir = (url) => Linking.openURL(url).catch(() => {});

  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.fondo }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text style={s.h1}>Solicitudes</Text>
      <Text style={s.sub}>Las solicitudes del formulario del sitio. Dales seguimiento hasta cerrarlas.</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }} contentContainerStyle={{ gap: 8 }}>
        <Chip on={filtro === "todas"} onPress={() => setFiltro("todas")}>Todas ({conteo("todas")})</Chip>
        {ESTADOS_SOLICITUD.map((e) => (
          <Chip key={e.id} on={filtro === e.id} onPress={() => setFiltro(e.id)}>{e.texto} ({conteo(e.id)})</Chip>
        ))}
      </ScrollView>

      {filas.map((x) => {
        const est = infoEstado(x.estado);
        return (
          <Pressable key={x.id} onPress={() => setSel(x)}>
            <Tarjeta style={{ padding: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.folio}>{x.id} · {fechaLarga(x.fecha)}</Text>
                  <Text style={s.empresa}>{x.empresa}</Text>
                  <Text style={s.serv}>{x.servicio}</Text>
                </View>
                <Badge clase={est.clase}>{est.texto}</Badge>
              </View>
            </Tarjeta>
          </Pressable>
        );
      })}

      {/* Modal de detalle */}
      <Modal visible={!!sel} animationType="slide" transparent onRequestClose={() => setSel(null)}>
        <View style={s.modalFondo}>
          <View style={s.modal}>
            {sel && (
              <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 30 }}>
                <View style={s.modalCab}>
                  <Text style={s.modalFolio}>{sel.id}</Text>
                  <Pressable onPress={() => setSel(null)} hitSlop={10}><Feather name="x" size={22} color={T.gris} /></Pressable>
                </View>
                <Text style={s.modalEmpresa}>{sel.empresa}</Text>
                <Text style={s.modalNombre}>{sel.nombre}</Text>

                <View style={{ gap: 8, marginTop: 12 }}>
                  <Pressable style={s.contacto} onPress={() => abrir(`mailto:${sel.correo}`)}><Feather name="mail" size={15} color={T.tinta} /><Text style={s.contactoTxt}>{sel.correo}</Text></Pressable>
                  <Pressable style={s.contacto} onPress={() => abrir(`tel:+52${sel.telefono.replace(/\s/g, "")}`)}><Feather name="phone" size={15} color={T.tinta} /><Text style={s.contactoTxt}>{sel.telefono}</Text></Pressable>
                  <Pressable style={[s.contacto, { backgroundColor: T.verde, borderColor: T.verde }]} onPress={() => abrir(`https://wa.me/52${sel.telefono.replace(/\s/g, "")}?text=${encodeURIComponent(`Hola ${sel.nombre}, le escribimos de Morcast del Norte sobre su solicitud ${sel.id}.`)}`)}>
                    <Feather name="message-square" size={15} color="#0d1211" /><Text style={[s.contactoTxt, { color: "#0d1211", fontWeight: "700" }]}>Contactar por WhatsApp</Text>
                  </Pressable>
                </View>

                <View style={s.mensaje}><Text style={s.mensajeLbl}>MENSAJE</Text><Text style={s.mensajeTxt}>{sel.mensaje}</Text></View>
                <View style={s.datos}>
                  <Text style={s.datoK}>Servicio: <Text style={s.datoV}>{sel.servicio}</Text></Text>
                  <Text style={s.datoK}>Frecuencia: <Text style={s.datoV}>{sel.frecuencia}</Text></Text>
                </View>

                <Text style={s.seccion}>Cambiar estado</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 6 }}>
                  {ESTADOS_SOLICITUD.map((e) => (
                    <Pressable key={e.id} onPress={() => cambiar(sel.id, e.id)} style={[s.estChip, sel.estado === e.id && s.estChipOn]}>
                      <Text style={[s.estChipTxt, sel.estado === e.id && { color: "#0d1211" }]}>{e.texto}</Text>
                    </Pressable>
                  ))}
                </View>

                {/* Activar cuenta (solo si ganada) */}
                {sel.estado === "ganada" && (
                  <View style={s.activar}>
                    {a.activada ? (
                      <>
                        <View style={s.actOk}><Feather name="check-circle" size={16} color={T.verdeClaro} /><Text style={s.actOkTxt}>Cuenta de cliente activada</Text></View>
                        <Text style={s.actP}>Envíale estas credenciales:</Text>
                        <View style={s.cred}><Text style={s.credK}>Correo</Text><Text style={s.credV}>{a.correo}</Text></View>
                        <View style={s.cred}><Text style={s.credK}>Contraseña</Text><Text style={s.credV}>{a.password}</Text></View>
                        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                          <Boton onPress={() => abrir(`https://wa.me/52${sel.telefono.replace(/\s/g, "")}?text=${encodeURIComponent(`Hola ${sel.nombre}, su cuenta del Portal de Clientes de Morcast ya está activa.\nCorreo: ${a.correo}\nContraseña: ${a.password}`)}`)} style={{ flex: 1 }}>WhatsApp</Boton>
                          <Boton variante="linea" onPress={() => abrir(`mailto:${a.correo}?subject=Acceso%20a%20su%20Portal&body=${encodeURIComponent(`Correo: ${a.correo}\nContraseña: ${a.password}`)}`)} style={{ flex: 1 }}>Correo</Boton>
                        </View>
                      </>
                    ) : (
                      <>
                        <View style={s.actTit}><Feather name="user-check" size={16} color={T.verdeClaro} /><Text style={s.actTitTxt}>Activar cuenta de cliente</Text></View>
                        <Text style={s.actP}>Genera el acceso al portal para {sel.empresa}.</Text>
                        <Text style={s.label}>Correo de acceso</Text>
                        <TextInput style={s.input} autoCapitalize="none" value={a.correo} onChangeText={(v) => setA({ correo: v })} />
                        <Text style={s.label}>Contraseña</Text>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <TextInput style={[s.input, { flex: 1 }]} value={a.password} placeholder="Genera o escribe" placeholderTextColor={T.grisClaro} onChangeText={(v) => setA({ password: v })} />
                          <Pressable style={s.gen} onPress={genPass}><Feather name="refresh-cw" size={15} color={T.tinta} /><Text style={s.genTxt}>Generar</Text></Pressable>
                        </View>
                        <Boton onPress={() => setA({ activada: true })} disabled={!a.correo || !a.password} style={{ marginTop: 12 }}>
                          <Feather name="key" size={15} color="#0d1211" /><Text style={{ color: "#0d1211", fontWeight: "700" }}>  Activar cuenta</Text>
                        </Boton>
                        <Text style={s.actNota}>La empresa envía estas credenciales al cliente por WhatsApp o correo.</Text>
                      </>
                    )}
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function Chip({ on, onPress, children }) {
  return (
    <Pressable onPress={onPress} style={[cs.chip, on && cs.on]}><Text style={[cs.txt, on && cs.txtOn]}>{children}</Text></Pressable>
  );
}
const cs = StyleSheet.create({
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: T.linea, backgroundColor: T.panel },
  on: { backgroundColor: T.naranja, borderColor: T.naranja },
  txt: { color: T.gris, fontSize: 12.5, fontWeight: "600" },
  txtOn: { color: "#0d1211" },
});

const s = StyleSheet.create({
  h1: { color: T.tinta, fontSize: 22, fontWeight: "800" },
  sub: { color: T.gris, fontSize: 13.5, marginTop: 3, marginBottom: 14, lineHeight: 19 },
  folio: { color: T.gris, fontSize: 11.5 },
  empresa: { color: T.tinta, fontSize: 15, fontWeight: "700", marginTop: 3 },
  serv: { color: T.gris, fontSize: 12.5, marginTop: 2 },
  modalFondo: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modal: { backgroundColor: T.fondo, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: "92%", borderWidth: 1, borderColor: T.linea },
  modalCab: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalFolio: { color: T.gris, fontSize: 13, fontWeight: "700" },
  modalEmpresa: { color: T.tinta, fontSize: 19, fontWeight: "800", marginTop: 6 },
  modalNombre: { color: T.gris, fontSize: 13.5, marginTop: 2 },
  contacto: { flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: T.panel, borderWidth: 1, borderColor: T.linea, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 13 },
  contactoTxt: { color: T.tinta, fontSize: 13.5 },
  mensaje: { backgroundColor: T.panel, borderWidth: 1, borderColor: T.linea, borderRadius: 10, padding: 12, marginTop: 14 },
  mensajeLbl: { color: T.gris, fontSize: 10, letterSpacing: 0.05, marginBottom: 4 },
  mensajeTxt: { color: T.tinta, fontSize: 13.5, lineHeight: 19 },
  datos: { marginTop: 10, gap: 3 },
  datoK: { color: T.gris, fontSize: 13 },
  datoV: { color: T.tinta, fontWeight: "600" },
  seccion: { color: T.gris, fontSize: 11, letterSpacing: 0.05, marginTop: 16, textTransform: "uppercase" },
  estChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9, borderWidth: 1, borderColor: T.linea, backgroundColor: T.panel },
  estChipOn: { backgroundColor: T.verde, borderColor: T.verde },
  estChipTxt: { color: T.gris, fontSize: 12.5, fontWeight: "600" },
  activar: { marginTop: 16, backgroundColor: "rgba(78,179,74,0.08)", borderWidth: 1, borderColor: "rgba(78,179,74,0.3)", borderRadius: 12, padding: 13 },
  actTit: { flexDirection: "row", alignItems: "center", gap: 7 },
  actTitTxt: { color: T.tinta, fontSize: 14.5, fontWeight: "700" },
  actOk: { flexDirection: "row", alignItems: "center", gap: 7 },
  actOkTxt: { color: T.verdeClaro, fontSize: 14.5, fontWeight: "700" },
  actP: { color: T.gris, fontSize: 12.5, marginTop: 5, marginBottom: 6 },
  label: { color: T.tinta, fontSize: 12.5, fontWeight: "700", marginTop: 10, marginBottom: 6 },
  input: { backgroundColor: T.panel2, borderWidth: 1, borderColor: T.linea, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, color: T.tinta, fontSize: 14 },
  gen: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: T.panel, borderWidth: 1, borderColor: T.linea, borderRadius: 10, paddingHorizontal: 12 },
  genTxt: { color: T.tinta, fontSize: 12.5, fontWeight: "600" },
  actNota: { color: T.grisClaro, fontSize: 11, marginTop: 8 },
  cred: { flexDirection: "row", justifyContent: "space-between", backgroundColor: T.panel, borderWidth: 1, borderColor: T.linea, borderRadius: 9, paddingVertical: 9, paddingHorizontal: 11, marginBottom: 5 },
  credK: { color: T.gris, fontSize: 12.5 },
  credV: { color: T.tinta, fontSize: 13.5, fontWeight: "700" },
});
