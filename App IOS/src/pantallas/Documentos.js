import { useCallback, useRef, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Alert, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { T } from "../tema";
import { Tarjeta, TituloTarjeta } from "../ui";
import { SERVICIOS_CLIENTE, fechaLarga, HAY_DATOS_FISCALES } from "../datos";
import { leerMisServicios } from "../datos-remoto";
import { haySupabase } from "../supabase";
import { useMiEmpresa, avisoSinEmpresa } from "../mi-empresa";
import { descargarManifiesto, descargarConstancia } from "../pdf";

export default function Documentos() {
  const [bajando, setBajando] = useState(null);
  const [servicios, setServicios] = useState(null);
  const { empresa, puedeImprimir, cargando } = useMiEmpresa();

  // "No se pudo leer" no es "no hay manifiestos" (6-oct-2026).
  const [error, setError] = useState("");
  const [refrescando, setRefrescando] = useState(false);
  const turno = useRef(0);

  // Se relee cada vez que se vuelve a esta pantalla: un servicio recién
  // completado trae su manifiesto, y antes no aparecía hasta cerrar la app.
  // Sin fotos: aquí no se enseñan.
  const leer = useCallback(async () => {
    const n = ++turno.current;
    const r = await leerMisServicios({ conFotos: false });
    if (n !== turno.current) return;
    if (r.ok) { setServicios(r.servicios); setError(""); }
    else setError(r.motivo || "No pudimos leer tus servicios.");
  }, []);
  useFocusEffect(useCallback(() => { leer(); }, [leer]));

  const refrescar = async () => {
    setRefrescando(true);
    try { await leer(); } finally { setRefrescando(false); }
  };

  // Con base conectada la lista es la REAL aunque venga vacía. Antes, si el
  // cliente no tenía servicios, se le enseñaban los de ejemplo (folios
  // SRV-2026-07xx, chofer "J. Medina"): una empresa recién dada de alta veía
  // recolecciones que nunca le hicieron. Los de ejemplo sólo valen sin base.
  const cargandoLista = haySupabase() && servicios === null && !error;
  const sinLeer = haySupabase() && servicios === null && !!error;
  const lista = servicios || (haySupabase() ? [] : SERVICIOS_CLIENTE);
  const manifiestos = lista.filter((x) => x.manifiesto);

  const conConstancia = async () => {
    setBajando("csf");
    try { await descargarConstancia(); }
    catch (e) { Alert.alert("Error", String(e?.message || e)); }
    finally { setBajando(null); }
  };
  const conManifiesto = async (x) => {
    if (!puedeImprimir) {
      const [t, m] = avisoSinEmpresa(cargando);
      Alert.alert(t, m);
      return;
    }
    setBajando(x.folio);
    try { await descargarManifiesto(x, empresa); }
    catch (e) { Alert.alert("Error", String(e?.message || e)); }
    finally { setBajando(null); }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.fondo }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={haySupabase() ? <RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={T.gris} /> : undefined}
    >
      <Text style={s.h1}>Documentos</Text>
      <Text style={s.sub}>
        {HAY_DATOS_FISCALES
          ? "Descarga tu constancia fiscal y los manifiestos de cada servicio."
          : "Descarga el manifiesto de cada servicio en PDF."}
      </Text>

      {/* La constancia sólo se ofrece con el RFC real de Morcast cargado
          (`EMPRESA_COTIZACION.rfc`). Sin él, el botón SIEMPRE fallaba con
          "Todavía no tenemos la constancia…": un botón que nunca funciona es
          justo lo que la revisión de Apple rechaza (guía 2.1). Al cargar el
          RFC la tarjeta vuelve sola. */}
      {HAY_DATOS_FISCALES && (
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
      )}

      <Tarjeta>
        <TituloTarjeta>Manifiestos{cargandoLista || sinLeer ? "" : ` (${manifiestos.length})`}</TituloTarjeta>
        {error ? (
          <View style={s.error} accessibilityLiveRegion="polite">
            <Text style={s.errorTxt}>{sinLeer ? error : "No se pudo actualizar. Lo que ves puede no estar al día."}</Text>
            <Pressable onPress={refrescar} style={s.reintentar} accessibilityRole="button" hitSlop={6}>
              <Feather name="refresh-cw" size={14} color={T.tinta} />
              <Text style={s.reintentarTxt}>Reintentar</Text>
            </Pressable>
          </View>
        ) : null}
        {manifiestos.length === 0 && !sinLeer && (
          <Text style={s.vacio}>
            {cargandoLista
              ? "Leyendo tus servicios…"
              : "Todavía no hay manifiestos. Se genera uno por cada recolección completada."}
          </Text>
        )}
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
  vacio: { color: T.gris, fontSize: 13, lineHeight: 19, paddingVertical: 6 },
  error: { padding: 11, borderRadius: 10, marginBottom: 6, backgroundColor: "rgba(217,119,107,0.10)", borderWidth: 1, borderColor: "rgba(217,119,107,0.35)" },
  errorTxt: { color: T.tinta, fontSize: 13, lineHeight: 18 },
  reintentar: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, borderColor: T.linea, backgroundColor: T.panel, minHeight: 40 },
  reintentarTxt: { color: T.tinta, fontSize: 13, fontWeight: "700" },
});
