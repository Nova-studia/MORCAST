import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Image, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Clipboard from "expo-clipboard";
import { T } from "../tema";
import { Tarjeta, TituloTarjeta, Badge, Boton } from "../ui";
import { CUENTA, DATOS_DEPOSITO, BANCOS, RECARGAS, CLIENTE, pesos, fechaLarga, estatusInfo } from "../datos";
import { miSaldo, misMovimientos, reportarDeposito, miEmpresa } from "../datos-remoto";

export default function AgregarSaldo() {
  const [monto, setMonto] = useState("");
  const [banco, setBanco] = useState(BANCOS[0]);
  // Se sugiere el RFC REAL de su empresa. El de `CLIENTE` es de ejemplo y
  // mandaba a todos a poner el mismo, que no es de nadie.
  const [referencia, setReferencia] = useState("");
  useEffect(() => {
    let vivo = true;
    miEmpresa().then((c) => {
      if (vivo && c) setReferencia((r) => r || c.rfc || c.id || "");
    });
    return () => { vivo = false; };
  }, []);
  const [comprobante, setComprobante] = useState(null);
  const [enviada, setEnviada] = useState(false);
  const [copiado, setCopiado] = useState("");
  const [recargas, setRecargas] = useState([]);
  const [cuenta, setCuenta] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  // El RLS ya dejó fuera lo de otras empresas: no hace falta filtrar aquí.
  const recargar = () =>
    Promise.all([misMovimientos(), miSaldo()]).then(([movs, saldo]) => {
      setRecargas(movs.filter((m) => m.tipo === "abono"));
      setCuenta(saldo);
    });

  useEffect(() => {
    let vivo = true;
    recargar().then(() => { if (!vivo) return; });
    return () => { vivo = false; };
  }, []);

  const montoNum = Number(String(monto).replace(/[^\d.]/g, "")) || 0;
  const puede = montoNum > 0 && comprobante;

  const desdeGaleria = async () => {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) return Alert.alert("Permiso necesario", "Activa el acceso a tus fotos.");
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6 });
    if (!r.canceled) { setComprobante(r.assets[0]); setEnviada(false); }
  };

  const desdeCamara = async () => {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) return Alert.alert("Permiso necesario", "Activa el acceso a la cámara.");
    const r = await ImagePicker.launchCameraAsync({ quality: 0.6 });
    if (!r.canceled) { setComprobante(r.assets[0]); setEnviada(false); }
  };

  const elegirComprobante = () => {
    Alert.alert("Subir comprobante", "¿Cómo quieres agregar tu comprobante?", [
      { text: "Tomar foto", onPress: desdeCamara },
      { text: "Elegir de galería", onPress: desdeGaleria },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  const copiar = async (texto, cual) => {
    await Clipboard.setStringAsync(texto.replace(/\s/g, ""));
    setCopiado(cual);
    setTimeout(() => setCopiado(""), 1500);
  };

  const enviar = async () => {
    if (!puede || enviando) return;
    setEnviando(true);
    setError("");

    // Se manda el ARCHIVO, no solo su nombre. Antes solo viajaba el nombre:
    // la cubeta quedaba vacia y quien aprobaba el dinero no veia nada.
    const r = await reportarDeposito({
      monto: montoNum,
      banco,
      referencia,
      comprobante,
    });

    if (!r.ok) {
      setError(r.motivo || "No se pudo enviar tu comprobante. Revisa tu señal e intenta otra vez.");
      setEnviando(false);
      return;
    }

    // Se relee de la base para que veas el registro tal como quedó guardado.
    await recargar();
    setEnviada(true);
    setMonto("");
    setComprobante(null);
    setEnviando(false);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.fondo }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      // Propiedad de iOS: deja que el sistema recorra el contenido cuando sale
      // el teclado. Viene apagada por omision y sin ella el campo de abajo se
      // queda tapado. En Android se ignora (alli lo resuelve el resize).
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
    >
      <Text style={s.h1}>Agregar saldo</Text>
      <Text style={s.sub}>Deposita a la cuenta de Morcast y sube tu comprobante. Lo verificamos y aplicamos el saldo.</Text>

      <View style={s.saldoMini}>
        <Text style={s.saldoLbl}>Saldo a favor actual</Text>
        <Text style={s.saldoVal}>{pesos((cuenta || CUENTA).saldoActual)}</Text>
      </View>

      {/* Datos de depósito */}
      <Tarjeta>
        <TituloTarjeta>Datos para depósito</TituloTarjeta>
        {/*
          Mientras los datos sean de demostración NO se enseña la CLABE ni la
          cuenta: son ceros. Un cliente que los copie no puede pagar, y se
          daría cuenta después del error, no antes.
        */}
        {DATOS_DEPOSITO.demo ? (
          <>
            <Dep k="Titular" v={DATOS_DEPOSITO.titular} />
            <Dep k="Referencia" v={DATOS_DEPOSITO.referencia} ultimo />
            <View style={s.nota}>
              <Feather name="info" size={14} color="#e0a94d" />
              <Text style={s.notaTxt}>
                Todavía no publicamos la cuenta aquí. Pídenos los datos para transferir
                por WhatsApp al 868 384 9478 o al correo contacto@morcast.mx, y sube tu
                comprobante en esta misma pantalla.
              </Text>
            </View>
          </>
        ) : (
          <>
            <Dep k="Banco" v={DATOS_DEPOSITO.banco} />
            <Dep k="Titular" v={DATOS_DEPOSITO.titular} />
            <Dep k="CLABE" v={DATOS_DEPOSITO.clabe} copiar={() => copiar(DATOS_DEPOSITO.clabe, "clabe")} copiado={copiado === "clabe"} />
            <Dep k="Cuenta" v={DATOS_DEPOSITO.cuenta} copiar={() => copiar(DATOS_DEPOSITO.cuenta, "cuenta")} copiado={copiado === "cuenta"} />
            <Dep k="Referencia" v={DATOS_DEPOSITO.referencia} ultimo />
          </>
        )}
      </Tarjeta>

      {/* Registrar comprobante */}
      <Tarjeta>
        <TituloTarjeta>Registrar comprobante</TituloTarjeta>

        {enviada && (
          <View style={s.exito}>
            <Feather name="check-circle" size={18} color={T.verdeClaro} />
            <Text style={s.exitoTxt}>Comprobante enviado. Quedó <Text style={{ fontWeight: "700" }}>por verificar</Text>; te avisaremos al aplicar el saldo.</Text>
          </View>
        )}

        <Text style={s.label}>Monto depositado (MXN)</Text>
        <TextInput style={s.input} placeholder="0.00" placeholderTextColor={T.grisClaro} keyboardType="decimal-pad" value={monto} onChangeText={(v) => { setMonto(v); setEnviada(false); }} />

        <Text style={s.label}>Referencia o folio</Text>
        <TextInput style={s.input} placeholder="RFC, contrato o clave de rastreo" placeholderTextColor={T.grisClaro} value={referencia} onChangeText={setReferencia} />

        <Text style={s.label}>Banco de origen</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
          {BANCOS.map((b) => (
            <Pressable key={b} onPress={() => setBanco(b)} style={[s.chip, banco === b && s.chipOn]}>
              <Text style={[s.chipTxt, banco === b && s.chipTxtOn]}>{b}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Pressable onPress={elegirComprobante} style={s.drop}>
          {comprobante ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Image source={{ uri: comprobante.uri }} style={s.preview} />
              <View style={{ flex: 1 }}>
                <Text style={s.dropTit}>Comprobante listo</Text>
                <Text style={s.dropSub}>Toca para cambiarlo</Text>
              </View>
            </View>
          ) : (
            <View style={{ alignItems: "center" }}>
              <Feather name="camera" size={26} color={T.verdeClaro} />
              <Text style={s.dropTit}>Subir comprobante</Text>
              <Text style={s.dropSub}>Toma una foto o elige de tu galería</Text>
            </View>
          )}
        </Pressable>

        {/* Botones rápidos cámara / galería */}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
          <Pressable onPress={desdeCamara} style={s.mini}><Feather name="camera" size={15} color={T.tinta} /><Text style={s.miniTxt}>Cámara</Text></Pressable>
          <Pressable onPress={desdeGaleria} style={s.mini}><Feather name="image" size={15} color={T.tinta} /><Text style={s.miniTxt}>Galería</Text></Pressable>
        </View>

        <Boton onPress={enviar} disabled={!puede || enviando} style={{ marginTop: 14 }}>
          {enviando ? "Enviando…" : "Enviar para verificación"}
        </Boton>

        {error ? <Text style={s.errorTxt}>{error}</Text> : null}
      </Tarjeta>

      {/* Mis recargas */}
      <Tarjeta>
        <TituloTarjeta>Mis recargas</TituloTarjeta>
        {recargas.map((r, i) => {
          const est = estatusInfo(r.estado);
          return (
            <View key={r.id} style={[s.fila, i < recargas.length - 1 && s.filaBorde]}>
              <View style={{ flex: 1 }}>
                <Text style={s.filaTit}>{pesos(r.monto)}</Text>
                <Text style={s.filaSub}>{fechaLarga(r.fecha)} · {r.banco}</Text>
              </View>
              <Badge clase={est.clase}>{est.texto}</Badge>
            </View>
          );
        })}
      </Tarjeta>
    </ScrollView>
  );
}

function Dep({ k, v, ultimo, copiar, copiado }) {
  return (
    <View style={[s.depFila, !ultimo && s.filaBorde]}>
      <Text style={s.depK}>{k}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 }}>
        <Text style={s.depV}>{v}</Text>
        {copiar && (
          <Pressable onPress={copiar} hitSlop={8}>
            <Feather name={copiado ? "check" : "copy"} size={15} color={copiado ? T.verdeClaro : T.gris} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  errorTxt: { color: "#ef8080", fontSize: 12.5, marginTop: 10, lineHeight: 18 },
  h1: { color: T.tinta, fontSize: 22, fontWeight: "800" },
  sub: { color: T.gris, fontSize: 13.5, marginTop: 3, marginBottom: 14, lineHeight: 19 },
  saldoMini: { backgroundColor: T.teal, borderRadius: 14, padding: 15, marginBottom: 14 },
  saldoLbl: { color: "#bfe0dd", fontSize: 12.5 },
  saldoVal: { color: "#fff", fontSize: 26, fontWeight: "800", marginTop: 3 },
  depFila: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 9, gap: 12 },
  depK: { color: T.gris, fontSize: 13 },
  depV: { color: T.tinta, fontSize: 13.5, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  filaBorde: { borderBottomWidth: 1, borderBottomColor: T.linea },
  nota: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 10, backgroundColor: "rgba(219,152,45,0.12)", borderRadius: 9, padding: 9 },
  notaTxt: { color: "#e0a94d", fontSize: 12, flex: 1 },
  label: { color: T.tinta, fontSize: 13, fontWeight: "700", marginTop: 12, marginBottom: 7 },
  input: { backgroundColor: T.panel2, borderWidth: 1, borderColor: T.linea, borderRadius: 11, paddingHorizontal: 14, paddingVertical: 12, color: T.tinta, fontSize: 15 },
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: T.linea, backgroundColor: T.panel2 },
  chipOn: { backgroundColor: T.verde, borderColor: T.verde },
  chipTxt: { color: T.gris, fontSize: 12.5, fontWeight: "600" },
  chipTxtOn: { color: "#0d1211" },
  drop: { borderWidth: 1.5, borderColor: T.linea, borderStyle: "dashed", borderRadius: 12, paddingVertical: 20, paddingHorizontal: 14, marginTop: 14 },
  dropTit: { color: T.tinta, fontSize: 14, fontWeight: "700", marginTop: 5 },
  dropSub: { color: T.gris, fontSize: 12, marginTop: 2 },
  preview: { width: 54, height: 68, borderRadius: 7, backgroundColor: "#fff" },
  mini: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: T.panel2, borderWidth: 1, borderColor: T.linea, borderRadius: 10, paddingVertical: 10 },
  miniTxt: { color: T.tinta, fontSize: 13, fontWeight: "600" },
  exito: { flexDirection: "row", alignItems: "flex-start", gap: 9, backgroundColor: "rgba(78,179,74,0.12)", borderWidth: 1, borderColor: "rgba(78,179,74,0.35)", borderRadius: 10, padding: 11, marginBottom: 6 },
  exitoTxt: { color: T.gris, fontSize: 13, flex: 1, lineHeight: 18 },
  fila: { flexDirection: "row", alignItems: "center", paddingVertical: 11 },
  filaTit: { color: T.tinta, fontSize: 14.5, fontWeight: "700" },
  filaSub: { color: T.gris, fontSize: 12, marginTop: 2 },
});
