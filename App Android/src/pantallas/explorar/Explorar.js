import { View, Text, ScrollView, Pressable, Image, StyleSheet, Linking, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../../tema";
import { Tarjeta, TituloTarjeta, Boton } from "../../ui";
import ICONOS from "../../iconos";
import { EMPRESA_COTIZACION, EQUIPO_RENTA, HORARIOS } from "../../cotizacion-datos";
import { abrirWhatsApp } from "../../whatsapp";
import BarraVolver from "./BarraVolver";

/**
 * "EXPLORAR SIN CUENTA" — lo que la app ofrece a quien todavía no es cliente.
 *
 * Por qué existe: la app sale PÚBLICA en la App Store (decisión del
 * 1-oct-2026), y Apple rechaza las apps de negocio que fuera del login no
 * ofrecen nada (guía 3.2, "app para una empresa específica"). Aquí cualquier
 * empresa puede cotizar, revisar si hay servicio en su domicilio y contactar
 * a Morcast, igual que en morcast.mx.
 *
 * No toca la base ni pide permisos: el cuestionario sale por WhatsApp y el
 * mapa usa las zonas públicas (ver `zonasDeCobertura()`).
 */

// Lo que se recolecta, con los mismos nombres que la web. Los íconos son los
// de la web; los que no tienen ilustración van con un ícono de línea.
const SERVICIOS = [
  { titulo: "Residuos Sólidos Urbanos", icono: "residuos-solidos-urbanos" },
  { titulo: "Residuos de Manejo Especial", icono: "manejo-especial" },
  { titulo: "Residuos Peligrosos", nota: "Vía tercero autorizado", feather: "alert-triangle" },
  { titulo: "Aguas residuales", icono: "aguas-residuales" },
  { titulo: "Aguas oleosas", icono: "aguas-oleosas" },
  { titulo: "Reciclables", icono: "reciclaje" },
];

function Accion({ icono, titulo, sub, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.accion, pressed && { opacity: 0.8 }]} accessibilityRole="button">
      <View style={s.accionIcono}>
        <Feather name={icono} size={20} color={T.accionTxt} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.accionTit}>{titulo}</Text>
        <Text style={s.accionSub}>{sub}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={T.grisClaro} />
    </Pressable>
  );
}

export default function Explorar({ navigation }) {
  const telefono = EMPRESA_COTIZACION.telefonos[0];

  const llamar = () =>
    Linking.openURL(`tel:${telefono.replace(/\D/g, "")}`).catch(() =>
      Alert.alert("No se pudo llamar", `Márcanos al ${telefono}.`)
    );

  const abrirSitio = () =>
    Linking.openURL(EMPRESA_COTIZACION.sitio).catch(() =>
      Alert.alert("No se pudo abrir", EMPRESA_COTIZACION.sitio)
    );

  const escribir = () =>
    abrirWhatsApp(telefono, "Hola, me interesa el servicio de recolección de residuos de Morcast.");

  return (
    <View style={{ flex: 1, backgroundColor: T.fondo }}>
      <BarraVolver navigation={navigation} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 36 }}>
        <View style={s.hero}>
          <Image source={require("../../../assets/logo-morcast.png")} style={s.logo} resizeMode="contain" />
        </View>
        <Text style={s.h1}>Conoce Morcast del Norte</Text>
        <Text style={s.p}>
          Recolección y manejo de residuos para empresas en Matamoros, Tamaulipas.
          Cotiza y revisa si llegamos a tu domicilio sin crear una cuenta.
        </Text>

        <Accion
          icono="file-text"
          titulo="Cotiza tu servicio"
          sub="Cuéntanos qué residuos generas y te contestamos por WhatsApp."
          onPress={() => navigation.navigate("ExplorarCotizar")}
        />
        <Accion
          icono="map-pin"
          titulo="¿Llegamos a tu domicilio?"
          sub="Márcalo en el mapa y te decimos si hay servicio."
          onPress={() => navigation.navigate("ExplorarCobertura")}
        />
        <Accion icono="message-circle" titulo="Escríbenos por WhatsApp" sub={telefono} onPress={escribir} />
        <Accion icono="phone" titulo="Llámanos" sub={`${telefono} · ${HORARIOS.oficina}`} onPress={llamar} />

        <Tarjeta style={{ marginTop: 6 }}>
          <TituloTarjeta>Qué recolectamos</TituloTarjeta>
          {SERVICIOS.map((x, i) => (
            <View key={x.titulo} style={[s.servicio, i < SERVICIOS.length - 1 && s.borde]}>
              <View style={s.servicioIcono}>
                {x.icono && ICONOS[x.icono] ? (
                  <Image source={ICONOS[x.icono]} style={{ width: 24, height: 24 }} resizeMode="contain" />
                ) : (
                  <Feather name={x.feather || "circle"} size={18} color={T.verdeTxt} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.servicioTit}>{x.titulo}</Text>
                {x.nota ? <Text style={s.servicioNota}>{x.nota}</Text> : null}
              </View>
            </View>
          ))}
        </Tarjeta>

        <Tarjeta>
          <TituloTarjeta>Renta de equipo</TituloTarjeta>
          {EQUIPO_RENTA.map((e) => (
            <View key={e.tipo} style={s.fila}>
              <Text style={s.filaK}>{e.tipo}</Text>
              <Text style={s.filaV}>{e.medidas.join(" · ")}</Text>
            </View>
          ))}
        </Tarjeta>

        <Tarjeta>
          <TituloTarjeta>Horarios</TituloTarjeta>
          <View style={s.fila}><Text style={s.filaK}>Oficina</Text><Text style={s.filaV}>{HORARIOS.oficina}</Text></View>
          <View style={s.fila}><Text style={s.filaK}>Recolecciones</Text><Text style={s.filaV}>{HORARIOS.recolecciones}</Text></View>
          <View style={s.fila}><Text style={s.filaK}>Emergencias</Text><Text style={s.filaV}>{HORARIOS.emergencias}</Text></View>
        </Tarjeta>

        <Pressable onPress={abrirSitio} style={s.sitio} accessibilityRole="link">
          <Feather name="globe" size={15} color={T.accionTxt} />
          <Text style={s.sitioTxt}>morcast.mx</Text>
        </Pressable>

        <Text style={s.yaCliente}>¿Ya eres cliente?</Text>
        <Boton variante="linea" onPress={() => navigation.goBack()}>
          Entrar al portal
        </Boton>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  hero: { alignItems: "center", marginTop: 6, marginBottom: 18 },
  logo: { width: 190, height: 80 },
  h1: { color: T.tinta, fontSize: 24, fontWeight: "800", letterSpacing: -0.4 },
  p: { color: T.gris, fontSize: 14, marginTop: 6, marginBottom: 18, lineHeight: 20 },
  accion: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: T.panel, borderWidth: 1, borderColor: T.linea, borderRadius: 14,
    padding: 14, marginBottom: 10,
  },
  accionIcono: { width: 40, height: 40, borderRadius: 10, backgroundColor: T.accionTinte, alignItems: "center", justifyContent: "center" },
  accionTit: { color: T.tinta, fontSize: 15, fontWeight: "700" },
  accionSub: { color: T.gris, fontSize: 12.5, marginTop: 2, lineHeight: 17 },
  servicio: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  borde: { borderBottomWidth: 1, borderBottomColor: T.linea },
  servicioIcono: { width: 36, height: 36, borderRadius: 9, backgroundColor: "rgba(78,179,74,0.10)", alignItems: "center", justifyContent: "center", marginRight: 11 },
  servicioTit: { color: T.tinta, fontSize: 14, fontWeight: "600" },
  servicioNota: { color: T.gris, fontSize: 12, marginTop: 2 },
  fila: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 5 },
  filaK: { color: T.gris, fontSize: 13.5 },
  filaV: { color: T.tinta, fontSize: 13.5, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  sitio: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 10 },
  sitioTxt: { color: T.accionTxt, fontSize: 14, fontWeight: "600" },
  yaCliente: { color: T.gris, fontSize: 13, textAlign: "center", marginTop: 14, marginBottom: 8 },
});
