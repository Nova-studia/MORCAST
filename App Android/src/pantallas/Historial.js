import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Alert, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { T } from "../tema";
import { Tarjeta, Badge } from "../ui";
import { SERVICIOS_CLIENTE, fechaLarga, estatusInfo } from "../datos";
import { leerMisServicios } from "../datos-remoto";
import { haySupabase } from "../supabase";
import { useMiEmpresa, avisoSinEmpresa } from "../mi-empresa";
import { descargarManifiesto } from "../pdf";
import { textoNoProcedio } from "../solicitudes.js";
import FotosEvidencia from "../FotosEvidencia";
import { BandaSuspendido } from "../TarjetaSoporte";

const FILTROS = [
  { id: "todos", texto: "Todos" },
  { id: "completado", texto: "Completados" },
  { id: "programado", texto: "Programados" },
  { id: "en-ruta", texto: "En ruta" },
  // db/023: el chofer llegó y no se pudo recoger. Sin este filtro esas
  // visitas solo se veían en "Todos", con el texto crudo de la base.
  { id: "no-procedio", texto: "No procedió" },
];

export default function Historial({ route }) {
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
  // "No se pudo leer" NO es "no tienes servicios" (Luis, iPhone, 6-oct-2026:
  // con una recolección ya asignada la pestaña seguía diciendo "Todavía no
  // tienes servicios registrados").
  const [error, setError] = useState("");
  const [refrescando, setRefrescando] = useState(false);
  // Solo vale la respuesta de la ÚLTIMA lectura: si se vuelve a la pestaña
  // dos veces seguidas, una respuesta vieja no pisa a la nueva.
  const vuelta = useRef(0);

  // Se lee CADA VEZ que la pestaña vuelve a verse, no solo al montarse:
  // las pestañas se quedan montadas, y la lista era la de la primera vez.
  // Las fotos NO se firman aquí (caducan y serían dos llamadas por
  // servicio): las firma el comprobante al abrirse (`FotosEvidencia`).
  const leer = useCallback(async () => {
    const n = ++vuelta.current;
    const r = await leerMisServicios({ conFotos: false });
    if (n !== vuelta.current) return;
    if (r.ok) {
      setServicios(r.servicios);
      setError("");
    } else {
      // Si ya había lista, se queda la que había y se avisa arriba.
      setError(r.motivo || "No pudimos leer tus servicios.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      leer();
    }, [leer])
  );

  // Si se llega tocando la notificación de una recolección ("Vamos en
  // camino", "Recolección realizada"…; ver `push-destino.js`), la pestaña
  // puede llevar rato abierta con la lista vieja: se vuelve a leer, y en
  // "Todos" para que la recolección se vea sea cual sea su estado.
  const avisoRecoleccion = route?.params?.recoleccion;
  const avisoEvento = route?.params?.evento;
  useEffect(() => {
    if (!avisoRecoleccion) return;
    setFiltro("todos");
    leer();
  }, [avisoRecoleccion, avisoEvento, leer]);

  const refrescar = async () => {
    setRefrescando(true);
    try { await leer(); } finally { setRefrescando(false); }
  };

  const reintentar = async () => {
    setError("");
    if (servicios === null) await leer();
    else await refrescar();
  };

  // Con base conectada la lista es la REAL aunque venga vacía. Antes, si el
  // cliente no tenía servicios, se le enseñaban los de ejemplo (folios
  // SRV-2026-07xx, chofer "J. Medina"): una empresa recién dada de alta veía
  // recolecciones que nunca le hicieron. Los de ejemplo sólo valen sin base.
  const cargandoLista = haySupabase() && servicios === null && !error;
  const lista = servicios || (haySupabase() ? [] : SERVICIOS_CLIENTE);
  const sinLeer = haySupabase() && servicios === null && !!error;

  const filas = lista
    .filter((x) => filtro === "todos" || x.estatus === filtro)
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.fondo }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={haySupabase() ? <RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={T.gris} /> : undefined}
    >
      {/* Cuenta suspendida (apps al 100%): la banda roja, arriba de todo. */}
      <BandaSuspendido />
      <Text style={s.h1}>Historial de servicios</Text>
      <Text style={s.sub}>Consulta tus recolecciones y su comprobante.</Text>

      {error ? (
        <View style={s.error} accessibilityLiveRegion="polite">
          <Feather name="wifi-off" size={16} color={T.error} style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={s.errorTxt}>{sinLeer ? error : "No se pudo actualizar la lista. Lo que ves puede no estar al día."}</Text>
            <Pressable onPress={reintentar} style={s.reintentar} accessibilityRole="button" hitSlop={6}>
              <Feather name="refresh-cw" size={14} color={T.tinta} />
              <Text style={s.reintentarTxt}>Reintentar</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }} contentContainerStyle={{ gap: 8 }}>
        {FILTROS.map((f) => (
          <Pressable key={f.id} onPress={() => setFiltro(f.id)} style={[s.chip, filtro === f.id && s.chipOn]} accessibilityRole="button" accessibilityState={{ selected: filtro === f.id }}>
            <Text style={[s.chipTxt, filtro === f.id && s.chipTxtOn]}>{f.texto}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {filas.length === 0 && !sinLeer && (
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
        const ev = x.evidencia;
        return (
          <Tarjeta key={x.folio} style={{ padding: 0 }}>
            <Pressable onPress={() => setAbierto(open ? null : x.folio)} style={s.cab} accessibilityRole="button" accessibilityState={{ expanded: open }}>
              <View style={{ flex: 1 }}>
                <Text style={s.tipo}>{x.tipo}</Text>
                <Text style={s.folio}>{x.folio} · {fechaLarga(x.fecha)}</Text>
              </View>
              <Badge clase={est.clase}>{est.texto}</Badge>
              <Feather name={open ? "chevron-up" : "chevron-down"} size={18} color={T.gris} style={{ marginLeft: 8 }} />
            </Pressable>

            {/* Lo primero que se pregunta quien ve "No procedió": por qué, y
                si se le va a cobrar. Va a la vista, sin tener que abrir. */}
            {x.estatus === "no-procedio" && (
              <View style={s.noProc}>
                <Feather name="info" size={14} color={T.error} style={{ marginTop: 2 }} />
                <Text style={s.noProcTxt}>{textoNoProcedio(x)}</Text>
              </View>
            )}

            {open && (
              <View style={s.detalle}>
                <Dato k="Residuo" v={x.residuo} />
                <Dato k="Contenedor" v={x.contenedor} />
                {/* ESTIMADO: lo calcula el chofer, que no trae báscula. */}
                <Dato k="Peso estimado" v={x.peso} />
                {/* Quien la hizo, o a quien se le asignó: lo dice la web
                    (`/api/app/mis-choferes`), no el texto de la ruta. */}
                <Dato k={x.etiquetaOperador || "Chofer"} v={x.operador} />

                {/* El comprobante: antes y después, con hora y ubicación. */}
                {x.estatus === "completado" && ev ? (
                  <View style={{ marginTop: 10 }}>
                    <Text style={s.compTit}>Comprobante del servicio</Text>
                    <FotosEvidencia antes={ev.antes} despues={ev.despues} />
                    <Dato k="Ubicación" v={ev.gps || "Sin ubicación registrada"} />
                  </View>
                ) : null}

                {x.estatus === "no-procedio" ? (
                  <Text style={s.pend}>Sin manifiesto: no hubo recolección.</Text>
                ) : x.manifiesto ? (
                  <Pressable style={s.manif} onPress={() => bajarManifiesto(x)} disabled={bajando === x.folio} accessibilityRole="button">
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
  datoFila: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 5 },
  datoK: { color: T.gris, fontSize: 13 },
  datoV: { color: T.tinta, fontSize: 13, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  compTit: { color: T.tinta, fontSize: 13, fontWeight: "700", marginBottom: 8 },
  manif: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 8, backgroundColor: "rgba(78,179,74,0.1)", borderRadius: 9, paddingVertical: 9, paddingHorizontal: 11 },
  manifTxt: { color: T.verdeClaro, fontSize: 13, fontWeight: "600" },
  pend: { color: T.grisClaro, fontSize: 12.5, marginTop: 8 },
  vacio: { color: T.gris, textAlign: "center", paddingVertical: 24 },
  noProc: { flexDirection: "row", gap: 8, marginHorizontal: 16, marginBottom: 14, marginTop: -4, padding: 10, borderRadius: 9, backgroundColor: "rgba(217,119,107,0.10)" },
  noProcTxt: { flex: 1, color: T.tinta, fontSize: 13, lineHeight: 18 },
  error: { flexDirection: "row", gap: 10, padding: 12, borderRadius: 11, marginBottom: 14, backgroundColor: "rgba(217,119,107,0.10)", borderWidth: 1, borderColor: "rgba(217,119,107,0.35)" },
  errorTxt: { color: T.tinta, fontSize: 13, lineHeight: 18 },
  reintentar: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, borderColor: T.linea, backgroundColor: T.panel, minHeight: 40 },
  reintentarTxt: { color: T.tinta, fontSize: 13, fontWeight: "700" },
});
