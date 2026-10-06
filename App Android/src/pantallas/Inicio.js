import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../tema";
import { IconoMenu } from "../iconos-menu";
import { enHold, SIN_CIFRA } from "../estado-sistema";
import { Tarjeta, TituloTarjeta, Badge, Boton, AvisoHold, AvisoPrecios } from "../ui";
import { CUENTA, MOVIMIENTOS, SERVICIOS_CLIENTE, pesos, fechaLarga, estatusInfo } from "../datos";
import { miSaldo, misMovimientos, misServicios } from "../datos-remoto";
import { useMiEmpresa } from "../mi-empresa";
import { haySupabase } from "../supabase";
import { esProximo } from "../solicitudes.js";
import AvisosCliente from "./AvisosCliente";

export default function Inicio({ navigation, route }) {
  const [saldo, setSaldo] = useState(null);
  // Cada vez que cambia se vuelven a leer los avisos: al regresar a esta
  // pestaña y al tocar una notificación de aviso (llega `route.params.aviso`).
  // Sin esto, un aviso que llega con la app abierta no aparecía hasta
  // cerrarla y volver a abrirla.
  const [recargaAvisos, setRecargaAvisos] = useState(0);
  useEffect(() => navigation.addListener("focus", () => setRecargaAvisos((n) => n + 1)), [navigation]);
  useEffect(() => {
    if (route?.params?.aviso) setRecargaAvisos((n) => n + 1);
  }, [route?.params?.aviso]);
  const [movs, setMovs] = useState(null);
  const [servicios, setServicios] = useState(null);
  const { empresa } = useMiEmpresa();

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

  // Con base conectada TODO es real, aunque esté vacío. Antes, un cliente sin
  // movimientos veía los de ejemplo ("Pago recibido — transferencia SPEI",
  // facturas FAC-2026-11xx) y sin servicios veía recolecciones que nunca le
  // hicieron. Los datos de ejemplo sólo valen sin base.
  const conBase = haySupabase();
  const cuenta = saldo || (conBase ? { saldoActual: 0, porPagar: 0, limiteCredito: 0, diasCredito: 0 } : CUENTA);
  const cargandoMovs = conBase && movs === null;
  const movimientos = movs || (conBase ? [] : MOVIMIENTOS);
  const cargandoServicios = conBase && servicios === null;
  const listaServicios = servicios || (conBase ? [] : SERVICIOS_CLIENTE);

  const completados = listaServicios.filter((x) => x.estatus === "completado");
  // Solo lo que todavía va a pasar. Un "No procedió" ya pasó (el chofer fue y
  // no se pudo): no es un próximo servicio, aunque tampoco esté completado.
  const proximos = listaServicios.filter(esProximo);
  const nombre = (empresa.contacto || empresa.empresa || "").split(" ").slice(-1)[0];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.fondo }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text style={s.hola}>Hola{nombre ? `, ${nombre}` : ""} 👋</Text>
      <Text style={s.sub}>Resumen de {empresa.empresa}.</Text>
      {/* Lo primero que se ve: si la ruta va tarde o se cambió el día, el
          cliente tiene que enterarse antes que de su saldo. */}
      <AvisosCliente recarga={recargaAvisos} />
      <AvisoHold />

      {/* Saldo */}
      <View style={s.saldo}>
        <Text style={s.saldoLbl}>Saldo a favor / crédito disponible</Text>
        {/* MODO HOLD: mientras Morcast no este cobrando, del lado del
            CLIENTE no se enseña ninguna cifra. Un cero se leeria como "no
            debes nada" y eso todavia no lo sabemos. */}
        <Text style={s.saldoMonto}>{enHold() ? SIN_CIFRA : pesos(cuenta.saldoActual)}</Text>
        <View style={s.saldoFila}>
          {enHold() ? (
            <Text style={s.saldoInfo}>Sin cobros todavía</Text>
          ) : (
            <>
              <Text style={s.saldoInfo}>Línea {pesos(cuenta.limiteCredito)}</Text>
              <Text style={s.saldoInfo}>{cuenta.diasCredito} días</Text>
            </>
          )}
        </View>
        <Boton onPress={() => navigation.navigate("Saldo")} style={{ marginTop: 14, backgroundColor: "#ffffff" }}>
          <Feather name="plus-circle" size={17} color="#0d3b2e" />
          <Text style={{ color: "#0d3b2e", fontWeight: "700", fontSize: 14.5 }}>  Agregar saldo</Text>
        </Boton>
      </View>

      {/* KPIs */}
      <View style={s.kpis}>
        {/* Los mismos dibujos que las tarjetas del Panel del portal web. */}
        <Kpi dibujo="por-pagar" etiqueta="Por pagar" valor={enHold() ? SIN_CIFRA : pesos(cuenta.porPagar)} />
        <Kpi dibujo="servicios" etiqueta="Servicios" valor={cargandoServicios ? "…" : String(completados.length)} />
        <Kpi dibujo="programados" etiqueta="Próximos" valor={cargandoServicios ? "…" : String(proximos.length)} />
      </View>

      {/* Pedido de los dueños (4-oct-2026): junto a toda cifra de dinero, el
          aviso de que el precio puede cambiar. En Hold no hay cifras (todo
          dice "—"), así que no hay nada que matizar. Igual que el portal. */}
      {!enHold() && <AvisoPrecios compacto />}

      {/* Próximos servicios */}
      <Tarjeta>
        <TituloTarjeta derecha={<Pressable onPress={() => navigation.navigate("Historial")}><Text style={s.link}>Ver todos</Text></Pressable>}>
          Próximos servicios
        </TituloTarjeta>
        {proximos.length === 0 ? (
          <Text style={s.vacio}>{cargandoServicios ? "Leyendo tus servicios…" : "No hay servicios programados."}</Text>
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
        {movimientos.length === 0 && (
          <Text style={s.vacio}>{cargandoMovs ? "Leyendo tus movimientos…" : "Todavía no hay movimientos en tu cuenta."}</Text>
        )}
        {movimientos.slice(0, 5).map((m, i) => (
          <View key={m.id || m.folio || i} style={[s.fila, i < 4 && s.filaBorde]}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={s.filaTit} numberOfLines={1}>{m.concepto}</Text>
              <Text style={s.filaSub}>{fechaLarga(m.fecha)}</Text>
            </View>
            {/* El monto del movimiento tambien se apaga. Si arriba el saldo dice
                "sin cobros todavia" y aqui abajo aparece "+$30,000.00", la
                misma pantalla se contradice. */}
            <Text style={[s.mov, { color: m.tipo === "abono" ? T.ok : T.error }]}>
              {enHold() ? SIN_CIFRA : `${m.tipo === "abono" ? "+" : "−"}${pesos(m.monto)}`}
            </Text>
          </View>
        ))}
      </Tarjeta>
    </ScrollView>
  );
}

function Kpi({ dibujo, etiqueta, valor }) {
  return (
    <View style={s.kpi}>
      {/* Sin cuadrito de color detrás, como en la web: un fondo detrás de
          una ilustración a color le ensucia los bordes. */}
      <View style={s.kpiIco}>
        <IconoMenu nombre={dibujo} tam={32} />
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
  kpiIco: { width: 32, height: 32, justifyContent: "center", marginBottom: 8 },
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
