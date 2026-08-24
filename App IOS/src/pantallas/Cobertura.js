import { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../tema";
import { Tarjeta, TituloTarjeta, EncabezadoPantalla } from "../ui";
import MapaWeb from "../MapaWeb";
import { nombreTipoRuta } from "../rutas-datos";
import { zonasDeCobertura } from "../datos-remoto";
import { rutasQueCubren } from "../punto-en-zona";

export default function Cobertura() {
  const [pin, setPin] = useState(null);
  const [rutas, setRutas] = useState([]);

  // Las zonas salen de la base: si Morcast redibuja una en su panel, el
  // cliente ve la nueva sin que nadie toque la app.
  //
  // Va por `zonasDeCobertura()` y no por `listarRutas()`: la segunda solo le
  // entrega al cliente SU ruta, y el mapa quedaba enseñando un pedazo de la
  // ciudad en vez de toda la cobertura.
  useEffect(() => {
    let vivo = true;
    zonasDeCobertura().then((l) => { if (vivo) setRutas(l); });
    return () => { vivo = false; };
  }, []);

  const zonas = useMemo(
    () =>
      rutas.filter((r) => r.activa).map((r) => ({
        id: r.id,
        nombre: `${r.nombre} · ${nombreTipoRuta(r.tipo)}`,
        poligono: r.zona,
      })),
    [rutas]
  );

  const cubren = useMemo(() => (pin ? rutasQueCubren(pin, rutas) : []), [pin, rutas]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.fondo }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
    >
      <EncabezadoPantalla
        titulo="Cobertura"
        sub="Marca dónde está tu domicilio y te decimos si ya pasamos por ahí."
      />

      <Tarjeta>
        <TituloTarjeta>Mapa de rutas</TituloTarjeta>
        <MapaWeb zonas={zonas} pin={pin} onPin={setPin} alto={330} />
        <View style={s.nota}>
          <Feather name="map-pin" size={13} color={T.gris} />
          <Text style={s.notaTxt}>Toca el mapa para colocar tu domicilio.</Text>
        </View>
      </Tarjeta>

      <Tarjeta>
        <TituloTarjeta>Tu zona</TituloTarjeta>

        {!pin && (
          <Text style={s.vacio}>
            Coloca tu domicilio en el mapa para revisar la cobertura.
          </Text>
        )}

        {pin && cubren.length > 0 && (
          <>
            <View style={s.avisoFila}>
              <Feather name="check-circle" size={16} color={T.verdeClaro} />
              <Text style={[s.aviso, { color: T.verdeClaro }]}>Sí llegamos a tu zona</Text>
            </View>
            {cubren.map((r) => (
              <View key={r.id} style={s.ruta}>
                <Text style={s.rutaNombre}>{r.nombre}</Text>
                <Text style={s.rutaDato}>{nombreTipoRuta(r.tipo)}</Text>
                <Text style={s.rutaDato}>Pasa: {r.dias.join(", ")}</Text>
              </View>
            ))}
          </>
        )}

        {pin && cubren.length === 0 && (
          <>
            <View style={s.avisoFila}>
              <Feather name="alert-circle" size={16} color={T.naranjaClaro} />
              <Text style={[s.aviso, { color: T.naranjaClaro }]}>Todavía no llegamos ahí</Text>
            </View>
            <Text style={s.vacio}>
              Tu domicilio queda fuera de las rutas actuales. Háblanos y evaluamos abrir
              una ruta nueva en tu zona.
            </Text>
          </>
        )}
      </Tarjeta>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  nota: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  notaTxt: { color: T.gris, fontSize: 12 },
  vacio: { color: T.gris, fontSize: 13, lineHeight: 19 },
  avisoFila: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 6 },
  aviso: { fontSize: 14, fontWeight: "700" },
  ruta: { borderTopWidth: 1, borderTopColor: T.linea, paddingTop: 10, marginTop: 10 },
  rutaNombre: { color: T.tinta, fontSize: 14.5, fontWeight: "700" },
  rutaDato: { color: T.gris, fontSize: 12.5, marginTop: 3 },
});
