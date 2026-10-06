import { useEffect, useState } from "react";
import { View, Text, Image, Pressable, Modal, StyleSheet, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "./tema";
import { enlaceEvidencia } from "./datos-remoto";
import { selloFoto } from "./evidencia.mjs";

/**
 * EL COMPROBANTE FOTOGRÁFICO: antes y después, con su hora y su sello de
 * ubicación, y la foto en grande al tocarla (6-oct-2026).
 *
 * Lo usan el Historial del cliente y el chofer al abrir una parada
 * completada. Antes el cliente no veía las fotos (la consulta traía los
 * enlaces pero la pantalla no pintaba ninguna imagen) y el chofer veía
 * "Foto registrada" en vez de su foto.
 *
 * De dónde sale cada foto, en este orden:
 *   · `uri`  — la que el chofer acaba de tomar (en el teléfono).
 *   · `url`  — enlace firmado que ya viene hecho.
 *   · `ruta` — la ruta en la cubeta `evidencias`: el enlace se firma AQUÍ, al
 *              enseñarse, porque caduca y firmar todas al cargar la lista
 *              serían dos llamadas por servicio que nadie abrió.
 * Si no se puede (sin señal, foto borrada), "Foto no disponible": nunca
 * tumba la tarjeta ni la lista.
 *
 * ⚠️ ESTE ARCHIVO ESTÁ DUPLICADO en las dos apps; solo cambia la extensión
 * del import de `evidencia` (`.mjs` en iOS, `.js` en Android).
 */
export default function FotosEvidencia({ antes, despues, conSello = true }) {
  const [viendo, setViendo] = useState(null); // "antes" | "despues" | null
  const [fuentes, setFuentes] = useState({ antes: null, despues: null });

  return (
    <View>
      <View style={s.fila}>
        <Foto
          tipo="antes" dato={antes} conSello={conSello}
          alTener={(u) => setFuentes((f) => ({ ...f, antes: u }))}
          onPress={() => setViendo("antes")}
        />
        <Foto
          tipo="despues" dato={despues} conSello={conSello}
          alTener={(u) => setFuentes((f) => ({ ...f, despues: u }))}
          onPress={() => setViendo("despues")}
        />
      </View>

      <Modal visible={!!viendo} transparent animationType="fade" onRequestClose={() => setViendo(null)}>
        <View style={s.visor}>
          <View style={s.visorCab}>
            <View style={s.visorTabs}>
              {["antes", "despues"].map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setViendo(t)}
                  style={[s.visorTab, viendo === t && s.visorTabOn]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: viendo === t }}
                >
                  <Text style={[s.visorTabTxt, viendo === t && { color: "#0d1211" }]}>{t === "antes" ? "Antes" : "Después"}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => setViendo(null)} hitSlop={12} style={s.visorCerrar} accessibilityRole="button" accessibilityLabel="Cerrar la foto">
              <Feather name="x" size={24} color="#fff" />
            </Pressable>
          </View>
          {viendo && fuentes[viendo] ? (
            <Image source={{ uri: fuentes[viendo] }} style={s.visorImg} resizeMode="contain" accessibilityLabel={`Foto de ${viendo === "antes" ? "antes" : "después"}`} />
          ) : (
            <View style={[s.visorImg, s.centro]}>
              <Feather name="image" size={34} color={T.grisClaro} />
              <Text style={s.noDisp}>Foto no disponible</Text>
            </View>
          )}
          {viendo ? (
            <Text style={s.visorPie}>
              {viendo === "antes" ? "Antes · contenedor lleno" : "Después · contenedor vacío"}
              {(viendo === "antes" ? antes : despues)?.hora ? ` · ${(viendo === "antes" ? antes : despues).hora}` : ""}
              {conSello ? ` · ${selloFoto((viendo === "antes" ? antes : despues)?.ubicacion).texto}` : ""}
            </Text>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

function Foto({ tipo, dato, conSello, alTener, onPress }) {
  const directa = dato?.uri || dato?.url || null;
  const [src, setSrc] = useState(directa);
  const [estado, setEstado] = useState(directa ? "lista" : dato?.ruta ? "cargando" : "sin");

  useEffect(() => {
    let vivo = true;
    const d = dato?.uri || dato?.url || null;
    if (d) {
      setSrc(d); setEstado("lista"); alTener?.(d);
      return () => { vivo = false; };
    }
    if (!dato?.ruta) { setSrc(null); setEstado("sin"); alTener?.(null); return () => { vivo = false; }; }
    setEstado("cargando");
    enlaceEvidencia(dato.ruta)
      .then((u) => {
        if (!vivo) return;
        setSrc(u || null);
        setEstado(u ? "lista" : "falla");
        alTener?.(u || null);
      })
      .catch(() => { if (vivo) setEstado("falla"); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dato?.uri, dato?.url, dato?.ruta]);

  const esAntes = tipo === "antes";
  const sello = selloFoto(dato?.ubicacion);
  const colorSello = sello.estado === "ok" ? T.verdeClaro : sello.estado === "debil" ? T.alerta : T.grisClaro;
  const abrible = estado === "lista" && !!src;

  return (
    <Pressable
      onPress={abrible ? onPress : undefined}
      disabled={!abrible}
      style={s.caja}
      accessibilityRole={abrible ? "imagebutton" : "image"}
      accessibilityLabel={`Foto de ${esAntes ? "antes" : "después"}${abrible ? ", toca para verla en grande" : ""}`}
    >
      <View style={[s.tag, { backgroundColor: esAntes ? "#e0a94d" : T.verdeClaro }]}>
        <Text style={s.tagTxt}>{esAntes ? "Antes" : "Después"}</Text>
      </View>
      {abrible ? (
        <>
          <Image source={{ uri: src }} style={s.img} resizeMode="cover" onError={() => { setEstado("falla"); alTener?.(null); }} />
          <View style={s.lupa}><Feather name="maximize-2" size={12} color="#fff" /></View>
        </>
      ) : estado === "cargando" ? (
        <View style={s.centro}><ActivityIndicator color={T.gris} /></View>
      ) : (
        <View style={s.centro}>
          <Feather name={estado === "sin" ? "camera-off" : "image"} size={22} color={T.grisClaro} />
          <Text style={s.noDisp}>{estado === "sin" ? "Sin foto" : "Foto no disponible"}</Text>
        </View>
      )}
      <View style={s.sellos}>
        {dato?.hora && dato.hora !== "—" ? (
          <View style={s.sello}><Feather name="clock" size={10} color="#fff" /><Text style={s.selloTxt}>{dato.hora}</Text></View>
        ) : null}
        {conSello ? (
          <View style={s.sello}>
            <Feather name={sello.estado === "sin" ? "slash" : "map-pin"} size={10} color={colorSello} />
            <Text style={[s.selloTxt, { color: sello.estado === "ok" ? "#fff" : colorSello }]} numberOfLines={1}>{sello.texto}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  fila: { flexDirection: "row", gap: 10 },
  caja: { flex: 1, aspectRatio: 0.82, borderRadius: 12, borderWidth: 1, borderColor: T.linea, overflow: "hidden", backgroundColor: "#0d1211" },
  tag: { position: "absolute", top: 8, left: 8, zIndex: 2, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 2 },
  tagTxt: { color: "#0d1211", fontSize: 10.5, fontWeight: "700" },
  img: { width: "100%", height: "100%" },
  lupa: { position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 12, padding: 5 },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6, padding: 8 },
  noDisp: { color: T.grisClaro, fontSize: 11.5, textAlign: "center" },
  sellos: { position: "absolute", bottom: 6, left: 6, right: 6, gap: 4 },
  sello: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", maxWidth: "100%", backgroundColor: "rgba(0,0,0,0.62)", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  selloTxt: { color: "#fff", fontSize: 10.5, flexShrink: 1 },
  visor: { flex: 1, backgroundColor: "rgba(0,0,0,0.94)", paddingTop: 54, paddingBottom: 34 },
  visorCab: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, marginBottom: 12 },
  visorTabs: { flex: 1, flexDirection: "row", gap: 8 },
  visorTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.35)", minHeight: 40, justifyContent: "center" },
  visorTabOn: { backgroundColor: "#fff", borderColor: "#fff" },
  visorTabTxt: { color: "#fff", fontSize: 14, fontWeight: "700" },
  visorCerrar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  visorImg: { flex: 1, width: "100%" },
  visorPie: { color: "rgba(255,255,255,0.85)", fontSize: 13, textAlign: "center", marginTop: 12, paddingHorizontal: 16 },
});
