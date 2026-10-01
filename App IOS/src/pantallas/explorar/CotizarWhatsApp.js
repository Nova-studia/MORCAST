import { useRef, useState } from "react";
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { T } from "../../tema";
import { Tarjeta, Boton } from "../../ui";
import { EMPRESA_COTIZACION } from "../../cotizacion-datos";
import { abrirWhatsApp } from "../../whatsapp";
import {
  TIPOS_RESIDUO,
  UNIDADES,
  EMBALAJES,
  OTRO,
  MAX_RESIDUOS,
  LARGO,
  residuoVacio,
  validar,
  armarMensaje,
} from "../../cotizar-whatsapp";
import BarraVolver from "./BarraVolver";

const CONTACTO_VACIO = { empresa: "", ciudad: "", nombre: "", puesto: "", telefono: "", correo: "" };

const CAMPOS_CONTACTO = [
  { id: "empresa", etiqueta: "Empresa", placeholder: "Nombre de la empresa", largo: LARGO.empresa },
  { id: "ciudad", etiqueta: "Ciudad o colonia", placeholder: "Por ejemplo: Matamoros, Parque Industrial", largo: LARGO.ciudad },
  { id: "nombre", etiqueta: "Tu nombre", placeholder: "Nombre y apellido", largo: LARGO.nombre },
  { id: "puesto", etiqueta: "Puesto", placeholder: "Por ejemplo: Compras, Seguridad e Higiene", largo: LARGO.puesto },
  { id: "telefono", etiqueta: "Teléfono", placeholder: "868 123 4567", largo: LARGO.telefono, teclado: "phone-pad" },
  { id: "correo", etiqueta: "Correo", placeholder: "nombre@empresa.com", largo: LARGO.correo, teclado: "email-address", minusculas: true },
];

/** Una fila de opciones que se tocan. Hace las veces del <select> de la web. */
function Opciones({ opciones, valor, onCambio, error }) {
  return (
    <View style={s.chips}>
      {opciones.map((o) => {
        const elegido = valor === o.valor;
        return (
          <Pressable
            key={o.valor}
            onPress={() => onCambio(o.valor)}
            style={[s.chip, elegido && s.chipOn, error && !valor && s.chipError]}
            accessibilityRole="radio"
            accessibilityState={{ selected: elegido }}
          >
            <Text style={[s.chipTxt, elegido && s.chipTxtOn]}>{o.texto}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function MensajeError({ texto }) {
  if (!texto) return null;
  return (
    <View style={s.errorFila}>
      <Feather name="alert-circle" size={13} color={T.error} />
      <Text style={s.errorTxt}>{texto}</Text>
    </View>
  );
}

/**
 * El cuestionario de morcast.mx/cotizar, en la app. Lógica y mensaje salen de
 * `cotizar-whatsapp.js` (espejo del de la web): el dueño recibe lo mismo
 * venga de donde venga. No se guarda nada; el mensaje se envía desde el
 * WhatsApp de quien cotiza.
 */
export default function CotizarWhatsApp({ navigation }) {
  const siguienteId = useRef(2);
  const [residuos, setResiduos] = useState(() => [residuoVacio(1)]);
  const [contacto, setContacto] = useState(CONTACTO_VACIO);
  const [intentado, setIntentado] = useState(false);

  const datos = { residuos, ...contacto };
  // Los errores se enseñan sólo después del primer intento de enviar, y desde
  // ahí se recalculan solos mientras la persona corrige.
  const errores = intentado ? validar(datos).errores : {};
  const hayErrores = Object.keys(errores).length > 0;

  const cambiarResiduo = (id, campo, valor) =>
    setResiduos((rs) => rs.map((r) => (r.id === id ? { ...r, [campo]: valor } : r)));

  const agregar = () => {
    if (residuos.length >= MAX_RESIDUOS) return;
    setResiduos((rs) => [...rs, residuoVacio(siguienteId.current++)]);
  };

  const quitar = (id) => setResiduos((rs) => rs.filter((r) => r.id !== id));

  const enviar = () => {
    setIntentado(true);
    if (!validar(datos).ok) return;
    abrirWhatsApp(EMPRESA_COTIZACION.telefonos[0], armarMensaje(datos));
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: T.fondo }}>
      <BarraVolver navigation={navigation} titulo="Cotizar" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text style={s.h1}>Cotiza por WhatsApp</Text>
        <Text style={s.sub}>
          Contesta en un minuto y tu mensaje nos llega con todo lo que necesitamos para cotizarte.
          No necesitas cuenta.
        </Text>

        {residuos.map((r, i) => {
          const pre = `residuo-${r.id}`;
          return (
            <Tarjeta key={r.id}>
              <View style={s.residuoCab}>
                <Text style={s.residuoTit}>Residuo {i + 1}</Text>
                {residuos.length > 1 && (
                  <Pressable onPress={() => quitar(r.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Quitar residuo ${i + 1}`}>
                    <Text style={s.quitar}>Quitar</Text>
                  </Pressable>
                )}
              </View>

              <Text style={s.label}>¿Qué residuo es?</Text>
              <Opciones
                opciones={TIPOS_RESIDUO.map((t) => ({ valor: t, texto: t }))}
                valor={r.tipo}
                onCambio={(v) => cambiarResiduo(r.id, "tipo", v)}
                error={errores[`${pre}-tipo`]}
              />
              <MensajeError texto={errores[`${pre}-tipo`]} />
              {r.tipo === OTRO && (
                <>
                  <TextInput
                    style={[s.input, errores[`${pre}-tipo-otro`] && s.inputError]}
                    placeholder="Escribe qué residuo es"
                    placeholderTextColor={T.grisClaro}
                    maxLength={LARGO.otro}
                    value={r.tipoOtro}
                    onChangeText={(v) => cambiarResiduo(r.id, "tipoOtro", v)}
                  />
                  <MensajeError texto={errores[`${pre}-tipo-otro`]} />
                </>
              )}

              <Text style={s.label}>Cantidad aproximada al mes</Text>
              <TextInput
                style={[s.input, errores[`${pre}-cantidad`] && s.inputError]}
                placeholder="Por ejemplo: 500"
                placeholderTextColor={T.grisClaro}
                keyboardType="decimal-pad"
                maxLength={LARGO.cantidad}
                value={r.cantidad}
                onChangeText={(v) => cambiarResiduo(r.id, "cantidad", v)}
              />
              <MensajeError texto={errores[`${pre}-cantidad`]} />
              <Opciones
                opciones={UNIDADES.map((u) => ({ valor: u.id, texto: u.corto }))}
                valor={r.unidad}
                onCambio={(v) => cambiarResiduo(r.id, "unidad", v)}
              />

              <Text style={s.label}>¿Cómo lo tienen?</Text>
              <Opciones
                opciones={EMBALAJES.map((e) => ({ valor: e.texto, texto: e.texto }))}
                valor={r.embalaje}
                onCambio={(v) => cambiarResiduo(r.id, "embalaje", v)}
                error={errores[`${pre}-embalaje`]}
              />
              <MensajeError texto={errores[`${pre}-embalaje`]} />
              {r.embalaje === OTRO && (
                <>
                  <TextInput
                    style={[s.input, errores[`${pre}-embalaje-otro`] && s.inputError]}
                    placeholder="Por ejemplo: cajas"
                    placeholderTextColor={T.grisClaro}
                    maxLength={LARGO.otro}
                    value={r.embalajeOtro}
                    onChangeText={(v) => cambiarResiduo(r.id, "embalajeOtro", v)}
                  />
                  <MensajeError texto={errores[`${pre}-embalaje-otro`]} />
                </>
              )}
            </Tarjeta>
          );
        })}

        {residuos.length < MAX_RESIDUOS && (
          <Boton variante="linea" onPress={agregar} style={{ marginBottom: 14 }}>
            + Agregar otro residuo
          </Boton>
        )}

        <Tarjeta>
          <Text style={s.residuoTit}>Tus datos</Text>
          {CAMPOS_CONTACTO.map((c) => (
            <View key={c.id}>
              <Text style={s.label}>{c.etiqueta}</Text>
              <TextInput
                style={[s.input, errores[c.id] && s.inputError]}
                placeholder={c.placeholder}
                placeholderTextColor={T.grisClaro}
                maxLength={c.largo}
                keyboardType={c.teclado || "default"}
                autoCapitalize={c.minusculas ? "none" : "sentences"}
                autoCorrect={!c.minusculas && c.id !== "telefono"}
                value={contacto[c.id]}
                onChangeText={(v) => setContacto((k) => ({ ...k, [c.id]: v }))}
              />
              <MensajeError texto={errores[c.id]} />
            </View>
          ))}
        </Tarjeta>

        {hayErrores && (
          <View style={s.aviso}>
            <Feather name="alert-circle" size={16} color={T.error} />
            <Text style={s.avisoTxt}>Revisa los campos marcados para poder enviar.</Text>
          </View>
        )}

        <Boton onPress={enviar}>
          Enviar por WhatsApp
        </Boton>
        <Text style={s.pie}>
          Se abre WhatsApp con el mensaje ya escrito; solo tienes que enviarlo.
          No guardamos tus datos en la app.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  h1: { color: T.tinta, fontSize: 22, fontWeight: "800", letterSpacing: -0.3 },
  sub: { color: T.gris, fontSize: 13.5, marginTop: 4, marginBottom: 14, lineHeight: 19 },
  residuoCab: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  residuoTit: { color: T.tinta, fontSize: 15, fontWeight: "700" },
  quitar: { color: T.error, fontSize: 13.5, fontWeight: "600" },
  label: { color: T.tinta, fontSize: 13, fontWeight: "700", marginTop: 14, marginBottom: 7 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: T.linea, backgroundColor: T.panel2, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { backgroundColor: T.accion, borderColor: T.accion },
  chipError: { borderColor: T.error },
  chipTxt: { color: T.tinta, fontSize: 13 },
  chipTxtOn: { color: "#fff", fontWeight: "700" },
  input: {
    backgroundColor: T.panel2, borderWidth: 1, borderColor: T.linea, borderRadius: 11,
    paddingHorizontal: 14, paddingVertical: 12, color: T.tinta, fontSize: 15, marginBottom: 8,
  },
  inputError: { borderColor: T.error },
  errorFila: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  errorTxt: { color: T.error, fontSize: 12.5, flex: 1 },
  aviso: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(217,119,107,0.12)", borderRadius: 10, padding: 11, marginBottom: 12 },
  avisoTxt: { color: T.error, fontSize: 13, flex: 1 },
  pie: { color: T.grisClaro, fontSize: 12, textAlign: "center", marginTop: 12, lineHeight: 17 },
});
