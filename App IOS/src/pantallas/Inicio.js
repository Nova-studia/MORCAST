import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../tema";
import { IconoMenu } from "../iconos-menu";
import { enHold, SIN_CIFRA } from "../estado-sistema";
import { Tarjeta, TituloTarjeta, Badge, Boton, AvisoHold, AvisoPrecios } from "../ui";
import { CUENTA, MOVIMIENTOS, SERVICIOS_CLIENTE, pesos, fechaLarga, estatusInfo } from "../datos";
import { miSaldo, misMovimientos, misServicios } from "../datos-remoto";
import { useMiEmpresa } from "../mi-empresa";
import { haySupabase } from "../supabase";
import AvisosCliente from "../AvisosCliente";
import { esProximo, textoNoProcedio } from "../estado-servicio.mjs";
import { hoyMatamoros } from "../avisos.mjs";

/** Cuántos días se sigue enseñando en el Inicio una visita que no procedió. */
const DIAS_NO_PROCEDIO = 14;

/** La fecha de hace `n` días, en calendario de Matamoros ("2026-09-21"). */
function haceDias(n) {
  return hoyMatamoros(new Date(Date.now() - n * 24 * 60 * 60 * 1000));
}

export default function Inicio({ navigation }) {
  const [saldo, setSaldo] = useState(null);
  const [movs, setMovs] = useState(null);
  const [servicios, setServicios] = useState(null);
  const { empresa } = useMiEmpresa();
  const [refrescando, setRefrescando] = useState(false);
  // Sube en cada "jalar para refrescar" para que los avisos también se relean.
  const [vuelta, setVuelta] = useState(0);

  // `sigueViva` evita escribir en una pantalla que ya se cerró.
  const leer = (sigueViva = () => true) =>
    Promise.all([miSaldo(), misMovimientos(), misServicios()]).then(([sa, mo, se]) => {
      if (!sigueViva()) return;
      setSaldo(sa);
      setMovs(mo);
      setServicios(se);
    });

  useEffect(() => {
    let vivo = true;
    leer(() => vivo).catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  const refrescar = async () => {
    setRefrescando(true);
    setVuelta((v) => v + 1);
    try { await leer(); } catch { /* se queda lo que había */ } finally { setRefrescando(false); }
  };

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
  // Solo lo que todavía espera camión. Antes era "todo lo que no está
  // completado", y una visita que NO PROCEDIÓ salía aquí como pendiente.
  const proximos = listaServicios.filter(esProximo);
  // Las que no procedieron hace poco: el cliente tiene que saber por qué no
  // le recogieron y que no se le cobra (ver estado-servicio.mjs).
  const desde = haceDias(DIAS_NO_PROCEDIO);
  const noProcedieron = listaServicios.filter((x) => x.estatus === "no-procedio" && (x.fecha || "") >= desde);
  const nombre = (empresa.contacto || empresa.empresa || "").split(" ").slice(-1)[0];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.fondo }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={haySupabase() ? <RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={T.gris} /> : undefined}
    >
      <Text style={s.hola}>Hola{nombre ? `, ${nombre}` : ""} 👋</Text>
      <Text style={s.sub}>Resumen de {empresa.empresa}.</Text>
      {/* Los avisos de Morcast van ARRIBA de todo: un "hoy la ruta va tarde"
          es lo primero que el cliente tiene que leer. Sin avisos no ocupa nada. */}
      <AvisosCliente recarga={vuelta} />
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
      {/* Junto a cifras de dinero, el aviso de que el precio puede cambiar
          (como el portal: solo cuando de verdad se enseñan cifras). */}
      {!enHold() && <AvisoPrecios compacto style={{ marginTop: 0, marginBottom: 14 }} />}

      {/* KPIs */}
      <View style={s.kpis}>
        {/* Los mismos dibujos que las tarjetas del Panel del portal web. */}
        <Kpi dibujo="por-pagar" etiqueta="Por pagar" valor={enHold() ? SIN_CIFRA : pesos(cuenta.porPagar)} />
        <Kpi dibujo="servicios" etiqueta="Servicios" valor={cargandoServicios ? "…" : String(completados.length)} />
        <Kpi dibujo="programados" etiqueta="Próximos" valor={cargandoServicios ? "…" : String(proximos.length)} />
      </View>

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

      {/* Visitas que no procedieron */}
      {noProcedieron.length > 0 && (
        <Tarjeta>
          <TituloTarjeta>Visitas que no procedieron</TituloTarjeta>
          {noProcedieron.map((x, i) => (
            <View key={x.folio} style={[s.fila, { alignItems: "flex-start" }, i < noProcedieron.length - 1 && s.filaBorde]}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={s.filaTit}>{x.tipo}</Text>
                <Text style={s.filaSub}>{fechaLarga(x.fecha)} · {x.folio}</Text>
                <Text style={s.noProc}>{textoNoProcedio(x.motivoNoProcedio, x.detalleNoProcedio)}</Text>
              </View>
              <Badge clase="mal">No procedió</Badge>
            </View>
          ))}
        </Tarjeta>
      )}

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
  noProc: { color: T.tinta, fontSize: 12.5, marginTop: 5, lineHeight: 18 },
});
