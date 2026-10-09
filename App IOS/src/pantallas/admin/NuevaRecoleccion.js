import { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../../tema";
import { Tarjeta, Boton } from "../../ui";
import { TIPOS_RESIDUO } from "../../cotizar-whatsapp";
import { listarOperadores } from "../../datos-remoto";
import { clientesParaRecoleccion, puntosDeClienteOficina, crearRecoleccionOficina } from "../../datos-oficina";
import { hoyISO, normalizarHora, fechaCortaDia, HORAS_RAPIDAS } from "../../oficina.mjs";
import { limitesExtra } from "../../calendario.mjs";
import { validarRecoleccionOficina } from "../../web/recoleccion-nueva.mjs";
import { textoChoferPorOmision, avisoRutaSinChofer } from "../../web/rutas-chofer.mjs";
import { filtrarClientesAviso } from "../../apps-admin.mjs";
import { Fallo } from "../../piezas-100";
import CalendarioFecha from "../../CalendarioFecha";

/**
 * "NUEVA RECOLECCIÓN" DE LA OFICINA (9-oct-2026, como la web, Entrega 3).
 *
 * Para los pedidos por teléfono o WhatsApp, que no tenían cómo entrar:
 * cliente → punto → fecha → residuo → nota. Nace "solicitada", o ya
 * "confirmada" con hora y chofer si la oficina la programa de una vez
 * (entonces el servidor avisa al cliente y al chofer, igual que "Confirmar").
 * Las reglas son las de la web (`validarRecoleccionOficina`); el servidor
 * las vuelve a aplicar.
 */
const VACIO = { clienteId: "", domicilioId: "", fecha: "", tipoResiduo: "", nota: "", origen: "extra", confirmar: false, hora: "", choferId: "" };

export default function NuevaRecoleccion({ navigation }) {
  const hoy = hoyISO();
  const [form, setForm] = useState(VACIO);
  const pon = (patch) => { setForm((f) => ({ ...f, ...patch })); setFallo(null); };
  const [clientes, setClientes] = useState(null);
  const [buscar, setBuscar] = useState("");
  const [puntos, setPuntos] = useState([]);
  const [leyendoPuntos, setLeyendoPuntos] = useState(false);
  const [choferes, setChoferes] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState(null);
  const [falloClientes, setFalloClientes] = useState(false);

  const leerClientes = () => {
    setFalloClientes(false);
    clientesParaRecoleccion().then((cs) => {
      if (cs === null) { setFalloClientes(true); setClientes([]); return; }
      setClientes(cs);
    });
  };
  useEffect(() => {
    leerClientes();
    listarOperadores().then(setChoferes).catch(() => {});
  }, []);

  useEffect(() => {
    let vivo = true;
    setPuntos([]);
    if (!form.clienteId) return undefined;
    setLeyendoPuntos(true);
    puntosDeClienteOficina(form.clienteId).then((ps) => {
      if (!vivo) return;
      setLeyendoPuntos(false);
      if (ps === null) { setFallo({ sinRed: true, motivo: "No se pudieron leer los puntos de ese cliente." }); return; }
      setPuntos(ps);
      // Con un solo punto, ya está escogido.
      if (ps.length === 1) setForm((f) => ({ ...f, domicilioId: ps[0].id }));
    });
    return () => { vivo = false; };
  }, [form.clienteId]);

  const encontrados = useMemo(() => filtrarClientesAviso(clientes || [], buscar).slice(0, 40), [buscar, clientes]);
  const cliente = (clientes || []).find((c) => c.id === form.clienteId) || null;
  const punto = puntos.find((p) => p.id === form.domicilioId) || null;
  const rutaDelPunto = { choferId: punto?.rutaChoferId || null, chofer: punto?.rutaChofer || "" };
  const sinChofer = form.confirmar && punto ? avisoRutaSinChofer({ choferElegido: form.choferId, ruta: rutaDelPunto }) : null;
  const limites = { min: limitesExtra(hoy).min, max: limitesExtra(hoy).max };

  const crear = async () => {
    if (enviando) return;
    const h = form.confirmar ? normalizarHora(form.hora) : { ok: true, hora: "" };
    if (!h.ok) { setFallo({ motivo: h.motivo }); return; }
    const datos = { ...form, hora: h.hora || null, choferId: form.choferId || null };
    // Lo mismo que revisa el servidor, antes de gastar señal.
    const v = validarRecoleccionOficina(datos, { hoy, tipos: TIPOS_RESIDUO });
    if (!v.ok) { setFallo({ motivo: v.motivo }); return; }
    setEnviando(true);
    setFallo(null);
    const r = await crearRecoleccionOficina(datos);
    setEnviando(false);
    if (!r.ok) { setFallo({ sinRed: r.sinRed, motivo: r.motivo }); return; }
    const texto = r.motivo
      ? `${r.folio} se creó, pero quedó solicitada: ${r.motivo}`
      : r.estado === "confirmada"
        ? `${r.folio} creada y confirmada para el ${fechaCortaDia(form.fecha)}. Ya se avisó al cliente y al chofer.`
        : `${r.folio} creada como solicitada. Confírmala cuando tengas día y chofer.`;
    // popTo regresa a la lista (navigate, en React Navigation 7, apilaba otra
    // y "Atrás" volvía al formulario lleno: revisión 9-oct).
    navigation.popTo("Recolecciones", { creada: texto });
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.fondo }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
    >
      <Text style={s.h1}>Nueva recolección</Text>
      <Text style={s.sub}>Para los pedidos por teléfono o WhatsApp.</Text>

      {/* 1 · Cliente */}
      <Tarjeta>
        <Text style={s.paso}>1 · Cliente</Text>
        {cliente ? (
          <View style={s.elegido}>
            <View style={{ flex: 1 }}>
              <Text style={s.elegidoNom}>{cliente.empresa}</Text>
              <Text style={s.nota}>{[cliente.folio, cliente.estado !== "activo" ? cliente.estado : null].filter(Boolean).join(" · ")}</Text>
            </View>
            <Pressable onPress={() => { pon({ clienteId: "", domicilioId: "" }); setBuscar(""); }} style={s.cambiar} accessibilityRole="button">
              <Text style={s.cambiarTxt}>Cambiar</Text>
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
            {falloClientes ? <Fallo fallo={{ sinRed: true, motivo: "No se pudieron leer los clientes." }} onReintentar={leerClientes} /> : null}
            <View style={s.lista}>
              {clientes === null ? <Text style={[s.nota, { padding: 12 }]}>Leyendo clientes…</Text> : null}
              {clientes && !encontrados.length ? <Text style={[s.nota, { padding: 12 }]}>Ningún cliente.</Text> : null}
              {encontrados.map((c, i) => (
                <Pressable key={c.id} onPress={() => pon({ clienteId: c.id, domicilioId: "" })} style={[s.filaLista, i > 0 && s.borde]} accessibilityRole="button">
                  <Text style={s.filaNom}>{c.empresa}</Text>
                  <Text style={s.nota}>{[c.folio, c.estado !== "activo" ? c.estado : null].filter(Boolean).join(" · ")}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </Tarjeta>

      {/* 2 · Punto */}
      <Tarjeta>
        <Text style={s.paso}>2 · Punto de recolección</Text>
        {!form.clienteId ? (
          <Text style={s.nota}>Primero elige el cliente.</Text>
        ) : leyendoPuntos ? (
          <Text style={s.nota}>Leyendo sus puntos…</Text>
        ) : !puntos.length ? (
          <Text style={s.nota}>Este cliente no tiene puntos. Agrégale uno desde su ficha.</Text>
        ) : (
          puntos.map((p) => (
            <Radio key={p.id} on={form.domicilioId === p.id} onPress={() => pon({ domicilioId: p.id })} texto={p.texto} sub={p.ruta ? `Ruta ${p.ruta}` : "Sin ruta"} />
          ))
        )}
      </Tarjeta>

      {/* 3 · Fecha y tipo */}
      <Tarjeta>
        <Text style={s.paso}>3 · Fecha</Text>
        <CalendarioFecha valor={form.fecha} onCambiar={(f) => pon({ fecha: f })} min={limites.min} max={limites.max} hoy={hoy} />
        <Text style={s.nota}>{form.fecha ? `Para el ${fechaCortaDia(form.fecha)}.` : "Toca el día."}</Text>
        <View style={[s.chips, { marginTop: 12 }]}>
          <Opcion on={form.origen === "extra"} onPress={() => pon({ origen: "extra" })}>Recolección extra</Opcion>
          <Opcion on={form.origen === "ruta"} onPress={() => pon({ origen: "ruta" })}>Día de su ruta</Opcion>
        </View>

        <Text style={[s.paso, { marginTop: 18 }]}>4 · Residuo</Text>
        <View style={s.chips}>
          {TIPOS_RESIDUO.map((t) => (
            <Opcion key={t} on={form.tipoResiduo === t} onPress={() => pon({ tipoResiduo: t })}>{t}</Opcion>
          ))}
        </View>
        <TextInput
          style={[s.input, { minHeight: 64, textAlignVertical: "top", marginTop: 12 }]}
          multiline
          value={form.nota}
          onChangeText={(v) => pon({ nota: v })}
          placeholder={form.tipoResiduo === "Otro" ? "Describe el residuo (obligatorio con «Otro»)" : "Nota para el chofer (opcional)"}
          placeholderTextColor={T.grisClaro}
          maxLength={500}
          accessibilityLabel="Nota"
        />
      </Tarjeta>

      {/* 5 · ¿Confirmarla ya? */}
      <Tarjeta>
        <Pressable onPress={() => pon({ confirmar: !form.confirmar })} style={s.casilla} accessibilityRole="checkbox" accessibilityState={{ checked: form.confirmar }}>
          <Feather name={form.confirmar ? "check-square" : "square"} size={20} color={form.confirmar ? T.accionTxt : T.gris} />
          <Text style={s.casillaTxt}>Confirmarla ya (se avisa al cliente y al chofer)</Text>
        </Pressable>
        {form.confirmar ? (
          <>
            <Text style={s.label}>Hora (opcional)</Text>
            <View style={s.chips}>
              <Opcion on={!form.hora} onPress={() => pon({ hora: "" })}>Sin hora</Opcion>
              {HORAS_RAPIDAS.map((h) => <Opcion key={h} on={form.hora === h} onPress={() => pon({ hora: h })}>{h}</Opcion>)}
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
            <Text style={s.label}>Chofer</Text>
            <Radio on={!form.choferId} onPress={() => pon({ choferId: "" })} texto={textoChoferPorOmision(rutaDelPunto)} />
            {choferes.map((c) => (
              <Radio key={c.id} on={form.choferId === c.id} onPress={() => pon({ choferId: c.id })} texto={c.nombre} />
            ))}
            {sinChofer ? <Text style={s.alerta}>{sinChofer}</Text> : null}
          </>
        ) : null}
      </Tarjeta>

      <Fallo fallo={fallo} onReintentar={crear} style={{ marginTop: 0, marginBottom: 12 }} />
      <Boton onPress={crear} disabled={enviando}>
        {enviando ? "Creando…" : form.confirmar ? "Crear y confirmar" : "Crear solicitud"}
      </Boton>
    </ScrollView>
  );
}

function Opcion({ on, onPress, children }) {
  return (
    <Pressable onPress={onPress} style={[s.opcion, on && s.opcionOn]} accessibilityRole="button" accessibilityState={{ selected: !!on }}>
      <Text style={[s.opcionTxt, on && { color: "#fff", fontWeight: "700" }]}>{children}</Text>
    </Pressable>
  );
}

function Radio({ on, onPress, texto, sub }) {
  return (
    <Pressable onPress={onPress} style={[s.radio, on && s.radioOn]} accessibilityRole="radio" accessibilityState={{ checked: !!on }}>
      <Feather name={on ? "check-circle" : "circle"} size={18} color={on ? T.accionTxt : T.grisClaro} />
      <View style={{ flex: 1 }}>
        <Text style={[s.radioTxt, on && { fontWeight: "700" }]}>{texto}</Text>
        {sub ? <Text style={s.nota}>{sub}</Text> : null}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  h1: { color: T.tinta, fontSize: 22, fontWeight: "800" },
  sub: { color: T.gris, fontSize: 13.5, marginTop: 3, marginBottom: 14 },
  paso: { color: T.tinta, fontSize: 14.5, fontWeight: "800", marginBottom: 10 },
  nota: { color: T.gris, fontSize: 12.5, lineHeight: 18 },
  label: { color: T.tinta, fontSize: 12.5, fontWeight: "700", marginTop: 14, marginBottom: 8 },
  alerta: { color: T.adminTxt, fontSize: 12.5, marginTop: 10, lineHeight: 17 },
  buscador: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: T.panel2, borderWidth: 1, borderColor: T.linea, borderRadius: 10, paddingHorizontal: 12, minHeight: 46 },
  buscadorInput: { flex: 1, color: T.tinta, fontSize: 14.5, paddingVertical: 10 },
  lista: { borderWidth: 1, borderColor: T.linea, borderRadius: 10, marginTop: 8, maxHeight: 320, overflow: "hidden" },
  filaLista: { paddingHorizontal: 12, paddingVertical: 10, minHeight: 48 },
  filaNom: { color: T.tinta, fontSize: 14, fontWeight: "600" },
  borde: { borderTopWidth: 1, borderTopColor: T.linea },
  elegido: { flexDirection: "row", alignItems: "center", gap: 10 },
  elegidoNom: { color: T.tinta, fontSize: 15, fontWeight: "700" },
  cambiar: { borderWidth: 1, borderColor: T.linea, borderRadius: 9, paddingHorizontal: 12, minHeight: 40, justifyContent: "center" },
  cambiarTxt: { color: T.tinta, fontSize: 13, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  opcion: { paddingHorizontal: 12, minHeight: 40, justifyContent: "center", borderRadius: 10, borderWidth: 1, borderColor: T.linea, backgroundColor: T.panel2 },
  opcionOn: { backgroundColor: T.accion, borderColor: T.accion },
  opcionTxt: { color: T.tinta, fontSize: 13 },
  input: { backgroundColor: T.panel2, borderWidth: 1, borderColor: T.linea, borderRadius: 10, color: T.tinta, fontSize: 14.5, paddingHorizontal: 12, paddingVertical: 10, minHeight: 46 },
  radio: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10, minHeight: 48, borderRadius: 10, marginBottom: 6, borderWidth: 1, borderColor: T.linea },
  radioOn: { backgroundColor: T.accionTinte, borderColor: T.accion },
  radioTxt: { color: T.tinta, fontSize: 14 },
  casilla: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  casillaTxt: { color: T.tinta, fontSize: 14, flex: 1 },
});
