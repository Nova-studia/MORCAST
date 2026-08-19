import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Alert, Image } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../tema";
import { Tarjeta, TituloTarjeta, Boton } from "../ui";
import { CATALOGO_COTIZADOR, IVA, CLIENTE, pesos } from "../datos";
import ICONOS from "../iconos";
import { descargarCotizacion, descargarConstancia } from "../pdf";
import { CONDICIONES_COMERCIALES, COBERTURA, HORARIOS } from "../cotizacion-datos";

export default function Cotizador() {
  const [cant, setCant] = useState({}); // { id: n }
  const [bajando, setBajando] = useState("");

  const set = (id, delta) => setCant((c) => ({ ...c, [id]: Math.max(0, (c[id] || 0) + delta) }));

  const items = CATALOGO_COTIZADOR.filter((x) => (cant[x.id] || 0) > 0).map((x) => ({ ...x, cant: cant[x.id] }));
  const subtotal = items.reduce((a, it) => a + it.precio * it.cant, 0);
  const iva = subtotal * IVA;
  const total = subtotal + iva;

  const bajarCotizacion = async () => {
    if (items.length === 0) return;
    setBajando("cot");
    try { await descargarCotizacion(items, CLIENTE); }
    catch (e) { Alert.alert("Error", String(e?.message || e)); }
    finally { setBajando(""); }
  };
  const bajarConstancia = async () => {
    setBajando("csf");
    try { await descargarConstancia(); }
    catch (e) { Alert.alert("Error", String(e?.message || e)); }
    finally { setBajando(""); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.fondo }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text style={s.h1}>Cotizador</Text>
      <Text style={s.sub}>Arma tu cotización y descárgala en PDF. Precios de referencia.</Text>

      <Tarjeta>
        <TituloTarjeta>Servicios</TituloTarjeta>
        {CATALOGO_COTIZADOR.map((x, i) => {
          const n = cant[x.id] || 0;
          return (
            <View key={x.id} style={[s.item, i < CATALOGO_COTIZADOR.length - 1 && s.borde]}>
              {x.icono && ICONOS[x.icono] && (
                <View style={s.iconoCaja}>
                  <Image source={ICONOS[x.icono]} style={s.icono} resizeMode="contain" />
                </View>
              )}
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={s.itemTit}>{x.servicio}</Text>
                <Text style={s.itemSub}>{pesos(x.precio)} · {x.unidad}</Text>
              </View>
              <View style={s.stepper}>
                <Pressable onPress={() => set(x.id, -1)} style={s.step}><Feather name="minus" size={16} color={n > 0 ? T.tinta : T.grisClaro} /></Pressable>
                <Text style={s.cant}>{n}</Text>
                <Pressable onPress={() => set(x.id, 1)} style={s.step}><Feather name="plus" size={16} color={T.verde} /></Pressable>
              </View>
            </View>
          );
        })}
      </Tarjeta>

      {/* Resumen */}
      <Tarjeta>
        <TituloTarjeta>Resumen</TituloTarjeta>
        {items.length === 0 ? (
          <Text style={s.vacio}>Agrega servicios con el botón +.</Text>
        ) : (
          <>
            {items.map((it) => (
              <View key={it.id} style={s.resFila}>
                <Text style={s.resTxt} numberOfLines={1}>{it.cant}× {it.servicio}</Text>
                <Text style={s.resMonto}>{pesos(it.precio * it.cant)}</Text>
              </View>
            ))}
            <View style={s.sep} />
            <View style={s.totFila}><Text style={s.totK}>Subtotal</Text><Text style={s.totV}>{pesos(subtotal)}</Text></View>
            <View style={s.totFila}><Text style={s.totK}>IVA (16%)</Text><Text style={s.totV}>{pesos(iva)}</Text></View>
            <View style={s.totFila}><Text style={s.totKg}>Total</Text><Text style={s.totVg}>{pesos(total)}</Text></View>

            <Boton onPress={bajarCotizacion} disabled={bajando === "cot"} style={{ marginTop: 14 }}>
              <Feather name="download" size={16} color="#0d1211" />
              <Text style={{ color: "#0d1211", fontWeight: "700" }}>  {bajando === "cot" ? "Generando…" : "Descargar cotización PDF"}</Text>
            </Boton>
          </>
        )}
        <Boton variante="linea" onPress={bajarConstancia} disabled={bajando === "csf"} style={{ marginTop: 10 }}>
          <Feather name="file-text" size={15} color={T.tinta} />
          <Text style={{ color: T.tinta, fontWeight: "700" }}>  {bajando === "csf" ? "Generando…" : "Constancia fiscal PDF"}</Text>
        </Boton>
      </Tarjeta>

      {/* Condiciones comerciales (mismas que imprime el PDF) */}
      <Tarjeta>
        <TituloTarjeta>Condiciones comerciales</TituloTarjeta>
        {CONDICIONES_COMERCIALES.lista.map((c) => (
          <View key={c} style={s.condFila}>
            <Text style={s.condPunto}>•</Text>
            <Text style={s.condTxt}>{c}</Text>
          </View>
        ))}
        <Text style={s.condPie}>
          Cobertura: {COBERTURA}. Recolecciones {HORARIOS.recolecciones.toLowerCase()}.
        </Text>
      </Tarjeta>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  h1: { color: T.tinta, fontSize: 22, fontWeight: "800" },
  sub: { color: T.gris, fontSize: 13.5, marginTop: 3, marginBottom: 14 },
  item: { flexDirection: "row", alignItems: "center", paddingVertical: 11 },
  borde: { borderBottomWidth: 1, borderBottomColor: T.linea },
  iconoCaja: { width: 40, height: 40, borderRadius: 10, backgroundColor: "rgba(78,179,74,0.10)", alignItems: "center", justifyContent: "center", marginRight: 11 },
  icono: { width: 26, height: 26 },
  itemTit: { color: T.tinta, fontSize: 14, fontWeight: "600" },
  itemSub: { color: T.gris, fontSize: 12, marginTop: 2 },
  stepper: { flexDirection: "row", alignItems: "center", backgroundColor: T.panel2, borderRadius: 10, borderWidth: 1, borderColor: T.linea },
  step: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  cant: { color: T.tinta, fontSize: 15, fontWeight: "700", minWidth: 22, textAlign: "center" },
  vacio: { color: T.gris, textAlign: "center", paddingVertical: 14 },
  resFila: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, gap: 10 },
  resTxt: { color: T.tinta, fontSize: 13, flex: 1 },
  resMonto: { color: T.tinta, fontSize: 13, fontWeight: "600" },
  sep: { height: 1, backgroundColor: T.linea, marginVertical: 8 },
  condFila: { flexDirection: "row", paddingVertical: 4 },
  condPunto: { color: T.verde, fontSize: 13, width: 14 },
  condTxt: { color: T.gris, fontSize: 12.5, flex: 1, lineHeight: 18 },
  condPie: { color: T.gris, fontSize: 12.5, marginTop: 8, lineHeight: 18 },
  totFila: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totK: { color: T.gris, fontSize: 13.5 },
  totV: { color: T.tinta, fontSize: 13.5, fontWeight: "600" },
  totKg: { color: T.tinta, fontSize: 16, fontWeight: "800", marginTop: 4 },
  totVg: { color: T.verdeClaro, fontSize: 16, fontWeight: "800", marginTop: 4 },
});
