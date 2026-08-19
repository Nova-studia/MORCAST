import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../tema";
import { Tarjeta, TituloTarjeta, Badge, Boton } from "../ui";
import { CLIENTE, CUENTA, MOVIMIENTOS, SERVICIOS_CLIENTE, pesos, fechaLarga, estatusInfo } from "../datos";
import { miSaldo, misMovimientos, misServicios } from "../datos-remoto";

export default function Inicio({ navigation }) {
  const [saldo, setSaldo] = useState(null);
  const [movs, setMovs] = useState(null);
  const [servicios, setServicios] = useState(null);

  useEffect(() => {
    let vivo = true;
    Promise.all([miSaldo(), misMovimientos(), misServicios()]).then(([sa, mo, se]) => {
      if (!vivo) return;
      setSaldo(sa);
      setMovs(mo);
      setServicios(se);
    });
    return () => {
      vivo = false;
    };
  }, []);

  // Mientras carga (o si no hay conexión a la base) se muestran los datos de
  // ejemplo, para que la pantalla nunca aparezca en blanco.
  const cuenta = saldo || CUENTA;
  const movimientos = movs && movs.length ? movs : MOVIMIENTOS;
  const listaServicios = servicios && servicios.length ? servicios : SERVICIOS_CLIENTE;

  const completados = listaServicios.filter((x) => x.estatus === "completado");
  const proximos = listaServicios.filter((x) => x.estatus !== "completado");
  const nombre = CLIENTE.contacto.split(" ").slice(-1)[0];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.fondo }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text style={s.hola}>Hola, {nombre} 👋</Text>
      <Text style={s.sub}>Resumen de {CLIENTE.empresa}.</Text>

      {/* Saldo */}
      <View style={s.saldo}>
        <Text style={s.saldoLbl}>Saldo a favor / crédito disponible</Text>
        <Text style={s.saldoMonto}>{pesos(cuenta.saldoActual)}</Text>
        <View style={s.saldoFila}>
          <Text style={s.saldoInfo}>Línea {pesos(cuenta.limiteCredito)}</Text>
          <Text style={s.saldoInfo}>{cuenta.diasCredito} días</Text>
        </View>
        <Boton onPress={() => navigation.navigate("Saldo")} style={{ marginTop: 14, backgroundColor: "#ffffff" }}>
          <Feather name="plus-circle" size={17} color="#0d3b2e" />
          <Text style={{ color: "#0d3b2e", fontWeight: "700", fontSize: 14.5 }}>  Agregar saldo</Text>
        </Boton>
      </View>

      {/* KPIs */}
      <View style={s.kpis}>
        <Kpi icono="dollar-sign" color={T.naranjaClaro} etiqueta="Por pagar" valor={pesos(cuenta.porPagar)} />
        <Kpi icono="truck" color={T.verdeClaro} etiqueta="Servicios" valor={String(completados.length)} />
        <Kpi icono="calendar" color={T.tealClaro} etiqueta="Próximos" valor={String(proximos.length)} />
      </View>

      {/* Próximos servicios */}
      <Tarjeta>
        <TituloTarjeta derecha={<Pressable onPress={() => navigation.navigate("Historial")}><Text style={s.link}>Ver todos</Text></Pressable>}>
          Próximos servicios
        </TituloTarjeta>
        {proximos.length === 0 ? (
          <Text style={s.vacio}>No hay servicios programados.</Text>
        ) : (
          proximos.map((x, i) => {
            const est = estatusInfo(x.estatus);
            return (
              <View key={x.folio} style={[s.fila, i < proximos.length - 1 && s.filaBorde]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.filaTit}>{x.tipo}</Text>
                  <Text style={s.filaSub}>{fechaLarga(x.fecha)} · {x.folio}</Text>
                </View>
                <Badge clase={est.clase}>{est.texto}</Badge>
              </View>
            );
          })
        )}
      </Tarjeta>

      {/* Movimientos */}
      <Tarjeta>
        <TituloTarjeta>Movimientos recientes</TituloTarjeta>
        {movimientos.slice(0, 5).map((m, i) => (
          <View key={m.folio} style={[s.fila, i < 4 && s.filaBorde]}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={s.filaTit} numberOfLines={1}>{m.concepto}</Text>
              <Text style={s.filaSub}>{fechaLarga(m.fecha)}</Text>
            </View>
            <Text style={[s.mov, { color: m.tipo === "abono" ? T.verdeClaro : T.naranjaClaro }]}>
              {m.tipo === "abono" ? "+" : "−"}{pesos(m.monto)}
            </Text>
          </View>
        ))}
      </Tarjeta>
    </ScrollView>
  );
}

function Kpi({ icono, color, etiqueta, valor }) {
  return (
    <View style={s.kpi}>
      <View style={[s.kpiIco, { backgroundColor: color + "22" }]}>
        <Feather name={icono} size={16} color={color} />
      </View>
      <Text style={s.kpiEt}>{etiqueta}</Text>
      <Text style={s.kpiVal} numberOfLines={1} adjustsFontSizeToFit>{valor}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  hola: { color: T.tinta, fontSize: 22, fontWeight: "800" },
  sub: { color: T.gris, fontSize: 13.5, marginTop: 3, marginBottom: 16 },
  saldo: { backgroundColor: T.teal, borderRadius: 16, padding: 18, marginBottom: 14 },
  saldoLbl: { color: "#bfe0dd", fontSize: 12.5 },
  saldoMonto: { color: "#fff", fontSize: 34, fontWeight: "800", marginTop: 4, letterSpacing: -0.5 },
  saldoFila: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  saldoInfo: { color: "#a9d3cf", fontSize: 12.5 },
  kpis: { flexDirection: "row", gap: 10, marginBottom: 2 },
  kpi: { flex: 1, backgroundColor: T.panel, borderWidth: 1, borderColor: T.linea, borderRadius: 14, padding: 12, marginBottom: 14 },
  kpiIco: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  kpiEt: { color: T.gris, fontSize: 11.5 },
  kpiVal: { color: T.tinta, fontSize: 16, fontWeight: "800", marginTop: 2 },
  link: { color: T.verdeClaro, fontSize: 13, fontWeight: "600" },
  fila: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  filaBorde: { borderBottomWidth: 1, borderBottomColor: T.linea },
  filaTit: { color: T.tinta, fontSize: 14, fontWeight: "600" },
  filaSub: { color: T.gris, fontSize: 12, marginTop: 2 },
  mov: { fontSize: 13.5, fontWeight: "700" },
  vacio: { color: T.gris, textAlign: "center", paddingVertical: 16 },
});
