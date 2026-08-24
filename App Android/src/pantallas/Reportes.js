import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../tema";
import { Tarjeta, TituloTarjeta, Boton } from "../ui";
import { REPORTE_DIARIO, REPORTE_MENSUAL, REPORTE_ANUAL, COMPOSICION_RESIDUOS, pesos } from "../datos";
import { reportes } from "../datos-remoto";
import { useMiEmpresa, avisoSinEmpresa } from "../mi-empresa";
import { descargarReporte } from "../pdf";

const PERIODOS = [
  { id: "diario", texto: "Diario", data: REPORTE_DIARIO, titulo: "Reporte diario" },
  { id: "mensual", texto: "Mensual", data: REPORTE_MENSUAL, titulo: "Reporte mensual" },
  { id: "anual", texto: "Anual", data: REPORTE_ANUAL, titulo: "Reporte anual" },
];

export default function Reportes() {
  const [sel, setSel] = useState("mensual");
  const [bajando, setBajando] = useState(false);
  const [rep, setRep] = useState(null);
  const { empresa, puedeImprimir, cargando } = useMiEmpresa();

  useEffect(() => {
    let vivo = true;
    reportes().then((r) => { if (vivo) setRep(r); });
    return () => { vivo = false; };
  }, []);

  const cfg = PERIODOS.find((p) => p.id === sel);
  const data = rep ? rep[sel] : cfg.data;
  // La grafica va por PESO, no por monto: el peso lo registra el chofer, la
  // facturacion todavia no vive en el sistema y una barra de ceros no dice nada.
  const maxM = Math.max(...data.map((d) => d.volumen), 1);
  const totalVol = data.reduce((a, d) => a + d.volumen, 0);

  const exportar = async () => {
    if (!puedeImprimir) {
      const [t, m] = avisoSinEmpresa(cargando);
      Alert.alert(t, m);
      return;
    }
    setBajando(true);
    try { await descargarReporte(cfg.titulo, data, empresa); }
    catch (e) { Alert.alert("No se pudo generar el PDF", String(e?.message || e)); }
    finally { setBajando(false); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.fondo }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text style={s.h1}>Reportes</Text>
      <Text style={s.sub}>Peso recolectado por periodo, tomado de cada servicio.</Text>

      <View style={s.seg}>
        {PERIODOS.map((p) => (
          <Pressable key={p.id} onPress={() => setSel(p.id)} style={[s.segBtn, sel === p.id && s.segOn]}>
            <Text style={[s.segTxt, sel === p.id && s.segTxtOn]}>{p.texto}</Text>
          </Pressable>
        ))}
      </View>

      <View style={s.kpis}>
        <View style={s.kpi}><Text style={s.kpiEt}>Peso total</Text><Text style={s.kpiVal}>{totalVol.toLocaleString("es-MX")} ton</Text></View>
        <View style={s.kpi}><Text style={s.kpiEt}>Servicios</Text><Text style={s.kpiVal} numberOfLines={1} adjustsFontSizeToFit>{rep ? String(rep.servicios) : "—"}</Text></View>
      </View>

      <Tarjeta>
        <TituloTarjeta>Monto por periodo</TituloTarjeta>
        <View style={s.chart}>
          {data.map((d) => (
            <View key={d.periodo} style={s.col}>
              <View style={s.track}><View style={[s.bar, { height: `${Math.round((d.volumen / maxM) * 100)}%` }]} /></View>
              <Text style={s.colLbl}>{d.periodo}</Text>
            </View>
          ))}
        </View>
        <Boton variante="linea" onPress={exportar} disabled={bajando} style={{ marginTop: 14 }}>
          <Feather name="download" size={15} color={T.tinta} />
          <Text style={{ color: T.tinta, fontWeight: "700" }}>  {bajando ? "Generando…" : "Descargar reporte PDF"}</Text>
        </Boton>
      </Tarjeta>

      <Tarjeta>
        <TituloTarjeta>Composición de residuos (12 meses)</TituloTarjeta>
        {COMPOSICION_RESIDUOS.map((c) => (
          <View key={c.tipo} style={s.compFila}>
            <View style={[s.punto, { backgroundColor: c.color }]} />
            <Text style={s.compTipo}>{c.tipo}</Text>
            <Text style={s.compPct}>{c.porcentaje}%</Text>
          </View>
        ))}
        <View style={s.barra}>
          {COMPOSICION_RESIDUOS.map((c) => (
            <View key={c.tipo} style={{ width: `${c.porcentaje}%`, backgroundColor: c.color, height: 10 }} />
          ))}
        </View>
      </Tarjeta>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  h1: { color: T.tinta, fontSize: 22, fontWeight: "800" },
  sub: { color: T.gris, fontSize: 13.5, marginTop: 3, marginBottom: 14 },
  seg: { flexDirection: "row", backgroundColor: T.panel, borderWidth: 1, borderColor: T.linea, borderRadius: 11, padding: 4, marginBottom: 14 },
  segBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: "center" },
  segOn: { backgroundColor: T.verde },
  segTxt: { color: T.gris, fontSize: 13, fontWeight: "600" },
  segTxtOn: { color: "#0d1211" },
  kpis: { flexDirection: "row", gap: 10, marginBottom: 14 },
  kpi: { flex: 1, backgroundColor: T.panel, borderWidth: 1, borderColor: T.linea, borderRadius: 14, padding: 14 },
  kpiEt: { color: T.gris, fontSize: 12 },
  kpiVal: { color: T.tinta, fontSize: 18, fontWeight: "800", marginTop: 4 },
  chart: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 140, gap: 6 },
  col: { flex: 1, alignItems: "center" },
  track: { width: "100%", height: 116, backgroundColor: T.panel2, borderRadius: 6, justifyContent: "flex-end", overflow: "hidden" },
  bar: { width: "100%", backgroundColor: T.verde, borderRadius: 6 },
  colLbl: { color: T.gris, fontSize: 10, marginTop: 6 },
  compFila: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 10 },
  punto: { width: 11, height: 11, borderRadius: 6 },
  compTipo: { color: T.tinta, fontSize: 13.5, flex: 1 },
  compPct: { color: T.gris, fontSize: 13.5, fontWeight: "700" },
  barra: { flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden", marginTop: 10 },
});
