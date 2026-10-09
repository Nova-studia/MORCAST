import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Switch } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../../tema";
import { Tarjeta, Boton } from "../../ui";
import AvisoResultado from "../../AvisoResultado";
import { listarOperadores } from "../../datos-remoto";
import { clientesParaRecoleccion, puntosDeClienteOficina, crearRecoleccion } from "../../datos-oficina";
import { TIPOS_RESIDUO } from "../../cotizar-whatsapp";
import { hoyISO, normalizarHora, fechaCortaDia, HORAS_RAPIDAS } from "../../oficina.js";
import { validarRecoleccionOficina } from "../../web/recoleccion-nueva.mjs";
import { textoChoferPorOmision, avisoRutaSinChofer } from "../../web/rutas-chofer.mjs";
import { filtrarClientes } from "../../elegir-clientes.mjs";
import CalendarioMes from "./CalendarioMes";

const VACIO = { clienteId: "", domicilioId: "", fecha: "", tipoResiduo: "", nota: "", origen: "extra", confirmar: false, hora: "", choferId: "" };

/**
 * "NUEVA RECOLECCIÓN" DE LA OFICINA (apps al 100%, fase C; como
 * components/admin/NuevaRecoleccion.js de la web).
 *
 * Para los pedidos por teléfono o WhatsApp: cliente → punto → fecha →
 * residuo → nota. Nace "solicitada", o ya "confirmada" con hora y chofer si
 * la oficina la programa de una vez (entonces se avisa al cliente y al chofer
 * igual que con "Confirmar"). Las reglas son las de la web
 * (`validarRecoleccionOficina`), y el servidor las vuelve a aplicar.
 */
export default function NuevaRecoleccion({ navigation }) {
  const hoy = hoyISO();
  const [form, setForm] = useState(VACIO);
  const [clientes, setClientes] = useState(null);
  const [buscar, setBuscar] = useState("");
  const [puntos, setPuntos] = useState([]);
  const [falloPuntos, setFalloPuntos] = useState(false);
  const [intentoPuntos, setIntentoPuntos] = useState(0);
  const [choferes, setChoferes] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [res, setRes] = useState(null);
  const [error, setError] = useState("");
  const pon = (patch) => { setForm((f) => ({ ...f, ...patch })); setError(""); setRes(null); };

  const cargarClientes = useCallback(async () => {
    setClientes(null);
    const cs = await clientesParaRecoleccion();
    setClientes(cs === null ? false : cs);
  }, []);

  useEffect(() => {
    cargarClientes();
    listarOperadores().then(setChoferes).catch(() => {});
  }, [cargarClientes]);

  useEffect(() => {
    let vivo = true;
    setPuntos([]);
    setFalloPuntos(false);
    if (!form.clienteId) return undefined;
    puntosDeClienteOficina(form.clienteId).then((ps) => {
      if (!vivo) return;
      if (ps === null) { setFalloPuntos(true); return; }
      setPuntos(ps);
      // Con un solo punto, ya está escogido.
      if (ps.length === 1) setForm((f) => ({ ...f, domicilioId: ps[0].id }));
    });
    return () => { vivo = false; };
  }, [form.clienteId, intentoPuntos]);

  const encontrados = useMemo(() => filtrarClientes(clientes || [], buscar).slice(0, 50), [clientes, buscar]);
  const cliente = (clientes || []).find((c) => c.id === form.clienteId) || null;
  const punto = puntos.find((p) => p.id === form.domicilioId) || null;
  const rutaDelPunto = { choferId: punto?.rutaChoferId || null, chofer: punto?.rutaChofer || "" };
  const sinChofer = form.confirmar && punto ? avisoRutaSinChofer({ choferElegido: form.choferId, ruta: rutaDelPunto }) : null;

  const crear = async () => {
    if (enviando) return;
    const h = normalizarHora(form.hora);
    if (!h.ok) { setError(h.motivo); return; }
    const datos = { ...form, hora: h.hora };
    // Lo mismo que revisa el servidor, antes de gastar señal.
    const v = validarRecoleccionOficina(datos, { hoy, tipos: TIPOS_RESIDUO });
    if (!v.ok) { setError(v.motivo); return; }
    setEnviando(true);
    setError("");
    setRes(null);
    const r = await crearRecoleccion({
      ...v.limpio,
      hora: v.limpio.hora || undefined,
      choferId: v.limpio.choferId || undefined,
    });
    setEnviando(false);
    if (!r?.ok) { setRes(r || { ok: false }); return; }
    const texto = r.motivo
      ? `${r.folio} se creó, pero quedó solicitada: ${r.motivo}`
      : r.estado === "confirmada"
        ? `${r.folio} creada y confirmada para el ${fechaCortaDia(v.limpio.fecha)}. Ya se avisó al cliente y al chofer.`
        : `${r.folio} creada. Queda por confirmar.`;
    navigation.navigate("Recolecciones", { creada: texto, folio: r.folio });
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.fondo }}
      contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
    >
      <Text style={s.h1}>Nueva recolección</Text>
      <Text style={s.sub}>Para los pedidos por teléfono o WhatsApp.</Text>

      <Tarjeta>
        <Text style={s.seccion}>Cliente</Text>
        {cliente ? (
          <View style={s.elegido}>
            <View style={{ flex: 1 }}>
              <Text style={s.elegidoNom}>{cliente.empresa}</Text>
              <Text style={s.nota}>{[cliente.folio, cliente.estado !== "activo" ? cliente.estado : null].filter(Boolean).join(" · ")}</Text>
            </View>
            <Pressable onPress={() => { pon({ clienteId: "", domicilioId: "" }); setBuscar(""); }} style={s.btnChico} accessibilityRole="button">
              <Text style={s.btnChicoTxt}>Cambiar</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={s.buscador}>
              <Feather name="search" size={16} color={T.gris} />
              <TextInput
                value={buscar}
                onChangeText={setBuscar}
                placeholder="Busca por empresa o folio"
                placeholderTextColor={T.grisClaro}
                style={s.buscadorInput}
                autoCorrect={false}
                accessibilityLabel="Buscar cliente"
              />
            </View>
            {clientes === false && <AvisoResultado r={{ ok: false, sinRed: true }} onReintentar={cargarClientes} />}
            {clientes === null && <Text style={s.nota}>Cargando clientes…</Text>}
            {clientes && (
              // Su propia lista con scroll: son decenas de clientes.
              <ScrollView style={[s.lista, { maxHeight: 300 }]} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                {encontrados.map((c, i) => (
                  <Pressable key={c.id} onPress={() => pon({ clienteId: c.id, domicilioId: "" })} style={[s.opcion, i > 0 && s.borde]} accessibilityRole="button">
                    <Text style={s.opcionTxt}>{c.empresa}</Text>
                    <Text style={s.nota}>{[c.folio, c.estado !== "activo" ? c.estado : null].filter(Boolean).join(" · ")}</Text>
                  </Pressable>
                ))}
                {!encontrados.length && <Text style={[s.nota, { padding: 12 }]}>Ningún cliente.</Text>}
              </ScrollView>
            )}
          </>
        )}

        {!!form.clienteId && (
          <>
            <Text style={s.seccion}>Punto de recolección</Text>
            {falloPuntos && <AvisoResultado r={{ ok: false, sinRed: true }} onReintentar={() => setIntentoPuntos((n) => n + 1)} />}
            {!falloPuntos && puntos.length === 0 && <Text style={s.nota}>Este cliente no tiene puntos. Agrégale uno desde su ficha.</Text>}
            <View style={s.lista}>
              {puntos.map((p, i) => (
                <Pressable
                  key={p.id}
                  onPress={() => pon({ domicilioId: p.id })}
                  style={[s.opcion, s.radio, i > 0 && s.borde, form.domicilioId === p.id && s.opcionOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: form.domicilioId === p.id }}
                >
                  <Feather name={form.domicilioId === p.id ? "check-circle" : "circle"} size={18} color={form.domicilioId === p.id ? T.accionTxt : T.grisClaro} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.opcionTxt}>{p.texto}</Text>
                    <Text style={s.nota}>{p.ruta || "Sin ruta"}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <Text style={s.seccion}>Fecha</Text>
        <CalendarioMes valor={form.fecha} minimo={hoy} onElegir={(f) => pon({ fecha: f })} />
        <Text style={s.nota}>{form.fecha ? `Día: ${fechaCortaDia(form.fecha)}` : "Toca el día."}</Text>

        <Text style={s.seccion}>Tipo de residuo</Text>
        <View style={s.chips}>
          {TIPOS_RESIDUO.map((t) => (
            <Opcion key={t} on={form.tipoResiduo === t} onPress={() => pon({ tipoResiduo: t })}>{t}</Opcion>
          ))}
        </View>

        <Text style={s.seccion}>Tipo</Text>
        <View style={s.chips}>
          <Opcion on={form.origen === "extra"} onPress={() => pon({ origen: "extra" })}>Recolección extra</Opcion>
          <Opcion on={form.origen === "ruta"} onPress={() => pon({ origen: "ruta" })}>Día de su ruta</Opcion>
        </View>

        <TextInput
          style={[s.input, { minHeight: 64, textAlignVertical: "top", marginTop: 12 }]}
          value={form.nota}
          onChangeText={(v) => pon({ nota: v })}
          placeholder={form.tipoResiduo === "Otro" ? "Describe el residuo (obligatorio con «Otro»)" : "Nota para el chofer (opcional)"}
          placeholderTextColor={T.grisClaro}
          multiline
          maxLength={500}
          accessibilityLabel="Nota"
        />

        <View style={s.confirmar}>
          <Text style={s.confirmarTxt}>Confirmarla ya (se avisa al cliente y al chofer)</Text>
          <Switch
            value={form.confirmar}
            onValueChange={(v) => pon({ confirmar: v })}
            trackColor={{ true: T.accion, false: T.linea }}
            accessibilityLabel="Confirmarla ya"
          />
        </View>

        {form.confirmar && (
          <>
            <Text style={s.seccion}>Hora (opcional)</Text>
            <View style={s.chips}>
              <Opcion on={!form.hora} onPress={() => pon({ hora: "" })}>Sin hora</Opcion>
              {HORAS_RAPIDAS.map((h) => (
                <Opcion key={h} on={form.hora === h} onPress={() => pon({ hora: h })}>{h}</Opcion>
              ))}
            </View>
            <TextInput
              value={form.hora}
              onChangeText={(v) => pon({ hora: v })}
              placeholder="Otra hora, p. ej. 09:30"
              placeholderTextColor={T.grisClaro}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              style={[s.input, { marginTop: 8 }]}
              accessibilityLabel="Hora, en formato de 24 horas"
            />
            <Text style={s.seccion}>Chofer</Text>
            <View style={s.lista}>
              <Pressable onPress={() => pon({ choferId: "" })} style={[s.opcion, s.radio, !form.choferId && s.opcionOn]} accessibilityRole="radio" accessibilityState={{ checked: !form.choferId }}>
                <Feather name={!form.choferId ? "check-circle" : "circle"} size={18} color={!form.choferId ? T.accionTxt : T.grisClaro} />
                <Text style={s.opcionTxt}>{textoChoferPorOmision(rutaDelPunto)}</Text>
              </Pressable>
              {choferes.map((c) => (
                <Pressable key={c.id} onPress={() => pon({ choferId: c.id })} style={[s.opcion, s.radio, s.borde, form.choferId === c.id && s.opcionOn]} accessibilityRole="radio" accessibilityState={{ checked: form.choferId === c.id }}>
                  <Feather name={form.choferId === c.id ? "check-circle" : "circle"} size={18} color={form.choferId === c.id ? T.accionTxt : T.grisClaro} />
                  <Text style={s.opcionTxt}>{c.nombre}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
        {!!sinChofer && <Text style={s.alerta}>{sinChofer}</Text>}

        <AvisoResultado texto={error} />
        <AvisoResultado r={res} onReintentar={crear} />
        <Boton onPress={crear} disabled={enviando} style={{ marginTop: 16 }}>
          {enviando ? "Creando…" : form.confirmar ? "Crear y confirmar" : "Crear solicitud"}
        </Boton>
      </Tarjeta>
    </ScrollView>
  );
}

function Opcion({ on, onPress, children }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, on && s.chipOn]} accessibilityRole="radio" accessibilityState={{ checked: !!on }}>
      <Text style={[s.chipTxt, on && { color: "#fff", fontWeight: "700" }]}>{children}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  h1: { color: T.tinta, fontSize: 22, fontWeight: "800" },
  sub: { color: T.gris, fontSize: 13.5, marginTop: 3, marginBottom: 14 },
  seccion: { color: T.gris, fontSize: 11, letterSpacing: 0.5, marginTop: 16, marginBottom: 8, textTransform: "uppercase", fontWeight: "700" },
  nota: { color: T.gris, fontSize: 12.5, lineHeight: 17, marginTop: 4 },
  alerta: { color: T.adminTxt, fontSize: 12.5, lineHeight: 17, marginTop: 10 },
  elegido: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: T.accion, backgroundColor: T.accionTinte },
  elegidoNom: { color: T.tinta, fontSize: 15, fontWeight: "700" },
  btnChico: { minHeight: 40, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, borderColor: T.linea, justifyContent: "center" },
  btnChicoTxt: { color: T.tinta, fontSize: 13, fontWeight: "700" },
  buscador: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: T.panel2, borderWidth: 1, borderColor: T.linea, borderRadius: 10, paddingHorizontal: 12, minHeight: 46 },
  buscadorInput: { flex: 1, color: T.tinta, fontSize: 14.5, paddingVertical: 10 },
  lista: { marginTop: 8, backgroundColor: T.panel2, borderWidth: 1, borderColor: T.linea, borderRadius: 12, overflow: "hidden" },
  opcion: { paddingHorizontal: 12, paddingVertical: 10, minHeight: 46, justifyContent: "center" },
  radio: { flexDirection: "row", alignItems: "center", gap: 10 },
  opcionOn: { backgroundColor: T.accionTinte },
  opcionTxt: { color: T.tinta, fontSize: 14 },
  borde: { borderTopWidth: 1, borderTopColor: T.linea },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, minHeight: 40, justifyContent: "center", borderRadius: 10, borderWidth: 1, borderColor: T.linea, backgroundColor: T.panel },
  chipOn: { backgroundColor: T.accion, borderColor: T.accion },
  chipTxt: { color: T.tinta, fontSize: 13 },
  input: { backgroundColor: T.panel2, borderWidth: 1, borderColor: T.linea, borderRadius: 10, color: T.tinta, fontSize: 15, paddingHorizontal: 12, paddingVertical: 10, minHeight: 46 },
  confirmar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: T.linea },
  confirmarTxt: { color: T.tinta, fontSize: 14, fontWeight: "600", flex: 1 },
});
