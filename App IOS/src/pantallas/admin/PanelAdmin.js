import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../../tema";
import { Tarjeta, TituloTarjeta } from "../../ui";
import { embudoSolicitudes, pesos } from "../../datos-admin";
import { kpisAdmin, cobranza12Meses, listarCotizaciones } from "../../datos-remoto";

const KPIS_VACIOS = {
  ingresosMes: 0, ingresosMesAnterior: 0, solicitudesNuevas: 0,
  clientesActivos: 0, serviciosMes: 0, porCobrar: 0,
};

/**
 * Panel de administracion.
 *
 * Todo lo de esta pantalla sale de la base. Antes eran seis numeros escritos
 * a mano en `datos-admin.js` desde julio: el panel anunciaba 2 solicitudes
 * nuevas sin contactar y la bandeja de Solicitudes salia vacia, porque la
 * bandeja si consultaba la base y el panel no.
 */
export default function PanelAdmin() {
  const [kpis, setKpis] = useState(KPIS_VACIOS);
  const [cobranza, setCobranza] = useState({ serie: [], hayDatos: false });
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    Promise.all([kpisAdmin(), cobranza12Meses(), listarCotizaciones()]).then(([k, co, c]) => {
      if (!vivo) return;
      setKpis(k || KPIS_VACIOS);
      setCobranza(co);
      setSolicitudes(c);
      setCargando(false);
    });
    return () => { vivo = false; };
  }, []);

  const maxM = Math.max(...cobranza.serie.map((x) => x.monto), 1);
  const totalCobrado = cobranza.serie.reduce((a, x) => a + x.monto, 0);
  const embudo = embudoSolicitudes(solicitudes);
  const maxE = Math.max(...embudo.map((e) => e.total), 1);
  const delta = kpis.ingresosMes - kpis.ingresosMesAnterior;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.fondo }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text style={s.h1}>Panel</Text>
      <Text style={s.sub}>Resumen del negocio.</Text>

      <View style={s.kpis}>
        <Kpi icono="dollar-sign" etiqueta="Cobrado este mes" valor={pesos(kpis.ingresosMes)} pie="La facturacion aun no vive aqui" color={T.naranjaClaro} />
        <Kpi icono="inbox" etiqueta="Solicitudes nuevas" valor={String(kpis.solicitudesNuevas)} pie="Sin contactar" color={T.tealClaro} />
        <Kpi icono="users" etiqueta="Clientes activos" valor={String(kpis.clientesActivos)} pie="Con contrato" color={T.verdeClaro} />
        <Kpi icono="alert-circle" etiqueta="Por cobrar" valor={pesos(kpis.porCobrar)} pie="Cargos sin saldar" color={T.naranjaClaro} />
      </View>

      <Tarjeta>
        <TituloTarjeta>Cobranza (últimos 12 meses)</TituloTarjeta>
        {!cobranza.hayDatos && !cargando && (
          <Text style={s.vacio}>
            Todavía no hay depósitos aplicados. La gráfica se llena en cuanto se verifique el primero.
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
        <View style={s.totFila}>
          <Text style={s.totK}>Total cobrado</Text>
          <Text style={s.totV}>{pesos(totalCobrado)}</Text>
        </View>
      </Tarjeta>

      <Tarjeta>
        <TituloTarjeta>Embudo de solicitudes</TituloTarjeta>
        {!cargando && solicitudes.length === 0 && (
          <Text style={s.vacio}>No hay solicitudes todavía. Las que llegan por el formulario del sitio caen aquí.</Text>
        )}
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
  vacio: { color: T.gris, fontSize: 13, lineHeight: 18, marginBottom: 10 },
  totFila: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: T.linea },
  totK: { color: T.gris, fontSize: 13 },
  totV: { color: T.tinta, fontSize: 16, fontWeight: "800" },
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
