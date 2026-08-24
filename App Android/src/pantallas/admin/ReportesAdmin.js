import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../../tema";
import { Tarjeta, TituloTarjeta, Boton } from "../../ui";
import { pesos } from "../../datos-admin";
import { kpisAdmin, cobranza12Meses } from "../../datos-remoto";
import { descargarReporteNegocio } from "../../pdf";

/**
 * Reportes del negocio.
 *
 * Sale de la base, no de una lista de ejemplo. Importa mas de lo que parece:
 * de aqui salia tambien el PDF, o sea que se podia descargar y mandar un
 * reporte de ingresos que nadie habia cobrado nunca.
 */
export default function ReportesAdmin() {
  const [bajando, setBajando] = useState(false);
  const [kpis, setKpis] = useState({ ingresosMes: 0, serviciosMes: 0 });
  const [cobranza, setCobranza] = useState({ serie: [], hayDatos: false });
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    Promise.all([kpisAdmin(), cobranza12Meses()]).then(([k, co]) => {
      if (!vivo) return;
      setKpis(k || { ingresosMes: 0, serviciosMes: 0 });
      setCobranza(co);
      setCargando(false);
    });
    return () => { vivo = false; };
  }, []);

  const maxM = Math.max(...cobranza.serie.map((x) => x.monto), 1);
  const total = cobranza.serie.reduce((a, x) => a + x.monto, 0);

  const exportar = async () => {
    if (!cobranza.hayDatos) {
      Alert.alert("Todavía no hay nada que reportar",
        "No hay depósitos aplicados en los últimos doce meses. El reporte saldría en ceros.");
      return;
    }
    setBajando(true);
    try { await descargarReporteNegocio("Reporte de cobranza", cobranza.serie); }
    catch (e) { Alert.alert("No se pudo generar el PDF", String(e?.message || e)); }
    finally { setBajando(false); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.fondo }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text style={s.h1}>Reportes del negocio</Text>
      <Text style={s.sub}>Cobranza por periodo y servicios.</Text>

      <View style={s.kpis}>
        <View style={s.kpi}><Text style={s.kpiEt}>Cobrado este mes</Text><Text style={s.kpiVal} numberOfLines={1} adjustsFontSizeToFit>{pesos(kpis.ingresosMes)}</Text></View>
        <View style={s.kpi}><Text style={s.kpiEt}>Servicios del mes</Text><Text style={s.kpiVal}>{kpis.serviciosMes}</Text></View>
      </View>

      <Tarjeta>
        <TituloTarjeta>Cobranza por mes</TituloTarjeta>
        {!cobranza.hayDatos && !cargando && (
          <Text style={s.vacio}>
            Todavía no hay depósitos aplicados. Aquí se grafica el dinero que de verdad entró,
            no lo facturado: la facturación aún no vive en el sistema.
          </Text>
        )}
        <View style={s.chart}>
          {cobranza.serie.map((x, i) => (
            <View key={x.periodo + i} style={s.col}>
              <View style={s.track}><View style={[s.bar, { height: `${Math.round((x.monto / maxM) * 100)}%` }]} /></View>
              <Text style={s.colLbl}>{x.periodo}</Text>
            </View>
          ))}
        </View>
        <View style={s.totFila}><Text style={s.totK}>Total cobrado</Text><Text style={s.totV}>{pesos(total)}</Text></View>
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
  vacio: { color: T.gris, fontSize: 13, lineHeight: 18, marginBottom: 10 },
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
