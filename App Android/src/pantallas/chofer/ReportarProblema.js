import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Image, Alert, Linking, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { T } from "../../tema";
import { Boton } from "../../ui";
import {
  TIPOS_INCIDENTE, tipoIncidente, esDeContenedor, validarReporte,
  TELEFONO_OFICINA, TELEFONO_OFICINA_ENLACE, LIMITES_REPORTE,
} from "../../chofer-reportes.js";
import { normalizarCodigo } from "../../contenedores.js";
import { reportarIncidente, subirFotoIncidente, contenedoresDelPunto } from "../../datos-remoto";
import { leerUbicacion } from "../../gps";

/**
 * "REPORTAR UN PROBLEMA" — siempre a la mano en el modo chofer.
 *
 * Pedido de los dueños (4-oct-2026): un botón para avisar a la oficina de un
 * accidente, un retraso, una falla, o de un contenedor dañado, movido o que
 * no está. Se guarda en `incidentes` y la web avisa a la oficina por push y
 * correo (`/api/app/incidente-avisado`).
 *
 * Con el accidente lo primero es LLAMAR: el botón de la oficina sale arriba
 * y grande. Un formulario no sustituye una llamada cuando hay alguien
 * lastimado; el reporte queda para el registro.
 *
 * El GPS se manda si se puede leer (dice dónde pasó), pero sin él el reporte
 * se manda igual: con un choque encima nadie debe pelearse con un permiso.
 *
 * Gemelo de la app de iPhone (`App IOS/.../ReportarProblema.js`, mismos
 * textos) y de la web (`Web/components/chofer/ChoferReporte.js`). Las reglas
 * (qué pide cada tipo) salen de `chofer-reportes.js`, copia de la web.
 */
export default function ReportarProblema({ route, navigation, ruta = [] }) {
  const desde = route.params || {};
  const [tipo, setTipo] = useState(desde.tipo || "");
  const [descripcion, setDescripcion] = useState(desde.descripcion || "");
  const [minutos, setMinutos] = useState("");
  // La parada: la que traiga quien abrió esta pantalla (la recolección), o
  // la que elija el chofer de su ruta de hoy.
  const [paradaId, setParadaId] = useState(desde.parada?.id || null);
  const [contenedores, setContenedores] = useState([]);
  const [contenedorId, setContenedorId] = useState(null);
  const [foto, setFoto] = useState(null);
  const [error, setError] = useState({});
  const [enviando, setEnviando] = useState(false);

  const paradas = desde.parada ? [desde.parada] : ruta.filter((p) => p.estatus === "pendiente");
  const parada = paradas.find((p) => p.id === paradaId) || null;
  const t = tipoIncidente(tipo);

  // Los contenedores del punto, para decir CUÁL (solo en los tipos de
  // contenedor). Sin inventario, la lista sale vacía y no se pregunta.
  useEffect(() => {
    let vivo = true;
    setContenedorId(null);
    if (!parada?.punto?.id) { setContenedores([]); return; }
    contenedoresDelPunto(parada.punto.id).then((l) => {
      if (!vivo) return;
      setContenedores(l || []);
      // Si viene del escáner, se preselecciona el que se leyó (si existe).
      if (desde.codigo) {
        const c = (l || []).find((x) => normalizarCodigo(x.codigo) === normalizarCodigo(desde.codigo));
        if (c) setContenedorId(c.id);
      }
    });
    return () => { vivo = false; };
  }, [parada?.punto?.id]);

  const llamar = () =>
    Linking.openURL(TELEFONO_OFICINA_ENLACE).catch(() =>
      Alert.alert("No se pudo llamar", `Marca a la oficina: ${TELEFONO_OFICINA}.`)
    );

  const tomarFoto = async () => {
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (!p.granted) { Alert.alert("Permiso de cámara", "Activa la cámara para tomar la foto."); return; }
    const r = await ImagePicker.launchCameraAsync({ quality: 0.5 });
    if (!r.canceled) setFoto(r.assets[0]);
  };

  const enviar = async () => {
    const entrada = { tipo, descripcion, retrasoMin: minutos.trim(), solicitudId: paradaId, contenedorId };
    const v = validarReporte(entrada);
    if (!v.ok) { setError({ [v.campo]: v.mensaje }); return; }
    setError({});
    setEnviando(true);

    // GPS rápido y sin insistir: 10 s y precisión normal. Si no hay, se manda sin él.
    const gps = await leerUbicacion({ alta: false, espera: 10000 });

    let rutaFoto = null;
    if (foto?.uri) {
      const subida = await subirFotoIncidente(foto.uri, foto.mimeType || "image/jpeg");
      if (!subida.ok) {
        setEnviando(false);
        Alert.alert("No se pudo subir la foto", `${subida.motivo || "Revisa tu señal."}\n\nPuedes quitar la foto y mandar el reporte sin ella.`);
        return;
      }
      rutaFoto = subida.ruta;
    }

    const r = await reportarIncidente({ ...entrada, ubicacion: gps.ok ? gps.lectura : null, foto: rutaFoto });
    setEnviando(false);
    if (!r.ok) {
      if (r.campo) setError({ [r.campo]: r.motivo });
      else Alert.alert("No se pudo mandar el reporte", r.motivo || "Revisa tu señal e inténtalo otra vez.");
      return;
    }
    const urgente = t?.urgente;
    Alert.alert(
      "Reporte enviado ✅",
      r.avisado || r.demo
        ? "La oficina ya recibió el aviso."
        : `Quedó guardado y la oficina lo verá en el panel.${urgente ? ` Si es urgente, llama: ${TELEFONO_OFICINA}.` : ""}`,
      [{ text: "Listo", onPress: () => navigation.goBack() }]
    );
  };

  const grupo = (g) => TIPOS_INCIDENTE.filter((x) => x.grupo === g);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: T.fondo }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        {/* Llamar va primero y siempre: con un accidente no se escribe, se llama. */}
        <Pressable onPress={llamar} style={({ pressed }) => [s.llamar, tipo === "accidente" && s.llamarUrgente, pressed && { opacity: 0.85 }]} accessibilityRole="button">
          <Feather name="phone-call" size={20} color={tipo === "accidente" ? "#fff" : T.tinta} />
          <View style={{ flex: 1 }}>
            <Text style={[s.llamarTit, tipo === "accidente" && { color: "#fff" }]}>Llamar a la oficina</Text>
            <Text style={[s.llamarSub, tipo === "accidente" && { color: "#fff" }]}>{TELEFONO_OFICINA}</Text>
          </View>
        </Pressable>
        {tipo === "accidente" ? (
          <Text style={s.urgente}>Si hay alguien lastimado, llama primero (o al 911). El reporte puede esperar.</Text>
        ) : null}

        <Text style={s.label}>En el camino</Text>
        <View style={s.chips}>
          {grupo("camino").map((x) => <Chip key={x.id} x={x} on={tipo === x.id} onPress={() => { setTipo(x.id); setError({}); }} />)}
        </View>
        <Text style={s.label}>Con el contenedor</Text>
        <View style={s.chips}>
          {grupo("contenedor").map((x) => <Chip key={x.id} x={x} on={tipo === x.id} onPress={() => { setTipo(x.id); setError({}); }} />)}
        </View>
        {t ? <Text style={s.ayuda}>{t.ayuda}</Text> : null}
        {error.tipo ? <Text style={s.error}>{error.tipo}</Text> : null}

        {tipo === "retraso" ? (
          <>
            <Text style={s.label}>¿Cuántos minutos de retraso, más o menos?</Text>
            <TextInput
              style={[s.input, s.inputCorto, error.retrasoMin && { borderColor: T.error }]}
              keyboardType="number-pad"
              placeholder="Ej. 40"
              placeholderTextColor={T.grisClaro}
              value={minutos}
              onChangeText={(v) => { setMinutos(v.replace(/\D/g, "").slice(0, 4)); setError({}); }}
            />
            {error.retrasoMin ? <Text style={s.error}>{error.retrasoMin}</Text> : null}
          </>
        ) : null}

        {paradas.length > 0 && (tipo === "" || esDeContenedor(tipo) || desde.parada) ? (
          <>
            <Text style={s.label}>{desde.parada ? "Parada" : "¿En qué parada? (opcional)"}</Text>
            {paradas.map((p) => (
              <Pressable key={p.id} disabled={!!desde.parada} onPress={() => setParadaId(paradaId === p.id ? null : p.id)} style={[s.opcion, paradaId === p.id && s.opcionOn]}>
                <Feather name={paradaId === p.id ? "check-circle" : "circle"} size={17} color={paradaId === p.id ? T.campo : T.gris} />
                <Text style={[s.opcionTxt, paradaId === p.id && { color: T.tinta }]} numberOfLines={2}>{p.cliente} · {p.direccion}</Text>
              </Pressable>
            ))}
          </>
        ) : null}

        {esDeContenedor(tipo) && contenedores.length > 0 ? (
          <>
            <Text style={s.label}>¿Cuál contenedor? (opcional)</Text>
            <View style={s.chips}>
              {contenedores.map((c) => (
                <Pressable key={c.id} onPress={() => setContenedorId(contenedorId === c.id ? null : c.id)} style={[s.chip, contenedorId === c.id && s.chipOn]}>
                  <Text style={[s.chipTxt, contenedorId === c.id && s.chipTxtOn]}>{c.codigo}{c.medida ? ` · ${c.medida}` : ""}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        <Text style={s.label}>{tipo === "otro" ? "¿Qué pasó? (obligatorio)" : "¿Algo más? (opcional)"}</Text>
        <TextInput
          style={[s.input, error.descripcion && { borderColor: T.error }]}
          placeholder="Lo que la oficina deba saber"
          placeholderTextColor={T.grisClaro}
          value={descripcion}
          onChangeText={(v) => { setDescripcion(v); setError({}); }}
          multiline
          maxLength={LIMITES_REPORTE.descripcion}
        />
        {error.descripcion ? <Text style={s.error}>{error.descripcion}</Text> : null}

        <Text style={s.label}>Foto (opcional)</Text>
        {foto ? (
          <View style={s.fotoFila}>
            <Image source={{ uri: foto.uri }} style={s.thumb} />
            <Text style={s.fotoOk}>Foto lista ✓</Text>
            <Pressable onPress={() => setFoto(null)} hitSlop={8} style={{ padding: 6 }} accessibilityLabel="Quitar la foto">
              <Feather name="trash-2" size={18} color={T.gris} />
            </Pressable>
          </View>
        ) : (
          <Boton variante="linea" onPress={tomarFoto}>
            <Feather name="camera" size={16} color={T.tinta} />
            <Text style={{ color: T.tinta, fontWeight: "700" }}>  Tomar foto</Text>
          </Boton>
        )}

        <Boton variante="naranja" onPress={enviar} disabled={enviando || !tipo} style={{ marginTop: 22 }}>
          {enviando ? "Mandando…" : "Mandar reporte a la oficina"}
        </Boton>
        <Text style={s.nota}>Se manda con tu ubicación si el GPS la tiene, para que la oficina sepa dónde fue.</Text>
      </ScrollView>
      {enviando && (
        <View style={s.capa}>
          <View style={s.capaCaja}>
            <ActivityIndicator size="large" color={T.campo} />
            <Text style={s.capaTxt}>Mandando el reporte…</Text>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function Chip({ x, on, onPress }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, on && s.chipOn]} accessibilityRole="radio" accessibilityState={{ selected: on }}>
      <Text style={[s.chipTxt, on && s.chipTxtOn]}>{x.texto}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  llamar: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: T.panel, borderWidth: 1, borderColor: T.linea, borderRadius: 13, padding: 14, minHeight: 56 },
  llamarUrgente: { backgroundColor: "#b5463a", borderColor: "#b5463a" },
  llamarTit: { color: T.tinta, fontSize: 15, fontWeight: "800" },
  llamarSub: { color: T.gris, fontSize: 13, marginTop: 2 },
  urgente: { color: T.error, fontSize: 13, marginTop: 8, lineHeight: 18, fontWeight: "600" },
  label: { color: T.tinta, fontSize: 13, fontWeight: "700", marginTop: 16, marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  // Chips grandes: se tocan con guantes y con el sol de frente.
  chip: { paddingVertical: 11, paddingHorizontal: 14, borderRadius: 11, borderWidth: 1, borderColor: T.linea, backgroundColor: T.panel, minHeight: 44, justifyContent: "center" },
  chipOn: { backgroundColor: T.campo, borderColor: T.campo },
  chipTxt: { color: T.tinta, fontSize: 13.5, fontWeight: "600" },
  chipTxtOn: { color: "#0d1211", fontWeight: "800" },
  ayuda: { color: T.gris, fontSize: 12.5, marginTop: 8 },
  input: { backgroundColor: T.panel2, borderWidth: 1, borderColor: T.linea, borderRadius: 10, padding: 12, color: T.tinta, fontSize: 14.5, minHeight: 80, textAlignVertical: "top" },
  inputCorto: { minHeight: 0, width: 140, fontSize: 18, fontWeight: "700" },
  error: { color: T.error, fontSize: 12.5, marginTop: 4 },
  opcion: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: T.panel, borderWidth: 1, borderColor: T.linea, borderRadius: 11, paddingVertical: 12, paddingHorizontal: 12, marginBottom: 8, minHeight: 46 },
  opcionOn: { borderColor: T.campo, backgroundColor: "rgba(219,101,45,0.10)" },
  opcionTxt: { color: T.gris, fontSize: 13.5, flex: 1 },
  fotoFila: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: T.panel, borderRadius: 11, borderWidth: 1, borderColor: T.linea, padding: 10 },
  thumb: { width: 56, height: 70, borderRadius: 8, backgroundColor: "#000" },
  fotoOk: { color: T.ok, fontSize: 13, flex: 1 },
  nota: { color: T.grisClaro, fontSize: 12, marginTop: 10, textAlign: "center", lineHeight: 17 },
  capa: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(9,15,14,0.72)", alignItems: "center", justifyContent: "center" },
  capaCaja: { backgroundColor: T.panel, borderRadius: 16, paddingVertical: 24, paddingHorizontal: 30, alignItems: "center", borderWidth: 1, borderColor: T.linea },
  capaTxt: { color: T.tinta, fontSize: 15, fontWeight: "700", marginTop: 12 },
});
