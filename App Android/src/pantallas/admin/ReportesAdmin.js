import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../../tema";
import { Tarjeta, TituloTarjeta, Boton } from "../../ui";
import { ADMIN_INGRESOS, ADMIN_KPIS, pesos } from "../../datos-admin";
import { descargarReporteNegocio } from "../../pdf";

export default function ReportesAdmin() {
  const [bajando, setBajando] = useState(false);
  const maxM = Math.max(...ADMIN_INGRESOS.map((x) => x.monto), 1);
  const total = ADMIN_INGRESOS.reduce((a, x) => a + x.monto, 0);

  const exportar = async () => {
    setBajando(true);
    try { await descargarReporteNegocio("Reporte de ingresos del negocio", ADMIN_INGRESOS); }
    catch (e) { Alert.alert("No se pudo generar el PDF", String(e?.message || e)); }
    finally { setBajando(false); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.fondo }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text style={s.h1}>Reportes del negocio</Text>
      <Text style={s.sub}>Ingresos por periodo y desempeño.</Text>

      <View style={s.kpis}>
        <View style={s.kpi}><Text style={s.kpiEt}>Ingresos del mes</Text><Text style={s.kpiVal} numberOfLines={1} adjustsFontSizeToFit>{pesos(ADMIN_KPIS.ingresosMes)}</Text></View>
        <View style={s.kpi}><Text style={s.kpiEt}>Servicios del mes</Text><Text style={s.kpiVal}>{ADMIN_KPIS.serviciosMes}</Text></View>
      </View>

      <Tarjeta>
        <TituloTarjeta>Ingresos por mes</TituloTarjeta>
        <View style={s.chart}>
          {ADMIN_INGRESOS.map((x) => (
            <View key={x.periodo} style={s.col}>
              <View style={s.track}><View style={[s.bar, { height: `${Math.round((x.monto / maxM) * 100)}%` }]} /></View>
              <Text style={s.colLbl}>{x.periodo}</Text>
            </View>
          ))}
        </View>
        <View style={s.totFila}><Text style={s.totK}>Total del periodo</Text><Text style={s.totV}>{pesos(total)}</Text></View>
        <Boton variante="linea" onPress={exportar} disabled={bajando} style={{ marginTop: 12 }}>
          <Feather name="download" size={15} color={T.tinta} />
          <Text style={{ color: T.tinta, fontWeight: "700" }}>  {bajando ? "Generando…" : "Descargar reporte PDF"}</Text>
        </Boton>
      </Tarjeta>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  h1: { color: T.tinta, fontSize: 22, fontWeight: "800" },
  sub: { color: T.gris, fontSize: 13.5, marginTop: 3, marginBottom: 14 },
  kpis: { flexDirection: "row", gap: 10, marginBottom: 14 },
  kpi: { flex: 1, backgroundColor: T.panel, borderWidth: 1, borderColor: T.linea, borderRadius: 14, padding: 14 },
  kpiEt: { color: T.gris, fontSize: 12 },
  kpiVal: { color: T.tinta, fontSize: 18, fontWeight: "800", marginTop: 4 },
  chart: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 130, gap: 8 },
  col: { flex: 1, alignItems: "center" },
  track: { width: "100%", height: 106, backgroundColor: T.panel2, borderRadius: 6, justifyContent: "flex-end", overflow: "hidden" },
  bar: { width: "100%", backgroundColor: T.naranja, borderRadius: 6 },
  colLbl: { color: T.gris, fontSize: 10.5, marginTop: 6 },
  totFila: { flexDirection: "row", justifyContent: "space-between", marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: T.linea },
  totK: { color: T.gris, fontSize: 13.5 },
  totV: { color: T.tinta, fontSize: 15, fontWeight: "800" },
});
