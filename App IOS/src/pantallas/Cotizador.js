import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Alert, Image } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../tema";
import { Tarjeta, TituloTarjeta, Boton, AvisoPrecios } from "../ui";
import { CATALOGO_COTIZADOR, pesos, HAY_DATOS_FISCALES } from "../datos";
import { useMiEmpresa, avisoSinEmpresa } from "../mi-empresa";
import ICONOS from "../iconos";
import { descargarCotizacion, descargarConstancia } from "../pdf";
import { abrirWhatsApp } from "../whatsapp";
import { CONDICIONES_COMERCIALES, COBERTURA, HORARIOS, EMPRESA_COTIZACION } from "../cotizacion-datos";
import { enHold, HOLD } from "../estado-sistema";
import { usePrecios } from "../precios-servidor";
import { catalogoDe, lineasDeCotizador, cotizar } from "../precios-logica.mjs";
import { esCuentaDeMuestra } from "../cuenta-muestra";

export default function Cotizador() {
  const [cant, setCant] = useState({}); // { id: n }
  const [bajando, setBajando] = useState("");
  const { empresa, puedeImprimir, cargando } = useMiEmpresa();

  const set = (id, delta) => setCant((c) => ({ ...c, [id]: Math.max(0, (c[id] || 0) + delta) }));

  // Precios de la web (8-oct-2026): los del cliente, con su precio especial
  // si lo tiene; el IVA solo si requiere factura. La cuenta de revisión de
  // las tiendas es la ÚNICA que usa el catálogo de ejemplo.
  const precios = usePrecios();
  const { conceptos, requiereFactura } = catalogoDe({
    respuesta: precios,
    esMuestra: esCuentaDeMuestra(),
    catalogoMuestra: CATALOGO_COTIZADOR,
  });
  const iconoDe = Object.fromEntries(CATALOGO_COTIZADOR.map((x) => [x.id, x.icono]));
  const cuenta = cotizar(lineasDeCotizador(conceptos, cant), { requiereFactura });
  const items = cuenta.lineas.map((l) => ({
    id: l.conceptoId, servicio: l.nombre, unidad: l.unidad, precio: l.precio, cant: l.cantidad, importe: l.importe,
  }));
  const { subtotal, iva, total } = cuenta;

  const bajarCotizacion = async () => {
    if (items.length === 0) return;
    if (!puedeImprimir) {
      const [t, m] = avisoSinEmpresa(cargando);
      Alert.alert(t, m);
      return;
    }
    setBajando("cot");
    try { await descargarCotizacion(items, empresa, { requiereFactura }); }
    catch (e) { Alert.alert("Error", String(e?.message || e)); }
    finally { setBajando(""); }
  };
  // Sin precios que calcular, la cotizacion se pide por escrito. Se usa el
  // primer telefono de los datos oficiales, no uno escrito a mano aqui.
  const pedirCotizacion = () =>
    abrirWhatsApp(
      EMPRESA_COTIZACION.telefonos[0],
      "Hola, me gustaría una cotización de sus servicios de manejo de residuos."
    );

  const bajarConstancia = async () => {
    setBajando("csf");
    try { await descargarConstancia(); }
    catch (e) { Alert.alert("Error", String(e?.message || e)); }
    finally { setBajando(""); }
  };

  // MODO HOLD. Los doce precios del catálogo son los que se inventaron en
  // agosto para poder enseñar el flujo; el cuaderno de la empresa llegó sin
  // ninguno. Mientras eso siga así, el cotizador NO habla de dinero: la web
  // ya lo hacía desde el 1-sep y la app no, así que el mismo cliente veía
  // "todavía no se generan cobros" en una pantalla y un total en la otra.
  if (enHold()) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: T.fondo }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Text style={s.h1}>Cotizador</Text>
        {/* Aunque aquí no salga una cifra, lo que sigue es pedir una
            cotización: el aviso va desde ya, igual que en la web. */}
        <AvisoPrecios style={{ marginTop: 12 }} />
        <Tarjeta style={{ alignItems: "center", paddingVertical: 34 }}>
          <Feather name="file-text" size={34} color={T.grisClaro} />
          <Text style={s.holdTit}>{HOLD.titulo.toUpperCase()}</Text>
          <Text style={s.holdTxt}>
            Estamos afinando nuestra lista de precios. Mientras tanto,
            cotizamos por escrito: escríbenos y te contestamos con los montos
            de tus servicios.
          </Text>
          <Boton onPress={pedirCotizacion} style={{ marginTop: 16 }}>
            <Feather name="message-circle" size={16} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "700" }}>  Pedir una cotización</Text>
          </Boton>
        </Tarjeta>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.fondo }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text style={s.h1}>Cotizador</Text>
      <Text style={s.sub}>Arma tu cotización y descárgala en PDF. Precios de referencia.</Text>
      <AvisoPrecios />

      <Tarjeta>
        <TituloTarjeta>Servicios</TituloTarjeta>
        {conceptos.length === 0 && (
          <Text style={s.vacio}>Todavía no hay servicios con precio. Escríbenos y te cotizamos.</Text>
        )}
        {conceptos.map((x, i) => {
          const n = cant[x.id] || 0;
          // Sin precio no se cotiza: se dice, no se suma $0.
          const sinPrecio = x.precio == null;
          return (
            <View key={x.id} style={[s.item, i < conceptos.length - 1 && s.borde]}>
              {iconoDe[x.id] && ICONOS[iconoDe[x.id]] && (
                <View style={s.iconoCaja}>
                  <Image source={ICONOS[iconoDe[x.id]]} style={s.icono} resizeMode="contain" />
                </View>
              )}
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={s.itemTit}>{x.nombre}</Text>
                <Text style={s.itemSub}>{sinPrecio ? "Precio por confirmar" : pesos(x.precio)} · {x.unidad}</Text>
              </View>
              {!sinPrecio && <View style={s.stepper}>
                <Pressable onPress={() => set(x.id, -1)} style={s.step}><Feather name="minus" size={16} color={n > 0 ? T.tinta : T.grisClaro} /></Pressable>
                <Text style={s.cant}>{n}</Text>
                <Pressable onPress={() => set(x.id, 1)} style={s.step}><Feather name="plus" size={16} color={T.accionTxt} /></Pressable>
              </View>}
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
                <Text style={s.resMonto}>{pesos(it.importe)}</Text>
              </View>
            ))}
            <View style={s.sep} />
            <View style={s.totFila}><Text style={s.totK}>Subtotal</Text><Text style={s.totV}>{pesos(subtotal)}</Text></View>
            {requiereFactura ? (
              <View style={s.totFila}><Text style={s.totK}>IVA (16%)</Text><Text style={s.totV}>{pesos(iva)}</Text></View>
            ) : (
              <Text style={s.vacio}>Sin IVA: tu cuenta no requiere factura.</Text>
            )}
            <View style={s.totFila}><Text style={s.totKg}>Total</Text><Text style={s.totVg}>{pesos(total)}</Text></View>
            {/* Junto al total, que es la cifra que el cliente se lleva. */}
            <AvisoPrecios compacto />

            <Boton onPress={bajarCotizacion} disabled={bajando === "cot"} style={{ marginTop: 14 }}>
              <Feather name="download" size={16} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "700" }}>  {bajando === "cot" ? "Generando…" : "Descargar cotización PDF"}</Text>
            </Boton>
          </>
        )}
        {/* Sin el RFC real de Morcast la constancia no se puede emitir y el
            botón sólo daba error: se esconde hasta que se cargue (ver
            Documentos.js). */}
        {HAY_DATOS_FISCALES && (
          <Boton variante="linea" onPress={bajarConstancia} disabled={bajando === "csf"} style={{ marginTop: 10 }}>
            <Feather name="file-text" size={15} color={T.tinta} />
            <Text style={{ color: T.tinta, fontWeight: "700" }}>  {bajando === "csf" ? "Generando…" : "Constancia fiscal PDF"}</Text>
          </Boton>
        )}
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
  holdTit: { color: T.tinta, fontSize: 18, fontWeight: "600", letterSpacing: 1.2, marginTop: 14, textAlign: "center" },
  holdTxt: { color: T.gris, fontSize: 13.5, lineHeight: 20, textAlign: "center", marginTop: 8, paddingHorizontal: 6 },
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
  condPunto: { color: T.verdeTxt, fontSize: 13, width: 14 },
  condTxt: { color: T.gris, fontSize: 12.5, flex: 1, lineHeight: 18 },
  condPie: { color: T.gris, fontSize: 12.5, marginTop: 8, lineHeight: 18 },
  totFila: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totK: { color: T.gris, fontSize: 13.5 },
  totV: { color: T.tinta, fontSize: 13.5, fontWeight: "600" },
  totKg: { color: T.tinta, fontSize: 16, fontWeight: "800", marginTop: 4 },
  totVg: { color: T.verdeClaro, fontSize: 16, fontWeight: "800", marginTop: 4 },
});
