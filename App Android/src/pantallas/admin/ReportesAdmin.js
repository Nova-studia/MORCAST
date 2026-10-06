import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Alert, RefreshControl } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../../tema";
import { Tarjeta, TituloTarjeta, Boton } from "../../ui";
import { pesos } from "../../datos-admin";
import { cobranza12Meses } from "../../datos-remoto";
import { reportesNegocio } from "../../datos-comunicacion";
import { resumenReportes, ton } from "../../reportes-negocio.js";
import { pesoRealActivo } from "../../estado-sistema";
import { descargarReporteNegocio } from "../../pdf";

/**
 * Reportes del negocio.
 *
 * Sale de la base, no de una lista de ejemplo. Importa mas de lo que parece:
 * de aqui salia tambien el PDF, o sea que se podia descargar y mandar un
 * reporte de ingresos que nadie habia cobrado nunca.
 *
 * Desde el 6-oct-2026 enseña también lo que la web (/admin/reportes):
 * peso recolectado por mes, mejor mes, conversión de cotizaciones y el
 * detalle, con la MISMA cuenta (`reportes-negocio`, espejo de la web). Con
 * el peso real del relleno apagado, todo el peso es el ESTIMADO del chofer y
 * así se dice: el dueño cobra por tonelada y no debe leerlo como báscula.
 */
export default function ReportesAdmin() {
  const [bajando, setBajando] = useState(false);
  const [cobranza, setCobranza] = useState({ serie: [], hayDatos: false });
  const [rep, setRep] = useState(undefined); // undefined = cargando, null = falló
  const [refrescando, setRefrescando] = useState(false);

  const cargar = () =>
    Promise.all([reportesNegocio(), cobranza12Meses()]).then(([r, co]) => {
      setRep(r);
      setCobranza(co);
    });

  useEffect(() => {
    let vivo = true;
    Promise.all([reportesNegocio(), cobranza12Meses()]).then(([r, co]) => {
      if (!vivo) return;
      setRep(r);
      setCobranza(co);
    });
    return () => { vivo = false; };
  }, []);

  const refrescar = async () => {
    setRefrescando(true);
    try { await cargar(); } finally { setRefrescando(false); }
  };

  const cargando = rep === undefined;
  const r = resumenReportes(rep?.mensual || [], rep?.cotizaciones || []);
  const maxPeso = Math.max(...r.serie.map((d) => d.monto), 0.0001);
  const conReal = pesoRealActivo();

  const maxM = Math.max(...cobranza.serie.map((x) => x.monto), 1);
  const totalCobrado = cobranza.serie.reduce((a, x) => a + x.monto, 0);

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
    <ScrollView
      style={{ flex: 1, backgroundColor: T.fondo }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={T.gris} />}
    >
      <Text style={s.h1}>Reportes del negocio</Text>
      <Text style={s.sub}>
        Peso recolectado y desempeño comercial de los últimos 12 meses.
        {conReal
          ? " El peso es el real de la báscula del relleno donde ya se registró; donde no, el estimado del chofer."
          : " El peso es el que estima el chofer en cada servicio."}
      </Text>

      {rep === null && (
        <Text style={s.error}>No se pudieron leer los servicios. Revisa tu señal y jala hacia abajo para reintentar.</Text>
      )}

      <View style={s.kpis}>
        <Kpi icono="trending-up" etiqueta="Recolectado 12 meses" valor={cargando ? "…" : ton(r.total)} pie={`Promedio ${ton(r.promedio)} / mes`} color={T.naranjaClaro} />
        <Kpi icono="award" etiqueta="Mejor mes" valor={cargando ? "…" : r.mejor.monto > 0 ? r.mejor.periodo : "—"} pie={ton(r.mejor.monto)} color={T.tealClaro} />
        <Kpi icono="percent" etiqueta="Conversión" valor={cargando ? "…" : `${r.conversion}%`} pie={`${r.ganadas} de ${r.totalSolicitudes} solicitudes ganadas`} color={T.verdeClaro} />
        <Kpi icono="dollar-sign" etiqueta="Cobrado este mes" valor={pesos(cobranza.serie[cobranza.serie.length - 1]?.monto ?? 0)} pie="Depósitos aplicados" color={T.naranjaClaro} />
      </View>

      <Tarjeta>
        <TituloTarjeta>Peso recolectado por mes</TituloTarjeta>
        {!cargando && r.total === 0 && (
          <Text style={s.vacio}>Todavía no hay recolecciones con peso registrado, por eso las barras salen en cero.</Text>
        )}
        {/* Barra apilada como en la web: abajo lo real, arriba (más tenue) lo
            estimado. Mismo tono: es la misma cosa medida con distinta certeza. */}
        <View style={s.chart} accessible accessibilityLabel={`Peso por mes. Total ${ton(r.total)}. Mejor mes ${r.mejor.periodo}.`}>
          {r.serie.map((d, i) => (
            <View key={d.periodo + i} style={s.col}>
              <View style={s.track}>
                {d.monto > 0 && (
                  <View style={{ height: `${Math.max(2, Math.round((d.monto / maxPeso) * 100))}%`, width: "100%" }}>
                    {d.estimado > 0 && <View style={[s.bar, { flex: d.estimado, opacity: 0.45, borderBottomLeftRadius: d.real > 0 ? 0 : 6, borderBottomRightRadius: d.real > 0 ? 0 : 6 }]} />}
                    {d.real > 0 && <View style={[s.bar, { flex: d.real, borderTopLeftRadius: d.estimado > 0 ? 0 : 6, borderTopRightRadius: d.estimado > 0 ? 0 : 6 }]} />}
                  </View>
                )}
              </View>
              <Text style={s.colLbl} numberOfLines={1}>{d.periodo}</Text>
            </View>
          ))}
        </View>
        <View style={s.leyenda}>
          {conReal && (
            <View style={s.leyendaItem}><View style={[s.punto, { backgroundColor: T.naranja }]} /><Text style={s.leyendaTxt}>Real: báscula del relleno</Text></View>
          )}
          <View style={s.leyendaItem}>
            <View style={[s.punto, { backgroundColor: T.naranja, opacity: 0.45 }]} />
            <Text style={s.leyendaTxt}>{conReal ? "Estimado del chofer (aún sin peso real)" : "Estimado del chofer"}</Text>
          </View>
        </View>
      </Tarjeta>

      <Tarjeta>
        <TituloTarjeta>Detalle</TituloTarjeta>
        <View style={[s.fila, s.filaCab]}>
          <Text style={[s.celda, s.cab, { flex: 1.1, textAlign: "left" }]}>Periodo</Text>
          {conReal && <Text style={[s.celda, s.cab]}>Real</Text>}
          <Text style={[s.celda, s.cab]}>Estimado</Text>
          <Text style={[s.celda, s.cab]}>Recolectado</Text>
        </View>
        {r.serie.map((d, i) => (
          <View key={d.periodo + i} style={s.fila}>
            <Text style={[s.celda, { flex: 1.1, textAlign: "left" }]}>{d.periodo}</Text>
            {conReal && <Text style={s.celda}>{ton(d.real)}</Text>}
            <Text style={[s.celda, { color: T.gris }]}>{ton(d.estimado)}</Text>
            <Text style={s.celda}>{ton(d.monto)}</Text>
          </View>
        ))}
        <View style={[s.fila, { borderBottomWidth: 0 }]}>
          <Text style={[s.celda, s.tot, { flex: 1.1, textAlign: "left" }]}>Total</Text>
          {conReal && <Text style={[s.celda, s.tot]}>{ton(r.totalReal)}</Text>}
          <Text style={[s.celda, s.tot]}>{ton(r.totalEstimado)}</Text>
          <Text style={[s.celda, s.tot]}>{ton(r.total)}</Text>
        </View>
      </Tarjeta>

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
              <View style={s.track}><View style={[s.barSola, { height: `${Math.round((x.monto / maxM) * 100)}%` }]} /></View>
              <Text style={s.colLbl} numberOfLines={1}>{x.periodo}</Text>
            </View>
          ))}
        </View>
        <View style={s.totFila}><Text style={s.totK}>Total cobrado</Text><Text style={s.totV}>{pesos(totalCobrado)}</Text></View>
        <Boton variante="linea" onPress={exportar} disabled={bajando} style={{ marginTop: 12 }}>
          <Feather name="download" size={15} color={T.tinta} />
          <Text style={{ color: T.tinta, fontWeight: "700" }}>  {bajando ? "Generando…" : "Descargar reporte PDF"}</Text>
        </Boton>
      </Tarjeta>
    </ScrollView>
  );
}

function Kpi({ icono, etiqueta, valor, pie, color }) {
  return (
    <View style={s.kpi} accessible accessibilityLabel={`${etiqueta}: ${valor}. ${pie}`}>
      <View style={[s.kpiIco, { backgroundColor: color + "22" }]}><Feather name={icono} size={16} color={color} /></View>
      <Text style={s.kpiEt}>{etiqueta}</Text>
      <Text style={s.kpiVal} numberOfLines={1} adjustsFontSizeToFit>{valor}</Text>
      <Text style={s.kpiPie} numberOfLines={2}>{pie}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  h1: { color: T.tinta, fontSize: 22, fontWeight: "800" },
  sub: { color: T.gris, fontSize: 13.5, marginTop: 3, marginBottom: 14, lineHeight: 19 },
  error: { color: T.error, fontSize: 13, marginBottom: 10, lineHeight: 18 },
  vacio: { color: T.gris, fontSize: 13, lineHeight: 18, marginBottom: 10 },
  kpis: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  kpi: { width: "48.5%", backgroundColor: T.panel, borderWidth: 1, borderColor: T.linea, borderRadius: 14, padding: 13, marginBottom: 12 },
  kpiIco: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  kpiEt: { color: T.gris, fontSize: 11.5 },
  kpiVal: { color: T.tinta, fontSize: 17, fontWeight: "800", marginTop: 2 },
  kpiPie: { color: T.grisClaro, fontSize: 10.5, marginTop: 3 },
  // Mismo arreglo que PanelAdmin: con gap 8 y letra 10.5 "May" y "Ago" se
  // partían en dos renglones.
  chart: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 130, gap: 4 },
  col: { flex: 1, alignItems: "center" },
  track: { width: "100%", height: 106, backgroundColor: T.panel2, borderRadius: 6, justifyContent: "flex-end", overflow: "hidden" },
  bar: { width: "100%", backgroundColor: T.naranja, borderRadius: 6 },
  barSola: { width: "100%", backgroundColor: T.naranja, borderRadius: 6 },
  colLbl: { color: T.gris, fontSize: 9.5, marginTop: 6 },
  leyenda: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 12 },
  leyendaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  punto: { width: 12, height: 12, borderRadius: 3 },
  leyendaTxt: { color: T.gris, fontSize: 12 },
  fila: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: T.linea },
  filaCab: { paddingTop: 0 },
  celda: { flex: 1, color: T.tinta, fontSize: 12.5, textAlign: "right" },
  cab: { color: T.gris, fontSize: 11.5, fontWeight: "600" },
  tot: { fontWeight: "800" },
  totFila: { flexDirection: "row", justifyContent: "space-between", marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: T.linea },
  totK: { color: T.gris, fontSize: 13.5 },
  totV: { color: T.tinta, fontSize: 15, fontWeight: "800" },
});
