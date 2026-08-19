import { View, Text, ScrollView, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../../tema";
import { Tarjeta, TituloTarjeta } from "../../ui";
import { ADMIN_KPIS, ADMIN_INGRESOS, SOLICITUDES, embudoSolicitudes, pesos } from "../../datos-admin";

export default function PanelAdmin() {
  const maxM = Math.max(...ADMIN_INGRESOS.map((x) => x.monto), 1);
  const embudo = embudoSolicitudes(SOLICITUDES);
  const maxE = Math.max(...embudo.map((e) => e.total), 1);
  const delta = ADMIN_KPIS.ingresosMes - ADMIN_KPIS.ingresosMesAnterior;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.fondo }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text style={s.h1}>Panel</Text>
      <Text style={s.sub}>Resumen del negocio.</Text>

      <View style={s.kpis}>
        <Kpi icono="dollar-sign" etiqueta="Ingresos del mes" valor={pesos(ADMIN_KPIS.ingresosMes)} pie={`${delta >= 0 ? "▲" : "▼"} ${pesos(Math.abs(delta))} vs mes anterior`} color={T.naranjaClaro} />
        <Kpi icono="inbox" etiqueta="Solicitudes nuevas" valor={String(ADMIN_KPIS.solicitudesNuevas)} pie="Sin contactar" color={T.tealClaro} />
        <Kpi icono="users" etiqueta="Clientes activos" valor={String(ADMIN_KPIS.clientesActivos)} pie="Con contrato" color={T.verdeClaro} />
        <Kpi icono="alert-circle" etiqueta="Por cobrar" valor={pesos(ADMIN_KPIS.porCobrar)} pie="Facturas pendientes" color={T.naranjaClaro} />
      </View>

      <Tarjeta>
        <TituloTarjeta>Ingresos (últimos meses)</TituloTarjeta>
        <View style={s.chart}>
          {ADMIN_INGRESOS.map((x) => (
            <View key={x.periodo} style={s.col}>
              <View style={s.track}><View style={[s.bar, { height: `${Math.round((x.monto / maxM) * 100)}%` }]} /></View>
              <Text style={s.colLbl}>{x.periodo}</Text>
            </View>
          ))}
        </View>
      </Tarjeta>

      <Tarjeta>
        <TituloTarjeta>Embudo de solicitudes</TituloTarjeta>
        {embudo.map((e) => (
          <View key={e.id} style={s.embFila}>
            <Text style={s.embTxt}>{e.texto}</Text>
            <View style={s.embTrack}><View style={[s.embBar, { width: `${Math.round((e.total / maxE) * 100)}%` }]} /></View>
            <Text style={s.embNum}>{e.total}</Text>
          </View>
        ))}
      </Tarjeta>
    </ScrollView>
  );
}

function Kpi({ icono, etiqueta, valor, pie, color }) {
  return (
    <View style={s.kpi}>
      <View style={[s.kpiIco, { backgroundColor: color + "22" }]}><Feather name={icono} size={16} color={color} /></View>
      <Text style={s.kpiEt}>{etiqueta}</Text>
      <Text style={s.kpiVal} numberOfLines={1} adjustsFontSizeToFit>{valor}</Text>
      <Text style={s.kpiPie} numberOfLines={1}>{pie}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  h1: { color: T.tinta, fontSize: 22, fontWeight: "800" },
  sub: { color: T.gris, fontSize: 13.5, marginTop: 3, marginBottom: 16 },
  kpis: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  kpi: { width: "48.5%", backgroundColor: T.panel, borderWidth: 1, borderColor: T.linea, borderRadius: 14, padding: 13, marginBottom: 12 },
  kpiIco: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  kpiEt: { color: T.gris, fontSize: 11.5 },
  kpiVal: { color: T.tinta, fontSize: 17, fontWeight: "800", marginTop: 2 },
  kpiPie: { color: T.grisClaro, fontSize: 10.5, marginTop: 3 },
  chart: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 130, gap: 8 },
  col: { flex: 1, alignItems: "center" },
  track: { width: "100%", height: 106, backgroundColor: T.panel2, borderRadius: 6, justifyContent: "flex-end", overflow: "hidden" },
  bar: { width: "100%", backgroundColor: T.naranja, borderRadius: 6 },
  colLbl: { color: T.gris, fontSize: 10.5, marginTop: 6 },
  embFila: { flexDirection: "row", alignItems: "center", paddingVertical: 7, gap: 10 },
  embTxt: { color: T.tinta, fontSize: 13, width: 84 },
  embTrack: { flex: 1, height: 10, backgroundColor: T.panel2, borderRadius: 5, overflow: "hidden" },
  embBar: { height: 10, backgroundColor: T.naranja, borderRadius: 5, minWidth: 2 },
  embNum: { color: T.tinta, fontSize: 13, fontWeight: "700", width: 22, textAlign: "right" },
});
