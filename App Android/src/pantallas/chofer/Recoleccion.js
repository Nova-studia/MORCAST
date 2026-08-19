import { useState, useRef } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Image, TextInput, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { T } from "../../tema";
import { Tarjeta, Boton } from "../../ui";

const PASOS = ["Escanear", "Foto antes", "Recolectar", "Foto después", "Finalizar"];

export default function Recoleccion({ route, navigation, completar }) {
  const servicio = route.params.servicio;
  const [paso, setPaso] = useState(0);
  const [qrCodigo, setQrCodigo] = useState(null);
  const [codigoManual, setCodigoManual] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [fotoAntes, setFotoAntes] = useState(null);
  const [fotoDespues, setFotoDespues] = useState(null);
  const [horaAntes, setHoraAntes] = useState(null);
  const [horaDespues, setHoraDespues] = useState(null);
  const [peso, setPeso] = useState("");

  const horaAhora = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  const [escaneando, setEscaneando] = useState(false);
  const [permiso, pedirPermiso] = useCameraPermissions();
  const yaEscaneo = useRef(false);

  const abrirEscaner = async () => {
    if (!permiso?.granted) {
      const r = await pedirPermiso();
      if (!r.granted) { Alert.alert("Permiso de cámara", "Activa la cámara para escanear el QR del contenedor."); return; }
    }
    yaEscaneo.current = false;
    setEscaneando(true);
  };

  const alEscanear = ({ data }) => {
    if (yaEscaneo.current) return;
    yaEscaneo.current = true;
    setQrCodigo(data || servicio.qr);
    setEscaneando(false);
    setPaso(1);
  };

  /**
   * Toma la foto y avisa mientras se procesa.
   *
   * Entre que se cierra la cámara y aparece la foto pasan unos segundos en
   * los que la pantalla se ve normal. Sin aviso, el chofer cree que no se
   * tomó y vuelve a intentar, o se sale del paso.
   */
  const tomarFoto = async (cual) => {
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (!p.granted) { Alert.alert("Permiso de cámara", "Activa la cámara para tomar la foto."); return; }

    const r = await ImagePicker.launchCameraAsync({ quality: 0.5 });
    if (r.canceled) return;

    setProcesando(true);
    try {
      if (cual === "antes") { setFotoAntes(r.assets[0]); setHoraAntes(horaAhora()); setPaso(2); }
      else { setFotoDespues(r.assets[0]); setHoraDespues(horaAhora()); setPaso(4); }
    } finally {
      // El aviso se quita cuando la imagen ya está en pantalla, no antes: si
      // se apagara de inmediato volvería el hueco que estamos tapando.
      setTimeout(() => setProcesando(false), 350);
    }
  };

  const [guardando, setGuardando] = useState(false);

  const finalizar = async () => {
    if (guardando) return;

    if (!qrCodigo) {
      Alert.alert("Falta el contenedor", "Escanea el QR o escribe el código antes de cerrar el servicio.");
      return;
    }
    if (!(Number(peso) > 0)) {
      Alert.alert("Falta el peso", "Anota el peso recolectado en kilogramos. Si no lo pesaste, pon el estimado.");
      return;
    }

    setGuardando(true);

    // Se ESPERA a que la base confirme antes de avisar que quedo listo. Antes
    // se avisaba de inmediato: si la subida fallaba, el chofer se iba creyendo
    // que el servicio estaba registrado y no lo estaba.
    const r = await completar(servicio, {
      qr: qrCodigo,
      pesoKg: peso,
      antes: fotoAntes?.uri,
      despues: fotoDespues?.uri,
      horaAntes,
      horaDespues,
    });

    setGuardando(false);

    if (!r || !r.ok) {
      Alert.alert(
        "No se pudo guardar",
        (r && r.motivo) || "Revisa tu señal e intenta otra vez. Tus fotos siguen aquí.",
      );
      return;
    }

    Alert.alert("Servicio registrado ✅", `Recolección de ${servicio.cliente} completada. El comprobante ya está disponible para el cliente y el administrador.`, [
      { text: "Volver a mi ruta", onPress: () => navigation.goBack() },
    ]);
  };

  // ---- Escáner a pantalla completa (capa, no Modal) ----
  if (escaneando) {
    return (
      <View style={s.scan}>
        <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={alEscanear} />
        <View style={s.scanTop}>
          <Pressable onPress={() => setEscaneando(false)} style={s.scanCerrar}><Feather name="x" size={24} color="#fff" /></Pressable>
          <Text style={s.scanTitulo}>Escanea el QR del contenedor</Text>
        </View>
        <View style={s.marco} />
        <Text style={s.scanPie}>Apunta al código QR pegado en el contenedor</Text>
        <Pressable style={s.scanDemo} onPress={() => alEscanear({ data: servicio.qr })}>
          <Feather name="zap" size={14} color="#0d1211" />
          <Text style={s.scanDemoTxt}>  Simular escaneo (demo)</Text>
        </Pressable>
      </View>
    );
  }

  return (
    // El teclado tapaba los campos del final (el codigo y sobre todo el peso):
    // el chofer escribia a ciegas. Con esto la pantalla se recorre sola hasta
    // dejar el campo a la vista.
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: T.fondo }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
    <ScrollView
      style={{ flex: 1, backgroundColor: T.fondo }}
      contentContainerStyle={{ padding: 16, paddingBottom: 220 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Info del servicio */}
      <Tarjeta style={{ padding: 14 }}>
        <Text style={s.cliente}>{servicio.cliente}</Text>
        <Text style={s.dir}><Feather name="map-pin" size={11} color={T.gris} /> {servicio.direccion}</Text>
        <Text style={s.cont}>{servicio.contenedor} · {servicio.tipo}</Text>
      </Tarjeta>

      {/* Progreso */}
      <View style={s.pasos}>
        {PASOS.map((p, i) => (
          <View key={p} style={s.pasoItem}>
            <View style={[s.pasoDot, i < paso && s.pasoDone, i === paso && s.pasoActivo]}>
              {i < paso ? <Feather name="check" size={12} color="#0d1211" /> : <Text style={[s.pasoNum, i === paso && { color: "#0d1211" }]}>{i + 1}</Text>}
            </View>
            <Text style={[s.pasoLbl, i === paso && { color: T.tinta, fontWeight: "700" }]}>{p}</Text>
          </View>
        ))}
      </View>

      {/* Contenido por paso */}
      {paso === 0 && (
        <Tarjeta>
          <Paso icono="maximize" titulo="Identifica el contenedor" texto="Escanea el QR, o escribe el código si la calcomanía está borrada." />
          <Boton variante="teal" onPress={abrirEscaner} style={{ marginTop: 6 }}><Feather name="camera" size={16} color="#0d1211" /><Text style={s.btnTxt}>  Abrir escáner</Text></Boton>

          {/* Salida a mano: el QR se despega, se ensucia o no engancha con el
              sol de frente. Sin esto el chofer se queda atorado en el primer
              paso y no puede registrar un servicio que sí hizo. */}
          <Text style={s.label}>O escribe el código</Text>
          <TextInput
            style={s.input}
            placeholder="MOR-C-0000"
            placeholderTextColor={T.grisClaro}
            autoCapitalize="characters"
            autoCorrect={false}
            value={codigoManual}
            onChangeText={setCodigoManual}
          />
          <Boton
            onPress={() => { setQrCodigo(codigoManual.trim()); setPaso(1); }}
            disabled={!codigoManual.trim()}
            style={{ marginTop: 10 }}
          >
            <Feather name="check" size={16} color="#0d1211" /><Text style={s.btnTxt}>  Continuar</Text>
          </Boton>
        </Tarjeta>
      )}

      {paso >= 1 && (
        <Tarjeta>
          <View style={s.okFila}><Feather name="check-circle" size={16} color={T.verdeClaro} /><Text style={s.okTxt}>Contenedor identificado: <Text style={{ fontWeight: "700", color: T.tinta }}>{qrCodigo}</Text></Text></View>
        </Tarjeta>
      )}

      {paso === 1 && (
        <Tarjeta>
          <Paso icono="camera" titulo="Foto ANTES (contenedor lleno)" texto="Toma la foto del contenedor lleno como evidencia." />
          <Boton variante="teal" onPress={() => tomarFoto("antes")} style={{ marginTop: 6 }}><Feather name="camera" size={16} color="#0d1211" /><Text style={s.btnTxt}>  Tomar foto</Text></Boton>
        </Tarjeta>
      )}

      {paso >= 2 && fotoAntes && (
        <FotoHecha etiqueta="Antes (lleno)" uri={fotoAntes.uri} color="#e0a94d" onCambiar={() => tomarFoto("antes")} />
      )}

      {paso === 2 && (
        <Tarjeta>
          <Paso icono="truck" titulo="Recolecta los residuos" texto="Vacía el contenedor y confirma cuando termines." />
          <Boton variante="teal" onPress={() => setPaso(3)} style={{ marginTop: 6 }}>Ya recolecté</Boton>
        </Tarjeta>
      )}

      {paso === 3 && (
        <Tarjeta>
          <Paso icono="camera" titulo="Foto DESPUÉS (contenedor vacío)" texto="Toma la foto del contenedor vacío." />
          <Boton variante="teal" onPress={() => tomarFoto("despues")} style={{ marginTop: 6 }}><Feather name="camera" size={16} color="#0d1211" /><Text style={s.btnTxt}>  Tomar foto</Text></Boton>
        </Tarjeta>
      )}

      {paso >= 4 && fotoDespues && (
        <FotoHecha etiqueta="Después (vacío)" uri={fotoDespues.uri} color={T.verdeClaro} onCambiar={() => tomarFoto("despues")} />
      )}

      {paso === 4 && (
        <Tarjeta>
          <Paso icono="check-square" titulo="Cierra el servicio" texto="Registra el peso recolectado y finaliza." />
          <Text style={s.label}>Peso recolectado (kilogramos)</Text>
          {/* KILOS, no toneladas: es lo que guarda la base y lo que muestran la
              web y el comprobante del cliente. Antes decia toneladas y un 1.2
              se grababa como 1.2 kg, mil veces menos de lo recolectado. */}
          <TextInput style={s.input} placeholder="Ej. 1250" placeholderTextColor={T.grisClaro} keyboardType="decimal-pad" value={peso} onChangeText={setPeso} />
          <Text style={s.ayuda}>Si no lo pesaste, pon el estimado.</Text>
          <Boton onPress={finalizar} disabled={guardando} style={{ marginTop: 14 }}><Feather name="check-circle" size={16} color="#0d1211" /><Text style={s.btnTxt}>  {guardando ? "Guardando evidencia…" : "Finalizar servicio"}</Text></Boton>
        </Tarjeta>
      )}
    </ScrollView>

      {(procesando || guardando) && (
        <View style={s.capa} pointerEvents="auto">
          <View style={s.capaCaja}>
            <ActivityIndicator size="large" color={T.verdeClaro} />
            <Text style={s.capaTxt}>
              {guardando ? "Subiendo la evidencia…" : "Procesando la foto…"}
            </Text>
            <Text style={s.capaSub}>
              {guardando ? "No cierres la app." : "Espera un momento."}
            </Text>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function Paso({ icono, titulo, texto }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={s.pasoCab}><View style={s.pasoIco}><Feather name={icono} size={17} color={T.tealClaro} /></View><Text style={s.pasoTit}>{titulo}</Text></View>
      <Text style={s.pasoTexto}>{texto}</Text>
    </View>
  );
}

function FotoHecha({ etiqueta, uri, color, onCambiar }) {
  return (
    <Tarjeta style={{ padding: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Image source={{ uri }} style={s.thumb} />
        <View style={{ flex: 1 }}>
          <View style={[s.etq, { backgroundColor: color + "22" }]}><Text style={[s.etqTxt, { color }]}>{etiqueta}</Text></View>
          <Text style={s.fotoOk}>Foto tomada ✓</Text>
        </View>
        <Pressable onPress={onCambiar} hitSlop={8} style={{ padding: 6 }}><Feather name="refresh-cw" size={16} color={T.gris} /></Pressable>
      </View>
    </Tarjeta>
  );
}

const s = StyleSheet.create({
  cliente: { color: T.tinta, fontSize: 16, fontWeight: "800" },
  dir: { color: T.gris, fontSize: 12.5, marginTop: 3 },
  cont: { color: T.gris, fontSize: 12.5, marginTop: 2 },
  pasos: { flexDirection: "row", justifyContent: "space-between", marginVertical: 16, paddingHorizontal: 2 },
  pasoItem: { alignItems: "center", flex: 1 },
  pasoDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: T.linea, backgroundColor: T.panel, alignItems: "center", justifyContent: "center", marginBottom: 5 },
  pasoActivo: { backgroundColor: T.tealClaro, borderColor: T.tealClaro },
  pasoDone: { backgroundColor: T.verde, borderColor: T.verde },
  pasoNum: { color: T.gris, fontSize: 12, fontWeight: "700" },
  pasoLbl: { color: T.gris, fontSize: 9.5, textAlign: "center" },
  pasoCab: { flexDirection: "row", alignItems: "center", gap: 9 },
  pasoIco: { width: 34, height: 34, borderRadius: 10, backgroundColor: "rgba(79,192,197,0.14)", alignItems: "center", justifyContent: "center" },
  pasoTit: { color: T.tinta, fontSize: 14.5, fontWeight: "700", flex: 1 },
  pasoTexto: { color: T.gris, fontSize: 12.5, marginTop: 6, lineHeight: 18 },
  btnTxt: { color: "#0d1211", fontWeight: "700", fontSize: 14 },
  okFila: { flexDirection: "row", alignItems: "center", gap: 8 },
  okTxt: { color: T.gris, fontSize: 13, flex: 1 },
  ayuda: { color: T.gris, fontSize: 12, marginTop: 6 },
  capa: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(9, 15, 14, 0.72)",
    alignItems: "center", justifyContent: "center",
  },
  capaCaja: {
    backgroundColor: T.panel, borderRadius: 16, paddingVertical: 26,
    paddingHorizontal: 34, alignItems: "center",
    borderWidth: 1, borderColor: T.linea,
  },
  capaTxt: { color: T.tinta, fontSize: 15.5, fontWeight: "700", marginTop: 14 },
  capaSub: { color: T.gris, fontSize: 12.5, marginTop: 5 },
  label: { color: T.tinta, fontSize: 12.5, fontWeight: "700", marginTop: 6, marginBottom: 6 },
  input: { backgroundColor: T.panel2, borderWidth: 1, borderColor: T.linea, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, color: T.tinta, fontSize: 15 },
  thumb: { width: 56, height: 70, borderRadius: 8, backgroundColor: "#000" },
  etq: { alignSelf: "flex-start", borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  etqTxt: { fontSize: 11, fontWeight: "700" },
  fotoOk: { color: T.verdeClaro, fontSize: 12.5, marginTop: 5 },
  // escáner
  scan: { flex: 1, backgroundColor: "#000" },
  scanTop: { position: "absolute", top: 50, left: 0, right: 0, alignItems: "center", zIndex: 10 },
  scanCerrar: { position: "absolute", left: 18, top: -4, width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  scanTitulo: { color: "#fff", fontSize: 15, fontWeight: "700", marginTop: 6 },
  marco: { position: "absolute", alignSelf: "center", top: "32%", width: 240, height: 240, borderWidth: 3, borderColor: "#4fc0c5", borderRadius: 20 },
  scanPie: { position: "absolute", bottom: 110, left: 0, right: 0, textAlign: "center", color: "rgba(255,255,255,0.8)", fontSize: 13 },
  scanDemo: { position: "absolute", bottom: 50, alignSelf: "center", flexDirection: "row", alignItems: "center", backgroundColor: "#4fc0c5", borderRadius: 24, paddingHorizontal: 18, paddingVertical: 11 },
  scanDemoTxt: { color: "#0d1211", fontWeight: "700", fontSize: 13.5 },
});
