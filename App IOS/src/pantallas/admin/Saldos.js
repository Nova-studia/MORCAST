import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Modal, Image, Dimensions } from "react-native";
import { Feather } from "@expo/vector-icons";
import { listarMovimientos, listarClientes, resolverDeposito, enlaceComprobante, folioCorto } from "../../datos-remoto";
import { T } from "../../tema";
import { Tarjeta, TituloTarjeta, Badge, Boton } from "../../ui";
import { RECARGAS_SEED, RESPONSABLE_RECARGAS, CLIENTES_ADMIN, ADMIN_PERFIL, estadoRecarga, pesos, fechaLarga } from "../../datos-admin";

const SCREEN_W = Dimensions.get("window").width;

export default function Saldos() {
  const [recargas, setRecargas] = useState([]);
  const [clientes, setClientes] = useState([]);

  // Los depositos reportados son los movimientos de tipo abono.
  const recargar = () =>
    Promise.all([listarMovimientos(), listarClientes()]).then(([m, c]) => {
      setRecargas(m.filter((x) => x.tipo === "abono"));
      setClientes(c);
    });

  useEffect(() => {
    let vivo = true;
    recargar().then(() => { if (!vivo) return; });
    return () => { vivo = false; };
  }, []);
  const [ver, setVer] = useState(null);
  const [zoom, setZoom] = useState(false);
  const [simularAux, setSimularAux] = useState(false);
  const [urlComprobante, setUrlComprobante] = useState(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  // El comprobante vive en una cubeta PRIVADA: no hay dirección fija que
  // pegar en un <Image>. Se pide un enlace firmado, que además caduca.
  useEffect(() => {
    let vivo = true;
    setUrlComprobante(null);
    if (ver?.comprobante) {
      enlaceComprobante(ver.comprobante).then((u) => { if (vivo) setUrlComprobante(u); });
    }
    return () => { vivo = false; };
  }, [ver?.id]);

  const puedeVerificar = !simularAux && ADMIN_PERFIL.rol === "Administrador";
  const porVerificar = recargas.filter((r) => r.estado === "por-verificar");

  // Dos depósitos del mismo cliente por el mismo monto y la misma referencia
  // son casi siempre el mismo dinero reportado dos veces. Se marcan para que
  // nadie aplique dos veces la misma transferencia.
  const vistos = new Map();
  const repetidos = new Set();
  porVerificar.forEach((r) => {
    const llave = [r.clienteId, r.monto, (r.referencia || "").trim().toLowerCase()].join("|");
    if (vistos.has(llave)) repetidos.add(r.id);
    else vistos.set(llave, r.id);
  });
  const esRepetido = (r) => repetidos.has(r.id);
  const totalFavor = clientes.reduce((a, c) => a + (c.saldo || 0), 0);
  const totalCobrar = clientes.reduce((a, c) => a + (c.porPagar || 0), 0);

  /**
   * Aplicar o rechazar escribe en la BASE.
   *
   * Antes esto solo repintaba el renglón: el saldo del cliente nunca se movía
   * y la pantalla decía que sí. Ahora se guarda, se vuelve a leer y, si el
   * permiso de la base no lo deja pasar, se dice en vez de fingir.
   */
  const resolver = async (r, estado) => {
    if (!puedeVerificar || guardando) return;
    setGuardando(true);
    setError("");

    const resp = await resolverDeposito(r.id, estado, null);
    if (!resp.ok) {
      setError(resp.motivo || "No se pudo guardar. Revisa tu señal e intenta otra vez.");
      setGuardando(false);
      return;
    }

    await recargar();
    setGuardando(false);
    setVer(null);
  };

  const aplicar = (r) => resolver(r, "aplicada");
  const rechazar = (r) => resolver(r, "rechazada");

  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.fondo }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text style={s.h1}>Saldos de clientes</Text>
      <Text style={s.sub}>Verifica los comprobantes y aplica el saldo a la cuenta del cliente.</Text>

      <View style={s.kpis}>
        <View style={s.kpi}><Text style={s.kpiEt}>Saldo a favor</Text><Text style={s.kpiVal} numberOfLines={1} adjustsFontSizeToFit>{pesos(totalFavor)}</Text></View>
        <View style={s.kpi}><Text style={s.kpiEt}>Por cobrar</Text><Text style={s.kpiVal} numberOfLines={1} adjustsFontSizeToFit>{pesos(totalCobrar)}</Text></View>
        <View style={s.kpi}><Text style={s.kpiEt}>Por verificar</Text><Text style={s.kpiVal}>{porVerificar.length}</Text></View>
      </View>

      <Tarjeta>
        <TituloTarjeta>Responsable de verificar</TituloTarjeta>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={s.respIco}><Feather name="shield" size={18} color={T.tealClaro} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.respNom}>{RESPONSABLE_RECARGAS.nombre}</Text>
            <Text style={s.respRol}>{RESPONSABLE_RECARGAS.rol} · asignada</Text>
          </View>
        </View>
        <Pressable onPress={() => setSimularAux((v) => !v)} style={[s.toggle, simularAux && s.toggleOn]}>
          <Text style={[s.toggleTxt, simularAux && { color: "#0d1211" }]}>{simularAux ? "Volver a mi vista de administrador" : "Ver como auxiliar sin permiso (demo)"}</Text>
        </Pressable>
        {!puedeVerificar && (
          <View style={s.candado}><Feather name="lock" size={13} color="#e0a94d" /><Text style={s.candadoTxt}>Esta vista puede ver las recargas pero no aplicar saldo.</Text></View>
        )}
      </Tarjeta>

      <Tarjeta>
        <TituloTarjeta>Recargas por verificar ({porVerificar.length})</TituloTarjeta>
        {porVerificar.length === 0 ? (
          <Text style={s.vacio}>No hay recargas pendientes.</Text>
        ) : porVerificar.map((r, i) => (
          <Pressable key={r.id} onPress={() => setVer(r)} style={[s.recFila, i < porVerificar.length - 1 && s.borde]}>
            <View style={{ flex: 1 }}>
              <Text style={s.recMonto}>{pesos(r.monto)}</Text>
              <Text style={s.recSub}>{r.cliente} · {r.banco}</Text>
              {esRepetido(r) && (
                <View style={s.repetido}>
                  <Feather name="alert-triangle" size={12} color="#e0a94d" />
                  <Text style={s.repetidoTxt}>Mismo monto y referencia que otro pendiente</Text>
                </View>
              )}
            </View>
            <Feather name="eye" size={18} color={T.gris} />
          </Pressable>
        ))}
      </Tarjeta>

      <Tarjeta>
        <TituloTarjeta>Saldo por cliente</TituloTarjeta>
        {clientes.map((c, i) => (
          <View key={c.id} style={[s.cliFila, i < clientes.length - 1 && s.borde]}>
            <View style={{ flex: 1 }}>
              <Text style={s.cliNom}>{c.empresa}</Text>
              <Text style={s.cliSub}>Por pagar: {c.porPagar ? pesos(c.porPagar) : "—"}</Text>
            </View>
            <Text style={s.cliSaldo}>{pesos(c.saldo)}</Text>
          </View>
        ))}
      </Tarjeta>

      {/* Modal comprobante */}
      <Modal visible={!!ver} animationType="slide" transparent onRequestClose={() => (zoom ? setZoom(false) : setVer(null))}>
        <View style={s.modalFondo}>
          <View style={s.modal}>
            {ver && (
              <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 30 }}>
                <View style={s.modalCab}>
                  <View><Text style={s.modalCli}>{ver.cliente}</Text><Text style={s.modalFolio}>{ver.folio || folioCorto(ver.id, "DEP")} · {fechaLarga(ver.fecha)}</Text></View>
                  <Pressable onPress={() => { setZoom(false); setVer(null); }} hitSlop={10}><Feather name="x" size={22} color={T.gris} /></Pressable>
                </View>

                {/* comprobante — imagen real, toca para ver en grande */}
                <Text style={s.compLbl}>COMPROBANTE DE PAGO</Text>
                {urlComprobante ? (
                  <Pressable onPress={() => setZoom(true)} style={s.compBox}>
                    <Image source={{ uri: urlComprobante }} style={s.compImg} resizeMode="contain" />
                    <View style={s.compVer}><Feather name="maximize-2" size={13} color="#fff" /><Text style={s.compVerTxt}>Ver en grande</Text></View>
                  </Pressable>
                ) : ver.comprobante ? (
                  <View style={s.comprobante}>
                    <Feather name="loader" size={30} color={T.naranjaClaro} />
                    <Text style={s.compDemo}>Abriendo el comprobante…</Text>
                  </View>
                ) : (
                  <View style={s.comprobante}>
                    <Feather name="alert-circle" size={30} color="#e0a94d" />
                    <Text style={s.compNom}>Sin comprobante</Text>
                    <Text style={s.compDemo}>Este depósito se reportó sin imagen. Pídesela al cliente antes de aplicarlo.</Text>
                  </View>
                )}
                <Text style={s.compArchivo}>{ver.comprobanteNombre}</Text>

                <Text style={s.modalMonto}>{pesos(ver.monto)}</Text>
                <Dato k="Banco" v={ver.banco} />
                <Dato k="Referencia" v={ver.referencia} />
                <Dato k="Estado" v={estadoRecarga(ver.estado).texto} />

                {esRepetido(ver) && (
                  <View style={s.repetidoCaja}>
                    <Feather name="alert-triangle" size={14} color="#e0a94d" />
                    <Text style={s.repetidoCajaTxt}>
                      Cuidado: hay otro depósito pendiente de {ver.cliente} por el mismo monto y la
                      misma referencia. Revisa el banco antes de aplicar los dos.
                    </Text>
                  </View>
                )}

                <Text style={s.confirma}>Confirma que el depósito por {pesos(ver.monto)} se recibió antes de aplicar el saldo.</Text>

                {!!error && (
                  <View style={s.errorCaja}>
                    <Feather name="alert-circle" size={14} color="#e07d7d" />
                    <Text style={s.errorTxt}>{error}</Text>
                  </View>
                )}

                {puedeVerificar ? (
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                    <Boton onPress={() => aplicar(ver)} disabled={guardando} style={{ flex: 1 }}><Feather name="check-circle" size={15} color="#0d1211" /><Text style={{ color: "#0d1211", fontWeight: "700" }}>  Aplicar</Text></Boton>
                    <Boton variante="linea" onPress={() => rechazar(ver)} disabled={guardando} style={{ flex: 1 }}>{guardando ? "Guardando…" : "Rechazar"}</Boton>
                  </View>
                ) : (
                  <View style={s.candado}><Feather name="lock" size={13} color="#e0a94d" /><Text style={s.candadoTxt}>Solo {RESPONSABLE_RECARGAS.nombre} puede aplicar esta recarga.</Text></View>
                )}
              </ScrollView>
            )}
          </View>

          {/* Visor del comprobante: capa DENTRO del mismo modal (no un 2º Modal, que bloqueaba los toques) */}
          {zoom && urlComprobante && (
            <View style={s.zoomOverlay}>
              <Pressable style={s.zoomCerrar} onPress={() => setZoom(false)} hitSlop={12}>
                <Feather name="x" size={24} color="#fff" />
              </Pressable>
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={s.zoomScroll}
                showsVerticalScrollIndicator={false}
                maximumZoomScale={1}
                minimumZoomScale={1}
              >
                <Image source={{ uri: urlComprobante }} style={s.zoomImg} resizeMode="contain" />
              </ScrollView>
              <Text style={s.zoomTip}>Desliza para ver el comprobante completo</Text>
            </View>
          )}
        </View>
      </Modal>
    </ScrollView>
  );
}

function Dato({ k, v }) {
  return <View style={s.datoFila}><Text style={s.datoK}>{k}</Text><Text style={s.datoV}>{v}</Text></View>;
}

const s = StyleSheet.create({
  h1: { color: T.tinta, fontSize: 22, fontWeight: "800" },
  sub: { color: T.gris, fontSize: 13.5, marginTop: 3, marginBottom: 14, lineHeight: 19 },
  kpis: { flexDirection: "row", gap: 10, marginBottom: 14 },
  kpi: { flex: 1, backgroundColor: T.panel, borderWidth: 1, borderColor: T.linea, borderRadius: 14, padding: 12 },
  kpiEt: { color: T.gris, fontSize: 11 },
  kpiVal: { color: T.tinta, fontSize: 15.5, fontWeight: "800", marginTop: 4 },
  respIco: { width: 40, height: 40, borderRadius: 11, backgroundColor: "rgba(79,192,197,0.14)", alignItems: "center", justifyContent: "center" },
  respNom: { color: T.tinta, fontSize: 14.5, fontWeight: "700" },
  respRol: { color: T.gris, fontSize: 12.5, marginTop: 2 },
  toggle: { marginTop: 12, borderWidth: 1, borderColor: T.linea, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  toggleOn: { backgroundColor: T.naranja, borderColor: T.naranja },
  toggleTxt: { color: T.gris, fontSize: 12.5, fontWeight: "600" },
  candado: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 10, backgroundColor: "rgba(219,152,45,0.12)", borderRadius: 9, padding: 9 },
  candadoTxt: { color: "#e0a94d", fontSize: 12, flex: 1 },
  vacio: { color: T.gris, textAlign: "center", paddingVertical: 14 },
  recFila: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  borde: { borderBottomWidth: 1, borderBottomColor: T.linea },
  recMonto: { color: T.tinta, fontSize: 15.5, fontWeight: "800" },
  recSub: { color: T.gris, fontSize: 12.5, marginTop: 2 },
  cliFila: { flexDirection: "row", alignItems: "center", paddingVertical: 11 },
  cliNom: { color: T.tinta, fontSize: 14, fontWeight: "600" },
  cliSub: { color: T.gris, fontSize: 12, marginTop: 2 },
  cliSaldo: { color: T.verdeClaro, fontSize: 14.5, fontWeight: "700" },
  modalFondo: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modal: { backgroundColor: T.fondo, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: "92%", borderWidth: 1, borderColor: T.linea },
  modalCab: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalCli: { color: T.tinta, fontSize: 16, fontWeight: "800" },
  modalFolio: { color: T.gris, fontSize: 12, marginTop: 2 },
  repetido: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  repetidoTxt: { color: "#e0a94d", fontSize: 11.5, flex: 1 },
  repetidoCaja: { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: "rgba(224,169,77,0.10)", borderWidth: 1, borderColor: "rgba(224,169,77,0.35)", borderRadius: 10, padding: 10, marginTop: 12 },
  repetidoCajaTxt: { color: "#e0a94d", fontSize: 12.5, flex: 1, lineHeight: 17 },
  errorCaja: { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: "rgba(224,125,125,0.10)", borderWidth: 1, borderColor: "rgba(224,125,125,0.35)", borderRadius: 10, padding: 10, marginTop: 10 },
  errorTxt: { color: "#e07d7d", fontSize: 12.5, flex: 1, lineHeight: 17 },
  comprobante: { backgroundColor: T.panel, borderWidth: 1, borderColor: T.linea, borderRadius: 12, alignItems: "center", paddingVertical: 26, marginTop: 8 },
  compNom: { color: T.tinta, fontSize: 13.5, fontWeight: "600", marginTop: 8 },
  compDemo: { color: T.grisClaro, fontSize: 11.5, marginTop: 3 },
  compLbl: { color: T.gris, fontSize: 10.5, letterSpacing: 0.06, marginTop: 14, marginBottom: 7 },
  compBox: { borderWidth: 1, borderColor: T.linea, borderRadius: 12, overflow: "hidden", backgroundColor: "#0d1211" },
  compImg: { width: "100%", height: 300, backgroundColor: "#0d1211" },
  compVer: { position: "absolute", right: 10, bottom: 10, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 20, paddingHorizontal: 11, paddingVertical: 6 },
  compVerTxt: { color: "#fff", fontSize: 12, fontWeight: "600" },
  compArchivo: { color: T.grisClaro, fontSize: 11.5, marginTop: 6, textAlign: "center" },
  zoomOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#000", zIndex: 30 },
  zoomCerrar: { position: "absolute", top: 40, right: 18, zIndex: 40, width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  zoomScroll: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingVertical: 40 },
  zoomImg: { width: SCREEN_W, height: SCREEN_W * (620 / 480) },
  zoomTip: { position: "absolute", bottom: 24, left: 0, right: 0, textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: 12 },
  modalMonto: { color: T.tinta, fontSize: 26, fontWeight: "800", marginTop: 14 },
  datoFila: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: T.linea },
  datoK: { color: T.gris, fontSize: 13 },
  datoV: { color: T.tinta, fontSize: 13, fontWeight: "600" },
  confirma: { color: T.gris, fontSize: 12.5, marginTop: 12, lineHeight: 18 },
});
