import { useState, useRef, useEffect } from "react";
import { subirEvidencia, contenedoresDelPunto } from "../../datos-remoto";
import { revisarContenedor } from "../../contenedores.js";
import DondeEs from "./DondeEs";
import EnCamino from "./EnCamino";
import useUbicacionFoto from "../../useUbicacionFoto";
import { selloFoto, esConfiable } from "../../evidencia.js";
import { View, Text, ScrollView, StyleSheet, Pressable, Image, TextInput, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { T } from "../../tema";
import { Tarjeta, Boton } from "../../ui";
import { pesoRealActivo } from "../../estado-sistema";

const PASOS = ["Escanear", "Foto antes", "Recolectar", "Foto después", "Finalizar"];

export default function Recoleccion({ route, navigation, completar, onEnRuta }) {
  // La parada puede ganar su pin aquí mismo ("Guardar la ubicación"): se
  // copia a un estado para que "Cómo llegar" lo use sin recargar la ruta.
  const [servicio, setServicio] = useState(route.params.servicio);
  const [paso, setPaso] = useState(0);
  const [qrCodigo, setQrCodigo] = useState(null);
  const [codigoManual, setCodigoManual] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [fotoAntes, setFotoAntes] = useState(null);
  const [fotoDespues, setFotoDespues] = useState(null);
  const [horaAntes, setHoraAntes] = useState(null);
  const [horaDespues, setHoraDespues] = useState(null);
  // Dónde quedó guardada cada foto. Se llena al tomarla, no al final.
  const [rutaAntes, setRutaAntes] = useState(null);
  const [rutaDespues, setRutaDespues] = useState(null);
  const [peso, setPeso] = useState("");

  // El sello de cada foto (6-oct-2026, como la web): cuándo (ISO, para la
  // base; `horaAntes` es solo lo que se enseña) y dónde. La ubicación NUNCA
  // detiene nada: si no hay, la foto y el cierre siguen sin sello.
  const gps = useUbicacionFoto();
  const [horaAntesISO, setHoraAntesISO] = useState(null);
  const [horaDespuesISO, setHoraDespuesISO] = useState(null);
  const [ubicacionAntes, setUbicacionAntes] = useState(null);
  const [ubicacionDespues, setUbicacionDespues] = useState(null);
  // Si la foto se tomó antes de que el GPS diera su primera lectura, la que
  // llegue en el siguiente minuto se le pega: el chofer sigue parado ahí.
  const momentoFoto = useRef({ antes: 0, despues: 0 });
  useEffect(() => {
    if (!gps.lectura) return;
    const reciente = (t) => t && Date.now() - t < 60000;
    if (fotoAntes && !ubicacionAntes && reciente(momentoFoto.current.antes)) setUbicacionAntes(gps.lectura);
    if (fotoDespues && !ubicacionDespues && reciente(momentoFoto.current.despues)) setUbicacionDespues(gps.lectura);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gps.lectura]);

  // Los contenedores registrados en este punto (inventario de db/023), para
  // revisar que el QR escaneado sea de aquí. `null` = no se pudo leer (sin
  // señal): en ese caso no se avisa nada, porque no hay contra qué comparar.
  const [contenedores, setContenedores] = useState(null);
  const [revision, setRevision] = useState(null);
  useEffect(() => {
    let vivo = true;
    if (servicio.punto?.id) {
      contenedoresDelPunto(servicio.punto.id).then((l) => { if (vivo) setContenedores(l); });
    }
    return () => { vivo = false; };
  }, [servicio.punto?.id]);

  // "No procedió" solo se puede en una parada abierta: la base no deja
  // cerrar así una que ya se completó (`solicitudes_cierra_operador`). Sin
  // estado es la ruta de demostración, donde todo está abierto.
  const puedeNoProcedio = ["confirmada", "en-ruta"].includes(servicio.estado) || !servicio.estado;

  /**
   * El contenedor quedó identificado (escaneado o escrito). Si el punto tiene
   * inventario y este código no es de aquí, se avisa CLARO, pero no se
   * bloquea: el servicio sí se hizo. El chofer decide si sigue (el código se
   * anota tal cual en la recolección) o reporta "contenedor movido".
   * Mismos textos que la app de iPhone.
   */
  const identificar = (codigo) => {
    // El permiso de ubicación se pide AHORA, con el contenedor ya
    // identificado y antes de la primera foto: en el momento de la foto el
    // diálogo se pelearía con la cámara. No se espera la respuesta.
    gps.pedir();
    const r = revisarContenedor(codigo, contenedores);
    const leido = r.codigo || String(codigo || "").trim();
    setQrCodigo(leido);
    setRevision(r);
    if (r.estado !== "ajeno") {
      setPaso(1);
      return;
    }
    Alert.alert(
      "Este contenedor no está registrado en este punto",
      `El código ${leido} no es de los contenedores de ${servicio.cliente}.\n\nPuede que lo hayan movido de otro cliente, o que el inventario esté mal. ¿Qué hacemos?`,
      [
        { text: "Volver a escanear", style: "cancel", onPress: () => { setQrCodigo(null); setRevision(null); } },
        {
          text: "Reportar contenedor movido",
          onPress: () => {
            setPaso(1);
            navigation.navigate("ReportarProblema", {
              tipo: "contenedor-movido",
              parada: servicio,
              codigo: leido,
              descripcion: `Escaneé el contenedor ${leido} en este punto y no está registrado aquí.`,
            });
          },
        },
        { text: "Continuar y anotarlo", onPress: () => setPaso(1) },
      ]
    );
  };

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
    setEscaneando(false);
    identificar(data || servicio.qr);
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
    const foto = r.assets[0];
    try {
      // La hora y el lugar se toman al disparar, no al cerrar el servicio.
      const cuando = new Date().toISOString();
      const donde = gps.ahora();
      momentoFoto.current[cual] = Date.now();
      if (cual === "antes") { setFotoAntes(foto); setHoraAntes(horaAhora()); setHoraAntesISO(cuando); setUbicacionAntes(donde); setPaso(2); }
      else { setFotoDespues(foto); setHoraDespues(horaAhora()); setHoraDespuesISO(cuando); setUbicacionDespues(donde); setPaso(4); }

      // La foto se SUBE aquí, no al cerrar el servicio. Guardarlas las dos
      // para el final es jugarse toda la evidencia a la señal que haya en ese
      // momento: si falla, el chofer tiene que rehacer la parada entera.
      const subida = await subirEvidencia(servicio.id, cual, foto.uri, foto.mimeType || "image/jpeg");
      if (subida?.ok && subida.ruta) {
        if (cual === "antes") setRutaAntes(subida.ruta);
        else setRutaDespues(subida.ruta);
      }
      // Si no subió, no se interrumpe al chofer: se reintenta al finalizar,
      // que es como funcionaba antes. Lo que no puede pasar es que se dé por
      // guardado sin estarlo, y de eso se encarga `finalizar`.
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
      Alert.alert(
        "Falta el peso estimado",
        "Anota cuántos kilos calculas que recogiste. " +
          (pesoRealActivo()
            ? "El peso real lo registra la oficina con el ticket de la báscula del relleno."
            : "Es un estimado: calcúlalo lo mejor que puedas.")
      );
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
      rutaAntes,
      rutaDespues,
      horaAntes,
      horaDespues,
      horaAntesISO,
      horaDespuesISO,
      ubicacionAntes,
      ubicacionDespues,
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
        {/* Atajo SOLO para desarrollo (`__DEV__` es false en los builds de
            la tienda). En producción dejaba al chofer "escanear" sin QR, y un
            botón "(demo)" en la App Store es motivo de rechazo (guía 2.2).
            Si la calcomanía no se lee, el primer paso ("O escribe el
            código") ya deja capturarlo a mano. */}
        {__DEV__ && (
          <Pressable style={s.scanDemo} onPress={() => alEscanear({ data: servicio.qr })}>
            <Feather name="zap" size={14} color="#0d1211" />
            <Text style={s.scanDemoTxt}>  Simular escaneo (demo)</Text>
          </Pressable>
        )}
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
        <Text style={s.cont}>{servicio.tipo}{servicio.nota ? ` · Nota: ${servicio.nota}` : ""}</Text>
        {/* Dirección completa, referencias, "Cómo llegar" y, si falta el
            pin, "Guardar la ubicación de este punto". */}
        <DondeEs
          parada={servicio}
          onUbicacionGuardada={({ lat, lng }) => setServicio((sv) => ({ ...sv, punto: { ...sv.punto, lat, lng } }))}
        />
        {/* "En camino": si todavía no salió hacia aquí, el primer paso es
            avisarle al cliente. No bloquea la recolección. */}
        <EnCamino
          parada={servicio}
          onEnRuta={(p, avisado) => {
            setServicio((sv) => ({ ...sv, estado: "en-ruta", clienteAvisado: avisado }));
            onEnRuta?.(p, avisado);
          }}
          style={{ marginTop: 12 }}
        />
      </Tarjeta>

      {/* Progreso */}
      <View style={s.pasos}>
        {PASOS.map((p, i) => (
          <View key={p} style={s.pasoItem}>
            <View style={[s.pasoDot, i < paso && s.pasoDone, i === paso && s.pasoActivo]}>
              {i < paso ? <Feather name="check" size={12} color="#fff" /> : <Text style={[s.pasoNum, i === paso && { color: "#0d1211" }]}>{i + 1}</Text>}
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
            onPress={() => identificar(codigoManual.trim())}
            disabled={!codigoManual.trim()}
            style={{ marginTop: 10 }}
          >
            <Feather name="check" size={16} color="#fff" /><Text style={s.btnTxt}>  Continuar</Text>
          </Boton>
        </Tarjeta>
      )}

      {paso >= 1 && (
        <Tarjeta>
          <View style={s.okFila}><Feather name="check-circle" size={16} color={T.verdeClaro} /><Text style={s.okTxt}>Contenedor identificado: <Text style={{ fontWeight: "700", color: T.tinta }}>{qrCodigo}</Text></Text></View>
          {revision?.estado === "ajeno" ? (
            <View style={[s.okFila, { marginTop: 8 }]}>
              <Feather name="alert-triangle" size={16} color={T.alerta} />
              <Text style={[s.okTxt, { color: T.alerta }]}>No está registrado en este punto. Se anota tal cual; la oficina lo revisará.</Text>
            </View>
          ) : null}
        </Tarjeta>
      )}

      {paso === 1 && (
        <Tarjeta>
          <Paso icono="camera" titulo="Foto ANTES (contenedor lleno)" texto="Toma la foto del contenedor lleno como evidencia." />
          <EstadoGps gps={gps} />
          <Boton variante="teal" onPress={() => tomarFoto("antes")} style={{ marginTop: 6 }}><Feather name="camera" size={16} color="#0d1211" /><Text style={s.btnTxt}>  Tomar foto</Text></Boton>
        </Tarjeta>
      )}

      {paso >= 2 && fotoAntes && (
        <FotoHecha etiqueta="Antes (lleno)" uri={fotoAntes.uri} color="#e0a94d" ubicacion={ubicacionAntes} onCambiar={() => tomarFoto("antes")} />
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
          <EstadoGps gps={gps} />
          <Boton variante="teal" onPress={() => tomarFoto("despues")} style={{ marginTop: 6 }}><Feather name="camera" size={16} color="#0d1211" /><Text style={s.btnTxt}>  Tomar foto</Text></Boton>
        </Tarjeta>
      )}

      {paso >= 4 && fotoDespues && (
        <FotoHecha etiqueta="Después (vacío)" uri={fotoDespues.uri} color={T.verdeClaro} ubicacion={ubicacionDespues} onCambiar={() => tomarFoto("despues")} />
      )}

      {paso === 4 && (
        <Tarjeta>
          <Paso icono="check-square" titulo="Cierra el servicio" texto="Registra el peso recolectado y finaliza." />
          {/* ESTIMADO: el chofer no tiene báscula. El real lo pone la oficina
              con el ticket del relleno (db/023, peso_real_kg) y es el que
              manda en los reportes; hoy está apagado (`pesoRealActivo()`). Decir "peso" a secas hacía pensar que
              este número era el que se cobraba. */}
          <Text style={s.label}>Peso estimado (kg)</Text>
          {/* KILOS, no toneladas: es lo que guarda la base y lo que muestran la
              web y el comprobante del cliente. Antes decia toneladas y un 1.2
              se grababa como 1.2 kg, mil veces menos de lo recolectado. */}
          <TextInput style={s.input} placeholder="Ej. 1250" placeholderTextColor={T.grisClaro} keyboardType="decimal-pad" value={peso} onChangeText={setPeso} />
          <Text style={s.ayuda}>
            {pesoRealActivo()
              ? "El peso real lo registra la oficina con el ticket de la báscula del relleno."
              : "Es un estimado: calcúlalo lo mejor que puedas."}
          </Text>
          <Boton onPress={finalizar} disabled={guardando} style={{ marginTop: 14 }}><Feather name="check-circle" size={16} color="#0d1211" /><Text style={s.btnTxt}>  {guardando ? "Guardando evidencia…" : "Finalizar servicio"}</Text></Boton>
        </Tarjeta>
      )}

      {/* Las salidas cuando la recolección no sale como se agendó. Van al pie,
          siempre a la vista, y en gris: no compiten con el paso que toca. */}
      <View style={s.salidas}>
        {puedeNoProcedio ? (
          <Boton variante="linea" onPress={() => navigation.navigate("NoProcedio", { parada: servicio })} style={{ flex: 1 }}>
            <Feather name="slash" size={15} color={T.tinta} />
            <Text style={{ color: T.tinta, fontWeight: "700" }}>  No procedió</Text>
          </Boton>
        ) : null}
        <Boton variante="linea" onPress={() => navigation.navigate("ReportarProblema", { parada: servicio, codigo: qrCodigo || undefined })} style={{ flex: 1 }}>
          <Feather name="alert-triangle" size={15} color={T.tinta} />
          <Text style={{ color: T.tinta, fontWeight: "700" }}>  Reportar problema</Text>
        </Boton>
      </View>
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

/**
 * Cómo va el GPS antes de la foto. Informa, no detiene: con cualquier
 * estado el botón de la foto funciona igual.
 */
function EstadoGps({ gps }) {
  const l = gps.lectura;
  let icono = "map-pin";
  let color = T.gris;
  let texto = "La foto se sella con tu ubicación.";
  if (gps.estado === "lista" && l) {
    if (esConfiable(l)) { color = T.verdeClaro; texto = `Ubicación lista · ±${l.precision_m} m`; }
    else { color = T.alerta; texto = `Señal débil · ±${l.precision_m ?? "?"} m. La foto se guarda igual.`; }
  } else if (gps.estado === "pidiendo") {
    icono = "loader"; texto = "Buscando señal de GPS…";
  } else if (gps.estado === "negada") {
    icono = "slash"; color = T.alerta; texto = "Sin permiso de ubicación: la foto se guarda igual, sin sello.";
  } else if (gps.estado === "sin-senal" || gps.estado === "no-disponible") {
    icono = "slash"; color = T.alerta; texto = "Sin ubicación: la foto se guarda igual, sin sello.";
  }
  return (
    <View style={s.gps} accessibilityLiveRegion="polite">
      <Feather name={icono} size={13} color={color} />
      <Text style={[s.gpsTxt, { color }]}>{texto}</Text>
    </View>
  );
}

function FotoHecha({ etiqueta, uri, color, ubicacion, onCambiar }) {
  const sello = selloFoto(ubicacion);
  return (
    <Tarjeta style={{ padding: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Image source={{ uri }} style={s.thumb} />
        <View style={{ flex: 1 }}>
          <View style={[s.etq, { backgroundColor: color + "22" }]}><Text style={[s.etqTxt, { color }]}>{etiqueta}</Text></View>
          <Text style={s.fotoOk}>Foto tomada ✓</Text>
          <Text style={[s.fotoSello, sello.estado !== "ok" && { color: T.alerta }]}>
            <Feather name={sello.estado === "sin" ? "slash" : "map-pin"} size={11} /> {sello.texto}
          </Text>
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
  pasoDone: { backgroundColor: T.verdeMarca, borderColor: T.verdeMarca },
  pasoNum: { color: T.gris, fontSize: 12, fontWeight: "700" },
  pasoLbl: { color: T.gris, fontSize: 9.5, textAlign: "center" },
  pasoCab: { flexDirection: "row", alignItems: "center", gap: 9 },
  pasoIco: { width: 34, height: 34, borderRadius: 10, backgroundColor: "rgba(79,192,197,0.14)", alignItems: "center", justifyContent: "center" },
  pasoTit: { color: T.tinta, fontSize: 14.5, fontWeight: "700", flex: 1 },
  pasoTexto: { color: T.gris, fontSize: 12.5, marginTop: 6, lineHeight: 18 },
  btnTxt: { color: "#fff", fontWeight: "700", fontSize: 14 },
  okFila: { flexDirection: "row", alignItems: "center", gap: 8 },
  okTxt: { color: T.gris, fontSize: 13, flex: 1 },
  ayuda: { color: T.gris, fontSize: 12, marginTop: 6, lineHeight: 17 },
  salidas: { flexDirection: "row", gap: 10, marginTop: 10 },
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
  fotoSello: { color: T.gris, fontSize: 11.5, marginTop: 3 },
  gps: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: -4, marginBottom: 8 },
  gpsTxt: { fontSize: 12, flex: 1, lineHeight: 16 },
  // escáner
  scan: { flex: 1, backgroundColor: "#000" },
  scanTop: { position: "absolute", top: 50, left: 0, right: 0, alignItems: "center", zIndex: 10 },
  scanCerrar: { position: "absolute", left: 18, top: -4, width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  scanTitulo: { color: "#fff", fontSize: 15, fontWeight: "700", marginTop: 6 },
  marco: { position: "absolute", alignSelf: "center", top: "32%", width: 240, height: 240, borderWidth: 3, borderColor: T.accionTxt, borderRadius: 20 },
  scanPie: { position: "absolute", bottom: 110, left: 0, right: 0, textAlign: "center", color: "rgba(255,255,255,0.8)", fontSize: 13 },
  scanDemo: { position: "absolute", bottom: 50, alignSelf: "center", flexDirection: "row", alignItems: "center", backgroundColor: T.accionTxt, borderRadius: 24, paddingHorizontal: 18, paddingVertical: 11 },
  scanDemoTxt: { color: "#0d1211", fontWeight: "700", fontSize: 13.5 },
});
