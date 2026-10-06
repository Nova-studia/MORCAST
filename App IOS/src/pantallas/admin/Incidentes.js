import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, Pressable, Modal, Image, TextInput, RefreshControl, Linking, ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../../tema";
import { Tarjeta, Badge, Boton } from "../../ui";
import { textoMinutos } from "../../chofer-reportes.mjs";
import { listarIncidentesOficina, fotoIncidente, atenderIncidente } from "../../datos-oficina";
import {
  infoTipoIncidente, filtrarIncidentes, ordenarBandeja, contarIncidentes, validarAtencion,
  fechaHoraMatamoros, enlaceMapaIncidente, MAX_NOTA_ATENCION,
} from "../../oficina.mjs";

/**
 * BANDEJA DE INCIDENTES EN EL TELÉFONO (6-oct-2026) — lo mismo que
 * /admin/incidentes de la web: lo que reporta el chofer desde la calle
 * (accidente, retraso, falla, contenedor…), lo abierto arriba y los
 * accidentes primero. Cada uno se abre con su foto, su ubicación y la parada,
 * y se cierra con "Marcar atendido" y la nota de qué se hizo.
 *
 * Antes la notificación de un incidente abría el Panel y de ahí no había a
 * dónde ir: la bandeja solo existía en la web. Ahora la notificación abre
 * aquí, en ese incidente (`params.id`).
 *
 * Cerrar va por el servidor (/api/app/incidentes/atender): la misma función
 * que la web, con la bitácora y `atendido_por` sacado de la sesión.
 */
const FILTROS = [
  { id: "abiertos", texto: "Abiertos" },
  { id: "atendidos", texto: "Atendidos" },
  { id: "todos", texto: "Todos" },
];

// El tono es el color del estado (DESIGN.md): un accidente es lo único urgente.
const CLASE_TONO = { urgente: "mal", alerta: "ruta", neutro: "none" };

export default function Incidentes({ navigation, route }) {
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const [filtro, setFiltro] = useState("abiertos");
  const [selId, setSelId] = useState(null);

  const cargar = useCallback(async () => {
    const l = await listarIncidentesOficina();
    if (l === null) setErrorCarga(true);
    else {
      setErrorCarga(false);
      setLista(l);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    cargar();
    const quitar = navigation.addListener("focus", cargar);
    return quitar;
  }, [cargar, navigation]);

  // La notificación trae el id: se abre ese incidente.
  const pedido = route?.params?.id || null;
  useEffect(() => {
    if (!pedido || cargando) return;
    const inc = lista.find((i) => i.id === pedido);
    if (inc) {
      setFiltro(inc.estado === "abierto" ? "abiertos" : "todos");
      setSelId(pedido);
    }
    navigation.setParams({ id: undefined });
  }, [pedido, cargando, lista, navigation]);

  const refrescar = async () => {
    setRefrescando(true);
    try { await cargar(); } finally { setRefrescando(false); }
  };

  const cuenta = useMemo(() => contarIncidentes(lista), [lista]);
  const filas = useMemo(() => ordenarBandeja(filtrarIncidentes(lista, filtro)), [lista, filtro]);
  const sel = lista.find((i) => i.id === selId) || null;

  const alAtender = (id, cambio) => {
    setLista((l) => l.map((i) => (i.id === id ? { ...i, ...cambio } : i)));
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.fondo }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={T.gris} />}
    >
      <Text style={s.h1}>Incidentes</Text>
      <Text style={s.sub}>
        {cuenta.abiertos === 0
          ? "No hay incidentes sin atender."
          : `${cuenta.abiertos} sin atender${cuenta.urgentes ? ` · ${cuenta.urgentes} urgente${cuenta.urgentes === 1 ? "" : "s"}` : ""}.`}
      </Text>

      <View style={s.segmento}>
        {FILTROS.map((f) => (
          <Pressable
            key={f.id}
            onPress={() => setFiltro(f.id)}
            style={[s.seg, filtro === f.id && s.segOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: filtro === f.id }}
          >
            <Text style={[s.segTxt, filtro === f.id && { color: "#0d1211" }]}>{f.texto} ({cuenta[f.id]})</Text>
          </Pressable>
        ))}
      </View>

      {cargando && <Text style={s.vacio}>Leyendo los incidentes…</Text>}
      {!cargando && errorCarga && (
        <View style={s.errorCaja}>
          <Feather name="alert-circle" size={14} color={T.error} />
          <View style={{ flex: 1 }}>
            <Text style={s.errorTxt}>No se pudieron leer los incidentes. Revisa tu señal.</Text>
            <Boton variante="linea" onPress={() => { setCargando(true); cargar(); }} style={{ marginTop: 10 }}>Reintentar</Boton>
          </View>
        </View>
      )}
      {!cargando && !errorCarga && filas.length === 0 && (
        <Text style={s.vacio}>
          {filtro === "abiertos" ? "Nada pendiente: todos los incidentes están atendidos." : "No hay incidentes en este filtro."}
        </Text>
      )}

      {filas.map((i) => {
        const t = infoTipoIncidente(i.tipo);
        return (
          <Pressable
            key={i.id}
            onPress={() => setSelId(i.id)}
            accessibilityRole="button"
            accessibilityLabel={`${t.texto}, ${i.chofer}, ${i.estado === "abierto" ? "sin atender" : "atendido"}`}
          >
            <Tarjeta style={[{ padding: 14 }, i.estado === "abierto" && t.tono === "urgente" && s.tarjetaUrgente]}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cuando}>{fechaHoraMatamoros(i.creado)}</Text>
                  <Text style={s.tipo}>
                    {t.texto}{i.tipo === "retraso" && i.retrasoMin ? ` · ${textoMinutos(i.retrasoMin)}` : ""}
                  </Text>
                  <Text style={s.det} numberOfLines={1}>{[i.chofer, i.unidad, i.ruta].filter(Boolean).join(" · ")}</Text>
                  {!!i.descripcion && <Text style={s.desc} numberOfLines={2}>{i.descripcion}</Text>}
                </View>
                <View style={{ alignItems: "flex-end", gap: 6 }}>
                  {t.tono !== "neutro" && <Badge clase={CLASE_TONO[t.tono]}>{t.tono === "urgente" ? "Urgente" : "Afecta la ruta"}</Badge>}
                  <Badge clase={i.estado === "abierto" ? "prog" : "ok"}>{i.estado === "abierto" ? "Abierto" : "Atendido"}</Badge>
                  {!!i.foto && <Feather name="camera" size={14} color={T.accionTxt} />}
                </View>
              </View>
            </Tarjeta>
          </Pressable>
        );
      })}

      <Modal visible={!!sel} animationType="slide" transparent onRequestClose={() => setSelId(null)}>
        <View style={s.modalFondo}>
          <View style={s.modal}>
            {sel && <Detalle key={sel.id} i={sel} onCerrar={() => setSelId(null)} onAtendido={alAtender} />}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function Detalle({ i, onCerrar, onAtendido }) {
  const t = infoTipoIncidente(i.tipo);
  const [foto, setFoto] = useState(i.foto ? "cargando" : null);
  const [nota, setNota] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const mapa = enlaceMapaIncidente(i.ubicacion);

  // La foto se firma al abrir el incidente, no por toda la lista.
  useEffect(() => {
    if (!i.foto) return;
    let vivo = true;
    fotoIncidente(i.foto).then((url) => { if (vivo) setFoto(url || "sin-foto"); });
    return () => { vivo = false; };
  }, [i.foto]);

  const marcar = async () => {
    const v = validarAtencion(nota);
    if (!v.ok) return setError(v.motivo);
    setOcupado(true);
    setError("");
    const r = await atenderIncidente(i.id, v.nota);
    setOcupado(false);
    if (!r.ok) return setError(r.motivo);
    onAtendido(i.id, {
      estado: "atendido",
      atendidoEn: r.atendidoEn || new Date().toISOString(),
      atendio: r.atendio || "",
      notaAtencion: v.nota,
    });
  };

  const abrir = (url) => Linking.openURL(url).catch(() => {});

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 36 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <View style={s.modalCab}>
        <Text style={s.cuando}>{fechaHoraMatamoros(i.creado)}</Text>
        <Pressable onPress={onCerrar} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar"><Feather name="x" size={22} color={T.gris} /></Pressable>
      </View>
      <Text style={s.modalTipo}>{t.texto}</Text>
      <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
        {t.tono === "urgente" && <Badge clase="mal">Urgente</Badge>}
        <Badge clase={i.estado === "abierto" ? "prog" : "ok"}>{i.estado === "abierto" ? "Abierto" : "Atendido"}</Badge>
      </View>

      {!!i.descripcion && <Text style={s.descLarga}>{i.descripcion}</Text>}

      <View style={s.datos}>
        <Dato k="Chofer" v={i.chofer} />
        {!!i.unidad && <Dato k="Unidad" v={i.unidad} />}
        {!!i.ruta && <Dato k="Ruta" v={i.ruta} />}
        {!!i.retrasoMin && <Dato k="Retraso" v={textoMinutos(i.retrasoMin)} />}
        {!!i.folio && <Dato k="Parada" v={[i.folio, i.cliente].filter(Boolean).join(" · ")} />}
        {!!i.parada && <Dato k="Punto" v={i.parada} />}
        {!!i.contenedor && <Dato k="Contenedor" v={i.contenedor} />}
      </View>

      <View style={{ gap: 8, marginTop: 14 }}>
        {!!i.telefonoChofer && (
          <Pressable style={s.accion} onPress={() => abrir(`tel:${i.telefonoChofer.replace(/[^\d+]/g, "")}`)} accessibilityRole="button">
            <Feather name="phone" size={16} color={T.tinta} />
            <Text style={s.accionTxt}>Llamar al chofer ({i.telefonoChofer})</Text>
          </Pressable>
        )}
        {mapa ? (
          <Pressable style={s.accion} onPress={() => abrir(mapa)} accessibilityRole="button">
            <Feather name="map-pin" size={16} color={T.tinta} />
            <Text style={s.accionTxt}>Ver dónde estaba el chofer</Text>
          </Pressable>
        ) : (
          <Text style={s.ayuda}>Sin ubicación: el chofer no compartió su GPS.</Text>
        )}
      </View>

      {i.foto && (
        <View style={{ marginTop: 14 }}>
          {foto === "cargando" && <ActivityIndicator color={T.gris} style={{ alignSelf: "flex-start" }} />}
          {foto === "sin-foto" && <Text style={s.ayuda}>No se pudo abrir la foto.</Text>}
          {foto && !["cargando", "sin-foto"].includes(foto) && (
            <Pressable onPress={() => abrir(foto)} accessibilityRole="imagebutton" accessibilityLabel="Abrir la foto del incidente">
              <Image source={{ uri: foto }} style={s.foto} resizeMode="cover" />
            </Pressable>
          )}
        </View>
      )}

      {i.estado === "atendido" ? (
        <View style={s.atendido}>
          <Text style={s.atendidoTit}>
            Atendido{i.atendio ? ` por ${i.atendio}` : ""}{i.atendidoEn ? ` · ${fechaHoraMatamoros(i.atendidoEn)}` : ""}
          </Text>
          {!!i.notaAtencion && <Text style={s.atendidoNota}>{i.notaAtencion}</Text>}
        </View>
      ) : (
        <>
          <Text style={s.seccion}>Marcar atendido</Text>
          <TextInput
            value={nota}
            onChangeText={setNota}
            placeholder="¿Qué se hizo? (obligatorio)"
            placeholderTextColor={T.grisClaro}
            multiline
            maxLength={MAX_NOTA_ATENCION}
            style={s.input}
            accessibilityLabel="Nota de qué se hizo con el incidente"
          />
          {!!error && (
            <View style={s.errorCaja} accessibilityLiveRegion="polite">
              <Feather name="alert-circle" size={14} color={T.error} />
              <Text style={s.errorTxt}>{error}</Text>
            </View>
          )}
          <Boton onPress={marcar} disabled={ocupado} style={{ marginTop: 12 }}>
            {ocupado ? "Guardando…" : "Marcar atendido"}
          </Boton>
        </>
      )}
    </ScrollView>
  );
}

function Dato({ k, v }) {
  return (
    <View style={s.datoFila}>
      <Text style={s.datoK}>{k}</Text>
      <Text style={s.datoV}>{v}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  h1: { color: T.tinta, fontSize: 22, fontWeight: "800" },
  sub: { color: T.gris, fontSize: 13.5, marginTop: 3, marginBottom: 14, lineHeight: 19 },
  vacio: { color: T.gris, fontSize: 13.5, lineHeight: 19, marginTop: 6 },
  segmento: { flexDirection: "row", gap: 8, marginBottom: 14 },
  seg: { flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: 10, borderWidth: 1, borderColor: T.linea, backgroundColor: T.panel },
  segOn: { backgroundColor: T.naranja, borderColor: T.naranja },
  segTxt: { color: T.gris, fontSize: 12.5, fontWeight: "600" },
  tarjetaUrgente: { borderColor: "rgba(217,119,107,0.6)" },
  cuando: { color: T.gris, fontSize: 11.5 },
  tipo: { color: T.tinta, fontSize: 15, fontWeight: "700", marginTop: 3 },
  det: { color: T.gris, fontSize: 12.5, marginTop: 2 },
  desc: { color: T.tinta, fontSize: 12.5, marginTop: 5, lineHeight: 17 },
  modalFondo: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modal: { backgroundColor: T.fondo, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: "94%", borderWidth: 1, borderColor: T.linea },
  modalCab: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTipo: { color: T.tinta, fontSize: 19, fontWeight: "800", marginTop: 6 },
  descLarga: { color: T.tinta, fontSize: 14, lineHeight: 20, marginTop: 12 },
  datos: { marginTop: 12 },
  datoFila: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: T.linea },
  datoK: { color: T.gris, fontSize: 13 },
  datoV: { color: T.tinta, fontSize: 13, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  accion: { flexDirection: "row", alignItems: "center", gap: 9, minHeight: 48, backgroundColor: T.panel, borderWidth: 1, borderColor: T.linea, borderRadius: 10, paddingHorizontal: 13 },
  accionTxt: { color: T.tinta, fontSize: 14 },
  foto: { width: "100%", aspectRatio: 4 / 3, borderRadius: 10, borderWidth: 1, borderColor: T.linea },
  atendido: { marginTop: 16, borderLeftWidth: 3, borderLeftColor: T.ok, paddingLeft: 11 },
  atendidoTit: { color: T.ok, fontSize: 13.5, fontWeight: "700", lineHeight: 18 },
  atendidoNota: { color: T.tinta, fontSize: 13.5, marginTop: 4, lineHeight: 19 },
  seccion: { color: T.gris, fontSize: 11, letterSpacing: 0.5, marginTop: 18, marginBottom: 8, textTransform: "uppercase" },
  input: { backgroundColor: T.panel2, borderWidth: 1, borderColor: T.linea, borderRadius: 10, color: T.tinta, fontSize: 15, paddingHorizontal: 12, paddingVertical: 10, minHeight: 84, textAlignVertical: "top" },
  ayuda: { color: T.grisClaro, fontSize: 12, lineHeight: 17 },
  errorCaja: { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: "rgba(217,119,107,0.10)", borderWidth: 1, borderColor: "rgba(217,119,107,0.35)", borderRadius: 10, padding: 10, marginTop: 12 },
  errorTxt: { color: T.error, fontSize: 12.5, flex: 1, lineHeight: 17 },
});
